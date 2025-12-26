import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { toast } from 'sonner';
import { ClobClient, Side } from '@polymarket/clob-client';
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
}

interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  result?: unknown;
}

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
      const size = roundTo(params.amount / Math.max(price, 0.01), 2);

      console.log('[DomeRouter] Building signed order:', {
        tokenId: params.tokenId?.slice(0, 20),
        side: params.side,
        price,
        size,
        negRisk: params.negRisk,
      });

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

      // Create the order using ClobClient
      const orderArgs = {
        tokenID: params.tokenId,
        price,
        size,
        side: params.side === 'BUY' ? Side.BUY : Side.SELL,
        feeRateBps: 0, // No fees
        nonce: 0, // Let library handle nonce
        expiration: 0, // No expiration
      };

      console.log('[DomeRouter] Creating order with args:', orderArgs);

      // createOrder returns the signed order ready for submission
      const signedOrder = await clobClient.createOrder(orderArgs);

      console.log('[DomeRouter] Signed order created:', {
        hasSignature: !!signedOrder?.signature,
        orderType: signedOrder?.orderType,
      });

      updateStage('submitting-order', 'Submitting order to Polymarket...');

      // Submit signed order to dome-router edge function
      const { data: response, error: edgeError } = await supabase.functions.invoke('dome-router', {
        body: {
          action: 'place_order',
          signedOrder,
          credentials: {
            apiKey: credentials.apiKey,
            apiSecret: credentials.apiSecret,
            apiPassphrase: credentials.apiPassphrase,
          },
          negRisk: params.negRisk ?? false,
        },
      });

      if (edgeError) {
        console.error('[DomeRouter] Edge function error:', edgeError);
        throw new Error(edgeError.message || 'Failed to submit order');
      }

      if (!response?.success) {
        console.error('[DomeRouter] Order rejected:', response);
        const errorMessage = response?.error || 'Order rejected';
        throw new Error(errorMessage);
      }

      console.log('[DomeRouter] Order placed successfully:', response);

      const result: OrderResult = {
        success: true,
        orderId: response.orderId,
        result: response,
      };

      setLastOrderResult(result);
      updateStage('completed');
      toast.success('Order placed successfully!');

      return result;
    } catch (error: unknown) {
      console.error('[DomeRouter] Order error:', error);
      const message = error instanceof Error ? error.message : 'Failed to place order';
      
      updateStage('error', message);
      
      // Handle specific error types
      if (message.includes('rejected') || message.includes('denied') || message.includes('User rejected')) {
        toast.error('Order signature rejected');
      } else if (message.includes('Invalid api key') || message.includes('Unauthorized')) {
        toast.error('API credentials invalid - please re-link your wallet');
        clearSession();
      } else {
        toast.error(message);
      }

      const result: OrderResult = {
        success: false,
        error: message,
      };

      setLastOrderResult(result);
      return result;
    } finally {
      setIsPlacingOrder(false);
      setTimeout(() => updateStage('idle'), 2000);
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
