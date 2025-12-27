import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { toast } from 'sonner';
import { ClobClient, Side, OrderType } from '@polymarket/clob-client';
import type { UserOrder, UserMarketOrder } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import { supabase } from '@/integrations/supabase/client';

const POLYGON_CHAIN_ID = 137;
const STORAGE_KEY = 'dome_router_session_v10'; // Bump version for EOA migration

// Trade stage state machine for progress UI
export type TradeStage = 
  | 'idle' 
  | 'switching-network' 
  | 'linking-wallet'
  | 'signing-order' 
  | 'submitting-order' 
  | 'completed' 
  | 'error';

const TRADE_STAGE_MESSAGES: Record<TradeStage, string> = {
  'idle': '',
  'switching-network': 'Switching to Polygon network...',
  'linking-wallet': 'Setting up trading account...',
  'signing-order': 'Please sign the order in your wallet...',
  'submitting-order': 'Submitting order to Polymarket...',
  'completed': 'Order placed successfully!',
  'error': 'Order failed',
};

export interface TradeParams {
  tokenId: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
  isMarketOrder?: boolean;
  negRisk?: boolean;
  tickSize?: string;
  orderType?: 'GTC' | 'FOK' | 'FAK'; // GTC = limit, FOK/FAK = instant fill
}

interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  result?: unknown;
  status?: 'matched' | 'live' | 'partial' | 'rejected';
}

// User-friendly error messages for common API errors
const ERROR_MESSAGES: Record<string, string> = {
  // Balance/allowance issues
  'not enough balance': 'Insufficient balance. You don\'t have enough shares or USDC.',
  'insufficient balance': 'Insufficient balance. You don\'t have enough shares or USDC.',
  'not enough allowance': 'Please approve USDC spending first.',
  'allowance': 'Please approve USDC spending in your wallet.',
  
  // Order rejection
  'ORDER_REJECTED': 'Order rejected by the exchange.',
  
  // Credential issues
  'invalid api key': 'Session expired. Please re-link your wallet.',
  'unauthorized': 'Session expired. Please re-link your wallet.',
  
  // Price/size validation
  'price out of range': 'Price must be between 1¢ and 99¢.',
  'min tick size': 'Price doesn\'t meet minimum tick size.',
  'size too small': 'Order size is too small (min 5 shares).',
  
  // FOK order issues - liquidity problems (BUYS)
  'couldn\'t be fully filled': 'Couldn\'t fill at current price. Try a limit order instead.',
  'fok orders are fully filled': 'Couldn\'t fill at current price. Try a limit order instead.',
  'fill or kill': 'Couldn\'t fill at current price. Try a limit order.',
  
  // FAK order issues - no buyers at all (SELLS)
  'no orders found to match': 'No buyers at current price. Try a limit sell order.',
  'fak orders are partially filled': 'Couldn\'t fill at current price. Try a limit sell order.',
  'no match is found': 'No buyers at current price. Try a limit sell order.',
  
  // Market closed/resolved
  'orderbook': 'This market is closed or resolved. Check the Claimable tab.',
  'does not exist': 'This market is no longer tradeable. It may be resolved.',
  'market is closed': 'This market is closed. Check the Claimable tab for winnings.',
  
  // Network issues
  'timeout': 'Request timed out. Please try again.',
  'network': 'Network error. Check your connection and try again.',
  'failed to fetch': 'Connection failed. Check your network and try again.',
};

interface PolymarketCredentials {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
}

interface StoredSession {
  credentials: PolymarketCredentials;
  signerAddress: string;
  timestamp: number;
}

/**
 * Convert wagmi walletClient to ethers JsonRpcSigner
 */
function walletClientToSigner(walletClient: any): ethers.providers.JsonRpcSigner {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new ethers.providers.Web3Provider(transport, network);
  return provider.getSigner(account.address);
}

/**
 * Dome Router Hook - Direct EOA Signing (No Safe Wallet)
 * 
 * Simplified flow:
 * - Connect Wallet → Create Credentials → Fund EOA with USDC → Trade
 * 
 * Uses signatureType = 0 (Direct EOA)
 * EOA holds USDC directly
 */
export function useDomeRouter() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  
  // State
  const [isLinking, setIsLinking] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [credentials, setCredentials] = useState<PolymarketCredentials | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrderResult, setLastOrderResult] = useState<OrderResult | null>(null);
  const [tradeStage, setTradeStage] = useState<TradeStage>('idle');
  const [tradeStageMessage, setTradeStageMessage] = useState('');

  // Helper to update trade stage
  const updateStage = useCallback((stage: TradeStage, customMessage?: string) => {
    setTradeStage(stage);
    setTradeStageMessage(customMessage || TRADE_STAGE_MESSAGES[stage]);
  }, []);

  // Load cached session on wallet change
  useEffect(() => {
    if (!address) {
      setIsLinked(false);
      setCredentials(null);
      return;
    }

    const cacheKey = `${STORAGE_KEY}:${address.toLowerCase()}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const session: StoredSession = JSON.parse(cached);
        // Check if session is less than 7 days old
        if (Date.now() - session.timestamp < 7 * 24 * 60 * 60 * 1000) {
          setCredentials(session.credentials);
          setIsLinked(true);
          console.log('[DomeRouter] Restored session from cache');
        } else {
          localStorage.removeItem(cacheKey);
        }
      } catch (e) {
        console.error('[DomeRouter] Failed to parse cached session:', e);
        localStorage.removeItem(cacheKey);
      }
    }
  }, [address]);

  // Save session to localStorage
  const saveSession = useCallback((session: Omit<StoredSession, 'timestamp'>) => {
    if (!address) return;
    const cacheKey = `${STORAGE_KEY}:${address.toLowerCase()}`;
    localStorage.setItem(cacheKey, JSON.stringify({
      ...session,
      timestamp: Date.now(),
    }));
  }, [address]);

  // Clear session
  const clearSession = useCallback(() => {
    if (!address) return;
    
    const cacheKey = `${STORAGE_KEY}:${address.toLowerCase()}`;
    localStorage.removeItem(cacheKey);
    
    setIsLinked(false);
    setCredentials(null);
    
    toast.success('Credentials cleared - please re-link');
  }, [address]);

  /**
   * Link user to Polymarket - CLIENT-SIDE credential creation using ClobClient
   * 
   * Uses signatureType = 0 (Direct EOA)
   * EOA signs AND holds USDC directly
   */
  const linkUser = useCallback(async () => {
    if (!address || !walletClient) {
      toast.error('Please connect your wallet first');
      return null;
    }

    // Ensure we're on Polygon
    if (chainId !== POLYGON_CHAIN_ID) {
      try {
        updateStage('switching-network');
        await switchChainAsync({ chainId: POLYGON_CHAIN_ID });
      } catch (e) {
        toast.error('Please switch to Polygon network');
        updateStage('idle');
        return null;
      }
    }

    setIsLinking(true);

    try {
      console.log('[DomeRouter] ========== STARTING LINK FLOW (Direct EOA) ==========');
      console.log('[DomeRouter] EOA address:', address);

      updateStage('linking-wallet', 'Creating API credentials...');

      // Create ethers signer from wagmi walletClient
      const eoaSigner = walletClientToSigner(walletClient);

      console.log('[DomeRouter] Creating credentials with:');
      console.log('[DomeRouter]   signatureType = 0 (Direct EOA)');
      console.log('[DomeRouter]   EOA address:', address);

      // Create ClobClient for credential generation
      // signatureType = 0 (Direct EOA signing)
      // No funderAddress needed - EOA holds USDC
      const clobClient = new ClobClient(
        'https://clob.polymarket.com',
        POLYGON_CHAIN_ID,
        eoaSigner,
        undefined, // No credentials yet
        0, // signatureType = 0 (Direct EOA)
        undefined // No funder address
      );

      console.log('[DomeRouter] ClobClient initialized for credential creation');

      // Try to derive existing API key first
      let creds: PolymarketCredentials | null = null;
      const nonce = Date.now();

      try {
        console.log('[DomeRouter] Attempting deriveApiKey (nonce:', nonce, ')...');
        const derived = await clobClient.deriveApiKey(nonce);
        if (derived?.key && derived?.secret && derived?.passphrase) {
          creds = {
            apiKey: derived.key,
            apiSecret: derived.secret,
            apiPassphrase: derived.passphrase,
          };
          console.log('[DomeRouter] Successfully derived existing credentials');
        } else {
          console.log('[DomeRouter] deriveApiKey returned incomplete creds, will try create');
        }
      } catch (deriveErr) {
        console.log('[DomeRouter] deriveApiKey failed (expected for new users):', deriveErr);
      }

      // If derive failed, create new credentials
      if (!creds) {
        console.log('[DomeRouter] Attempting createApiKey (nonce:', nonce, ')...');
        const created = await clobClient.createApiKey(nonce);
        if (created?.key && created?.secret && created?.passphrase) {
          creds = {
            apiKey: created.key,
            apiSecret: created.secret,
            apiPassphrase: created.passphrase,
          };
          console.log('[DomeRouter] Successfully created new credentials');
        }
      }

      if (!creds) {
        throw new Error('Failed to obtain API credentials');
      }

      console.log('[DomeRouter] Credential acquisition complete:', {
        hasKey: !!creds.apiKey,
        keyPrefix: creds.apiKey.slice(0, 8) + '...',
        hasSecret: !!creds.apiSecret,
        hasPassphrase: !!creds.apiPassphrase,
      });

      setCredentials(creds);
      setIsLinked(true);

      // Save to localStorage
      saveSession({
        credentials: creds,
        signerAddress: address,
      });

      console.log('[DomeRouter] ========== LINK SUCCESSFUL ==========');
      console.log('[DomeRouter] Summary:', {
        eoaAddress: address,
        credentialKeyPrefix: creds.apiKey.slice(0, 8) + '...',
        signatureType: 0,
      });

      updateStage('completed', 'Wallet linked successfully!');
      toast.success('Wallet linked to Polymarket!');

      return { credentials: creds };
    } catch (error: unknown) {
      console.error('[DomeRouter] ========== LINK FAILED ==========');
      console.error('[DomeRouter] Error:', error);
      const message = error instanceof Error ? error.message : 'Failed to link wallet';
      updateStage('error', message);

      if (message.includes('rejected') || message.includes('denied') || message.includes('User rejected')) {
        toast.error('Signature rejected');
      } else {
        toast.error(message);
      }

      return null;
    } finally {
      setIsLinking(false);
      setTimeout(() => updateStage('idle'), 2000);
    }
  }, [address, walletClient, chainId, switchChainAsync, saveSession, updateStage]);

  /**
   * Place order - Build and sign order client-side using ClobClient, then submit
   * 
   * Flow:
   * 1. Create ClobClient with stored credentials
   * 2. Build order using clobClient.createOrder()
   * 3. Sign order using clobClient (returns signed order)
   * 4. Submit signed order to dome-router edge function
   */
  const placeOrder = useCallback(async (params: TradeParams): Promise<OrderResult> => {
    if (!address || !walletClient) {
      toast.error('Please connect your wallet first');
      return { success: false, error: 'Wallet not connected' };
    }

    if (!isLinked || !credentials) {
      toast.error('Please link your wallet first');
      return { success: false, error: 'Wallet not linked' };
    }

    // Ensure we're on Polygon
    if (chainId !== POLYGON_CHAIN_ID) {
      try {
        updateStage('switching-network');
        await switchChainAsync({ chainId: POLYGON_CHAIN_ID });
      } catch (e) {
        toast.error('Please switch to Polygon network');
        updateStage('idle');
        return { success: false, error: 'Wrong network' };
      }
    }

    setIsPlacingOrder(true);
    setLastOrderResult(null);

    try {
      updateStage('signing-order', 'Building and signing order...');

      // Create ethers signer from wagmi walletClient
      const eoaSigner = walletClientToSigner(walletClient);

      // Round amounts properly
      const roundTo = (n: number, decimals: number) => Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
      
      const price = roundTo(params.price, 2);

      // Create ClobClient with credentials for order signing
      // signatureType = 0 for order building (Direct EOA)
      const clobClient = new ClobClient(
        'https://clob.polymarket.com',
        POLYGON_CHAIN_ID,
        eoaSigner,
        {
          key: credentials.apiKey,
          secret: credentials.apiSecret,
          passphrase: credentials.apiPassphrase,
        },
        0, // signatureType = 0 (Direct EOA)
        undefined
      );

      // Determine order type:
      // - Market orders: FOK for buys (must fill entirely), FAK for sells (fill what you can)
      // - Limit orders: GTC (Good Till Cancel)
      let orderType: 'GTC' | 'FOK' | 'FAK' = 'GTC';
      if (params.isMarketOrder) {
        orderType = params.side === 'BUY' ? 'FOK' : 'FAK';
      }
      // Allow explicit override if passed
      if (params.orderType) {
        orderType = params.orderType;
      }

      // Fetch tick size for proper rounding (library uses this for amount precision)
      let tickSize: '0.1' | '0.01' | '0.001' | '0.0001' = '0.01'; // Default
      try {
        const fetchedTickSize = await clobClient.getTickSize(params.tokenId);
        if (fetchedTickSize) {
          tickSize = fetchedTickSize;
        }
      } catch (e) {
        console.log('[DomeRouter] Could not fetch tickSize, using default 0.01:', e);
      }

      const createOrderOptions = { 
        tickSize, 
        negRisk: params.negRisk 
      };

      let signedOrder;

      // Use different methods based on order type:
      // - createMarketOrder() for FOK/FAK: uses `amount` (USDC for buys, shares for sells)
      // - createOrder() for GTC: uses `size` (shares)
      if (orderType === 'FOK' || orderType === 'FAK') {
        // Market order: use createMarketOrder with `amount` field
        // BUY: amount = USDC to spend
        // SELL: amount = shares to sell
        const userMarketOrder: UserMarketOrder = {
          tokenID: params.tokenId,
          price, // Use aggressive price for market orders
          amount: params.amount, // USDC for buys, shares for sells
          side: params.side === 'BUY' ? Side.BUY : Side.SELL,
          feeRateBps: 0,
          nonce: 0,
          orderType: orderType === 'FOK' ? OrderType.FOK : OrderType.FAK,
        };

        console.log('[DomeRouter] Creating MARKET order with createMarketOrder():', { 
          ...userMarketOrder, 
          tokenId: params.tokenId?.slice(0, 20),
          tickSize,
        });

        signedOrder = await clobClient.createMarketOrder(userMarketOrder, createOrderOptions);
      } else {
        // Limit order: use createOrder with `size` field
        // For BUY: user inputs USDC amount, we calculate shares (USDC / price = shares)
        // For SELL: user inputs shares directly
        let size: number;
        if (params.side === 'BUY') {
          size = roundTo(params.amount / Math.max(price, 0.01), 2);
        } else {
          size = roundTo(params.amount, 2);
        }

        const userOrder: UserOrder = {
          tokenID: params.tokenId,
          price,
          size,
          side: params.side === 'BUY' ? Side.BUY : Side.SELL,
          feeRateBps: 0,
          nonce: 0,
          expiration: 0,
        };

        console.log('[DomeRouter] Creating LIMIT order with createOrder():', { 
          ...userOrder, 
          tokenId: params.tokenId?.slice(0, 20),
          tickSize,
        });

        signedOrder = await clobClient.createOrder(userOrder, createOrderOptions);
      }

      // Transform numeric side to string for Dome API
      // ClobClient returns side: 0 (BUY) or 1 (SELL), but Dome expects "BUY" or "SELL"
      // Generate clientOrderId separately - Dome expects it at params level, NOT inside signedOrder
      const clientOrderId = crypto.randomUUID();
      const transformedOrder = {
        ...signedOrder,
        side: params.side, // Force string value at root level
      };

      console.log('[DomeRouter] Signed order created:', {
        clientOrderId,
        hasSignature: !!signedOrder?.signature,
        orderType: signedOrder?.orderType,
        originalSide: (signedOrder as Record<string, unknown>).side,
        transformedSide: params.side,
        fullOrderKeys: Object.keys(transformedOrder),
      });

      updateStage('submitting-order', 'Submitting order to Polymarket...');

      // Submit transformed order to dome-router edge function
      // clientOrderId is passed as a separate field at request level (per Dome SDK ServerPlaceOrderRequest)
      const { data: response, error: edgeError } = await supabase.functions.invoke('dome-router', {
        body: {
          action: 'place_order',
          signedOrder: transformedOrder,
          credentials: {
            apiKey: credentials.apiKey,
            apiSecret: credentials.apiSecret,
            apiPassphrase: credentials.apiPassphrase,
          },
          negRisk: params.negRisk ?? false,
          clientOrderId, // At request level, NOT inside signedOrder
          orderType, // GTC, FOK, or FAK
        },
      });

      // Handle edge function errors - check response data for actual error details
      // even when edgeError exists (400 responses have error details in data)
      if (edgeError || !response?.success) {
        const errorDetails = response?.details?.reason || response?.error;
        
        if (errorDetails) {
          // We have actual error details from Dome API - parse for user-friendly message
          console.error('[DomeRouter] Order rejected:', {
            error: response?.error,
            code: response?.code,
            details: response?.details,
            edgeError: edgeError?.message,
          });
          
          let errorMessage = errorDetails;
          const errorLower = errorMessage.toLowerCase();
          
          for (const [key, userMessage] of Object.entries(ERROR_MESSAGES)) {
            if (errorLower.includes(key.toLowerCase())) {
              errorMessage = userMessage;
              break;
            }
          }
          
          throw new Error(errorMessage);
        }
        
        // Fallback for truly unhandled edge function errors
        if (edgeError) {
          console.error('[DomeRouter] Edge function error:', edgeError);
          throw new Error('Order failed. Please try again.');
        }
      }


      console.log('[DomeRouter] Order placed successfully:', response);

      // Determine order status for better feedback
      const orderStatus = response.status?.toLowerCase() || 'live';
      const isMatched = orderStatus === 'matched' || orderStatus === 'filled';
      const isPartial = orderStatus === 'partial' || (response.size_matched && parseFloat(response.size_matched) > 0);

      const result: OrderResult = {
        success: true,
        orderId: response.orderId,
        result: response,
        status: isMatched ? 'matched' : isPartial ? 'partial' : 'live',
      };

      setLastOrderResult(result);
      updateStage('completed');
      
      // Show appropriate success message based on order status
      if (isMatched) {
        toast.success('Order filled instantly!', {
          description: `Your ${params.side} order was matched immediately`,
        });
      } else if (isPartial) {
        toast.success('Order partially filled', {
          description: 'Remaining amount placed as limit order',
        });
      } else {
        toast.success('Limit order placed', {
          description: 'Waiting for a matching order at your price',
        });
      }

      return result;
    } catch (error: unknown) {
      console.error('[DomeRouter] Order error:', error);
      let message = error instanceof Error ? error.message : 'Failed to place order';
      
      // Parse error for user-friendly message
      const errorLower = message.toLowerCase();
      for (const [key, userMessage] of Object.entries(ERROR_MESSAGES)) {
        if (errorLower.includes(key.toLowerCase())) {
          message = userMessage;
          break;
        }
      }
      
      // Show error toast immediately with high priority (persists 8s, shows above whale alerts)
      const toastOptions = { duration: 8000, important: true };
      
      if (message.includes('rejected') || message.includes('denied') || message.includes('User rejected')) {
        toast.error('Order signature rejected', toastOptions);
      } else if (message.includes('expired') || message.includes('re-link')) {
        toast.error('Session expired', {
          ...toastOptions,
          description: 'Please re-link your wallet to continue trading.',
        });
        clearSession();
      } else if (message.includes('No buyers') || message.includes('limit sell')) {
        toast.error(message, {
          ...toastOptions,
          description: 'Set a price with a limit order to wait for buyers.',
        });
      } else if (message.includes('limit order') || message.includes('Couldn\'t fill')) {
        toast.error(message, {
          ...toastOptions,
          description: 'Set a specific price with a limit order for better control.',
        });
      } else if (message.includes('inactive') || message.includes('resolved') || message.includes('closed') || message.includes('Claimable')) {
        toast.error(message, {
          ...toastOptions,
          description: 'Go to My Trades → Claimable to collect any winnings.',
        });
      } else if (message.includes('balance') || message.includes('USDC')) {
        toast.error(message, {
          ...toastOptions,
          description: 'Add more USDC to your wallet to continue trading.',
        });
      } else {
        toast.error(message, {
          ...toastOptions,
          description: 'Check your order details and try again.',
        });
      }

      // Clear overlay immediately on error so toast is visible
      updateStage('idle');

      const result: OrderResult = {
        success: false,
        error: message,
      };

      setLastOrderResult(result);
      return result;
    } finally {
      setIsPlacingOrder(false);
      // Only reset to idle after success (errors already reset immediately above)
      // This prevents the 2-second delay from blocking error toasts
    }
  }, [address, walletClient, chainId, switchChainAsync, isLinked, credentials, updateStage, clearSession]);

  // isDomeReady: true when wallet is connected (no Safe deployment needed)
  const isDomeReady = isConnected && !!walletClient;

  return {
    // Connection state
    isConnected,
    address,
    
    // Linking state
    isLinking,
    isLinked,
    linkUser,
    clearSession,
    
    // Credentials
    credentials,
    
    // Order state
    isPlacingOrder,
    lastOrderResult,
    placeOrder,
    
    // Trade stage UI
    tradeStage,
    tradeStageMessage,
    
    // Ready state
    isDomeReady,
  };
}
