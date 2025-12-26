import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { toast } from 'sonner';
import { ClobClient, Side, OrderType, TickSize } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import { supabase } from '@/integrations/supabase/client';
import { polygon } from 'wagmi/chains';
import { POLYGON_CONTRACTS, CTF_ABI } from '@/lib/polymarket-contracts';

const POLYGON_CHAIN_ID = 137;
const STORAGE_KEY = 'dome_router_session_v10'; // Bump version for EOA migration

// Trade stage state machine for progress UI
export type TradeStage = 
  | 'idle' 
  | 'switching-network' 
  | 'linking-wallet'
  | 'approving-tokens'
  | 'signing-order' 
  | 'submitting-order' 
  | 'completed' 
  | 'error';

const TRADE_STAGE_MESSAGES: Record<TradeStage, string> = {
  'idle': '',
  'switching-network': 'Switching to Polygon network...',
  'linking-wallet': 'Setting up trading account...',
  'approving-tokens': 'Approving token transfers (one-time)...',
  'signing-order': 'Please sign the order in your wallet...',
  'submitting-order': 'Submitting order to Polymarket...',
  'completed': 'Order placed successfully!',
  'error': 'Order failed',
};

export interface TradeParams {
  tokenId: string;
  side: 'BUY' | 'SELL';
  /**
   * For MARKET orders:
   *   - BUY: USDC amount to spend
   *   - SELL: Number of shares to sell
   * For LIMIT orders:
   *   - Both: USDC value (amount = price × size)
   */
  amount: number;
  price: number;
  isMarketOrder?: boolean;
  negRisk?: boolean;
  tickSize?: string;
  conditionId?: string; // For position verification on SELL
}

interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  result?: unknown;
  status?: 'live' | 'matched' | 'filled' | 'unknown'; // Order execution status
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
  const publicClient = usePublicClient({ chainId: polygon.id });
  
  // State
  const [isLinking, setIsLinking] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [credentials, setCredentials] = useState<PolymarketCredentials | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrderResult, setLastOrderResult] = useState<OrderResult | null>(null);
  const [tradeStage, setTradeStage] = useState<TradeStage>('idle');
  const [tradeStageMessage, setTradeStageMessage] = useState('');
  const [isApprovingTokens, setIsApprovingTokens] = useState(false);

  // CTF ERC1155 approval checks for SELL orders
  const { data: ctfExchangeApproved, refetch: refetchCtfApproval } = useReadContract({
    address: POLYGON_CONTRACTS.CTF_CONTRACT,
    abi: CTF_ABI,
    functionName: 'isApprovedForAll',
    args: address ? [address, POLYGON_CONTRACTS.CTF_EXCHANGE] : undefined,
    chainId: polygon.id,
    query: { enabled: !!address && isConnected },
  });

  const { data: negRiskExchangeApproved, refetch: refetchNegRiskApproval } = useReadContract({
    address: POLYGON_CONTRACTS.CTF_CONTRACT,
    abi: CTF_ABI,
    functionName: 'isApprovedForAll',
    args: address ? [address, POLYGON_CONTRACTS.NEG_RISK_CTF_EXCHANGE] : undefined,
    chainId: polygon.id,
    query: { enabled: !!address && isConnected },
  });

  const { data: negRiskAdapterApproved, refetch: refetchNegRiskAdapterApproval } = useReadContract({
    address: POLYGON_CONTRACTS.CTF_CONTRACT,
    abi: CTF_ABI,
    functionName: 'isApprovedForAll',
    args: address ? [address, POLYGON_CONTRACTS.NEG_RISK_ADAPTER] : undefined,
    chainId: polygon.id,
    query: { enabled: !!address && isConnected },
  });

  // Write contract for token approvals
  const { writeContractAsync } = useWriteContract();

  // Check if CTF tokens are approved for the exchange
  const isCTFApprovedForSell = !!ctfExchangeApproved && !!negRiskExchangeApproved && !!negRiskAdapterApproved;

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
   * Ensure CTF tokens are approved for transfer (required for SELL orders)
   * This is a one-time approval per wallet
   */
  const ensureCTFApproval = useCallback(async (negRisk?: boolean): Promise<boolean> => {
    if (!address || !publicClient) {
      return false;
    }

    // Check which approvals are needed
    const needsCtfExchangeApproval = !ctfExchangeApproved;
    const needsNegRiskApproval = !negRiskExchangeApproved;
    const needsNegRiskAdapterApproval = !negRiskAdapterApproved;

    // If all approved, we're good
    if (!needsCtfExchangeApproval && !needsNegRiskApproval && !needsNegRiskAdapterApproval) {
      console.log('[DomeRouter] CTF tokens already approved for all exchanges');
      return true;
    }

    console.log('[DomeRouter] CTF approval needed:', {
      needsCtfExchangeApproval,
      needsNegRiskApproval,
      needsNegRiskAdapterApproval,
    });

    setIsApprovingTokens(true);
    updateStage('approving-tokens');

    try {
      // Approve CTF Exchange
      if (needsCtfExchangeApproval) {
        toast.info('Approving token transfers for CTF Exchange...');
        const hash = await writeContractAsync({
          account: address as `0x${string}`,
          chain: polygon,
          address: POLYGON_CONTRACTS.CTF_CONTRACT,
          abi: CTF_ABI,
          functionName: 'setApprovalForAll',
          args: [POLYGON_CONTRACTS.CTF_EXCHANGE, true],
        });
        await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        console.log('[DomeRouter] CTF Exchange approval confirmed');
      }

      // Approve Neg Risk Exchange
      if (needsNegRiskApproval) {
        toast.info('Approving token transfers for Neg Risk Exchange...');
        const hash = await writeContractAsync({
          account: address as `0x${string}`,
          chain: polygon,
          address: POLYGON_CONTRACTS.CTF_CONTRACT,
          abi: CTF_ABI,
          functionName: 'setApprovalForAll',
          args: [POLYGON_CONTRACTS.NEG_RISK_CTF_EXCHANGE, true],
        });
        await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        console.log('[DomeRouter] Neg Risk Exchange approval confirmed');
      }

      // Approve Neg Risk Adapter
      if (needsNegRiskAdapterApproval) {
        toast.info('Approving token transfers for Neg Risk Adapter...');
        const hash = await writeContractAsync({
          account: address as `0x${string}`,
          chain: polygon,
          address: POLYGON_CONTRACTS.CTF_CONTRACT,
          abi: CTF_ABI,
          functionName: 'setApprovalForAll',
          args: [POLYGON_CONTRACTS.NEG_RISK_ADAPTER, true],
        });
        await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        console.log('[DomeRouter] Neg Risk Adapter approval confirmed');
      }

      // Refetch approval states
      await Promise.all([
        refetchCtfApproval(),
        refetchNegRiskApproval(),
        refetchNegRiskAdapterApproval(),
      ]);

      toast.success('Token approvals confirmed!');
      return true;
    } catch (error: unknown) {
      console.error('[DomeRouter] CTF approval error:', error);
      const message = error instanceof Error ? error.message : 'Failed to approve tokens';
      if (message.includes('rejected') || message.includes('denied')) {
        toast.error('Token approval rejected');
      } else {
        toast.error('Failed to approve tokens: ' + message);
      }
      return false;
    } finally {
      setIsApprovingTokens(false);
    }
  }, [address, publicClient, ctfExchangeApproved, negRiskExchangeApproved, negRiskAdapterApproved, writeContractAsync, updateStage, refetchCtfApproval, refetchNegRiskApproval, refetchNegRiskAdapterApproval]);

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
   * Check if user has position in a specific token (for SELL verification)
   */
  const checkUserPosition = useCallback(async (tokenId: string): Promise<{ hasPosition: boolean; size: number }> => {
    if (!address || !credentials) {
      return { hasPosition: false, size: 0 };
    }

    try {
      console.log('[DomeRouter] Checking user position for token:', tokenId?.slice(0, 20));
      
      // Use query params for GET request
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-positions`);
      url.searchParams.set('address', address);
      url.searchParams.set('apiKey', credentials.apiKey);
      url.searchParams.set('secret', credentials.apiSecret);
      url.searchParams.set('passphrase', credentials.apiPassphrase);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!response.ok) {
        console.error('[DomeRouter] Failed to fetch positions:', response.status);
        return { hasPosition: false, size: 0 };
      }

      const positionsData = await response.json();
      console.log('[DomeRouter] User positions:', positionsData?.positions?.length || 0);

      // Find position matching the tokenId
      const position = positionsData?.positions?.find((p: { asset: string; size: number }) => 
        p.asset?.toLowerCase() === tokenId?.toLowerCase()
      );

      if (position && position.size > 0) {
        console.log('[DomeRouter] Found position:', { tokenId: tokenId?.slice(0, 20), size: position.size });
        return { hasPosition: true, size: position.size };
      }

      return { hasPosition: false, size: 0 };
    } catch (error) {
      console.error('[DomeRouter] Error checking position:', error);
      return { hasPosition: false, size: 0 };
    }
  }, [address, credentials]);

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
      // For SELL orders, verify user has the position and CTF approval
      if (params.side === 'SELL') {
        updateStage('signing-order', 'Verifying position...');
        const { hasPosition, size } = await checkUserPosition(params.tokenId);
        
        if (!hasPosition) {
          const errorMsg = "You don't own shares in this market. Buy shares first before selling.";
          toast.error(errorMsg);
          updateStage('error', errorMsg);
          return { success: false, error: errorMsg };
        }

        // For MARKET SELL: amount IS the number of shares directly
        // For LIMIT SELL: amount = USDC value, so shares = amount / price
        const requestedSize = params.isMarketOrder 
          ? params.amount 
          : params.amount / Math.max(params.price, 0.01);
          
        if (size < requestedSize * 0.99) { // 1% tolerance for rounding
          const errorMsg = `Insufficient shares. You have ${size.toFixed(2)} but trying to sell ${requestedSize.toFixed(2)}`;
          toast.error(errorMsg);
          updateStage('error', errorMsg);
          return { success: false, error: errorMsg };
        }

        // Check and ensure CTF token approval for SELL orders
        if (!isCTFApprovedForSell) {
          console.log('[DomeRouter] CTF approval needed for SELL order');
          const approved = await ensureCTFApproval(params.negRisk);
          if (!approved) {
            updateStage('error', 'Token approval required to sell');
            return { success: false, error: 'Token approval was rejected or failed' };
          }
        }
      }

      updateStage('signing-order', 'Building and signing order...');

      // Create ethers signer from wagmi walletClient
      const eoaSigner = walletClientToSigner(walletClient);

      // Round amounts properly
      const roundTo = (n: number, decimals: number) => Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);

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

      let signedOrder: Awaited<ReturnType<typeof clobClient.createOrder>>;
      let orderDescription: string;

      // Always use createOrder() with proper tickSize for decimal precision
      // The order type (FOK/GTC) is handled by the edge function when posting
      const tickSize: TickSize = (params.tickSize as TickSize) || '0.01';
      const price = roundTo(params.price, 2);
      
      // Calculate size based on order type and side
      let size: number;
      if (params.isMarketOrder && params.side === 'SELL') {
        // Market SELL: amount IS the number of shares
        size = roundTo(params.amount, 2);
      } else {
        // BUY orders and Limit SELL: amount = USDC value, size = amount / price
        size = roundTo(params.amount / Math.max(price, 0.01), 2);
      }

      console.log('[DomeRouter] Creating order:', {
        tokenId: params.tokenId?.slice(0, 20),
        side: params.side,
        price,
        size,
        orderType: params.isMarketOrder ? 'FOK (Market)' : 'GTC (Limit)',
        negRisk: params.negRisk,
        tickSize,
      });

      const orderArgs = {
        tokenID: params.tokenId,
        price,
        size,
        side: params.side === 'BUY' ? Side.BUY : Side.SELL,
        feeRateBps: 0,
        nonce: 0,
        expiration: 0,
      };

      // Pass tickSize and negRisk in options for proper decimal handling
      signedOrder = await clobClient.createOrder(orderArgs, { 
        tickSize, 
        negRisk: params.negRisk ?? false 
      });
      
      orderDescription = params.isMarketOrder
        ? (params.side === 'BUY' 
            ? `Market BUY ${size} shares @ ${(price * 100).toFixed(0)}¢`
            : `Market SELL ${size} shares @ ${(price * 100).toFixed(0)}¢`)
        : `Limit ${params.side} ${size} shares @ ${(price * 100).toFixed(0)}¢`;


      // Transform numeric side to string for Dome API
      const clientOrderId = crypto.randomUUID();
      const transformedOrder = {
        ...signedOrder,
        side: params.side, // Force string value at root level
      };

      console.log('[DomeRouter] Signed order created:', {
        clientOrderId,
        orderDescription,
        hasSignature: !!signedOrder?.signature,
        orderType: signedOrder?.orderType,
        isMarketOrder: params.isMarketOrder,
        fullOrderKeys: Object.keys(transformedOrder),
      });

      updateStage('submitting-order', 'Submitting order to Polymarket...');

      // Submit transformed order to dome-router edge function
      // clientOrderId is passed as a separate field at request level (per Dome SDK ServerPlaceOrderRequest)
      // orderType: FOK for market orders (immediate fill or cancel), GTC for limit orders
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
          orderType: params.isMarketOrder ? 'FOK' : 'GTC', // FOK for market, GTC for limit
        },
      });

      if (edgeError) {
        console.error('[DomeRouter] Edge function error:', edgeError);
        throw new Error(edgeError.message || 'Failed to submit order');
      }

      if (!response?.success) {
        console.error('[DomeRouter] Order rejected:', {
          error: response?.error,
          code: response?.code,
          details: response?.details,
          rawResponse: response,
        });
        
        // Handle specific rejection reasons with user-friendly messages
        const errorCode = response?.code;
        const rawReason = response?.details?.reason || response?.error || 'Order rejected';
        
        let errorMessage = rawReason;
        if (rawReason.includes('not enough balance') || rawReason.includes('allowance')) {
          if (params.side === 'SELL') {
            errorMessage = "You don't have enough shares to sell. Make sure your buy order was filled first.";
          } else {
            errorMessage = "Insufficient USDC balance. Please deposit more funds.";
          }
        } else if (errorCode === 1006) {
          errorMessage = params.side === 'SELL' 
            ? "Order rejected - you may not own these shares yet (previous buy order may still be pending)"
            : "Order rejected by exchange";
        }
        
        throw new Error(errorMessage);
      }

      console.log('[DomeRouter] Order response:', JSON.stringify(response, null, 2));

      // Determine order status from response
      const orderStatus = response.status?.toLowerCase() || 
                         (response.matched ? 'matched' : 
                          response.orderId ? 'live' : 'unknown');
      
      const result: OrderResult = {
        success: true,
        orderId: response.orderId,
        result: response,
        status: orderStatus as OrderResult['status'],
      };

      setLastOrderResult(result);
      
      // Show appropriate toast based on order status
      if (orderStatus === 'matched' || orderStatus === 'filled') {
        updateStage('completed', 'Order filled!');
        toast.success('Order filled successfully!');
      } else if (orderStatus === 'live') {
        updateStage('completed', 'Order placed on order book');
        toast.info('Order placed on order book (waiting to be filled)', {
          description: 'Your limit order is active. It will execute when the market price matches.',
          duration: 5000,
        });
      } else {
        updateStage('completed');
        toast.success('Order submitted successfully!');
      }

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
  }, [address, walletClient, chainId, switchChainAsync, isLinked, credentials, updateStage, clearSession, checkUserPosition, isCTFApprovedForSell, ensureCTFApproval]);

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
    
    // Token approval state
    isCTFApprovedForSell,
    isApprovingTokens,
    ensureCTFApproval,
    
    // Ready state
    isDomeReady,
  };
}
