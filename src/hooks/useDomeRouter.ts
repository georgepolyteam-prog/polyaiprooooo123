import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { toast } from 'sonner';
import { PolymarketRouter } from '@dome-api/sdk';
import { createRouterSigner } from '@/lib/dome-signer';
import type { RouterSigner } from '@/lib/dome-signer';

const POLYGON_CHAIN_ID = 137;
const STORAGE_KEY = 'dome_router_session_v2';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Trade stage state machine for progress UI
export type TradeStage = 
  | 'idle' 
  | 'switching-network' 
  | 'checking-balance' 
  | 'linking-wallet'
  | 'deploying-safe'
  | 'setting-allowances'
  | 'signing-order' 
  | 'submitting-order' 
  | 'completed' 
  | 'error';

const TRADE_STAGE_MESSAGES: Record<TradeStage, string> = {
  'idle': '',
  'switching-network': 'Switching to Polygon network...',
  'checking-balance': 'Checking balances...',
  'linking-wallet': 'Linking wallet to Polymarket...',
  'deploying-safe': 'Deploying Safe wallet...',
  'setting-allowances': 'Setting token allowances...',
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
  safeAddress: string;
  credentials: PolymarketCredentials;
  signerAddress: string;
  timestamp: number;
}

// Normalize price to avoid floating point errors
function normalizePrice(price: number): number {
  const rounded = Math.round(price * 100) / 100;
  return Math.max(0.01, Math.min(0.99, rounded));
}

/**
 * Fetch Dome API key from edge function
 */
async function fetchDomeApiKey(): Promise<string | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-dome-api-key`);
    if (!response.ok) {
      console.error('[DomeRouter] Failed to fetch Dome API key:', response.status);
      return null;
    }
    const data = await response.json();
    return data.apiKey || null;
  } catch (e) {
    console.error('[DomeRouter] Error fetching Dome API key:', e);
    return null;
  }
}

export function useDomeRouter() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  
  // State
  const [isLinking, setIsLinking] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [isDeployed, setIsDeployed] = useState(false);
  const [hasAllowances, setHasAllowances] = useState(false);
  const [credentials, setCredentials] = useState<PolymarketCredentials | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrderResult, setLastOrderResult] = useState<OrderResult | null>(null);
  const [tradeStage, setTradeStage] = useState<TradeStage>('idle');
  const [tradeStageMessage, setTradeStageMessage] = useState('');
  const [domeApiKey, setDomeApiKey] = useState<string | null>(null);
  
  // Router instance ref
  const routerRef = useRef<PolymarketRouter | null>(null);

  // Helper to update trade stage
  const updateStage = useCallback((stage: TradeStage, customMessage?: string) => {
    setTradeStage(stage);
    setTradeStageMessage(customMessage || TRADE_STAGE_MESSAGES[stage]);
  }, []);

  // Fetch Dome API key on mount
  useEffect(() => {
    fetchDomeApiKey().then(key => {
      if (key) {
        setDomeApiKey(key);
        // Initialize router with API key
        routerRef.current = new PolymarketRouter({
          chainId: POLYGON_CHAIN_ID,
          apiKey: key,
        });
        console.log('[DomeRouter] Initialized PolymarketRouter with API key');
      }
    });
  }, []);

  // Load cached session on wallet change
  useEffect(() => {
    if (!address) {
      setIsLinked(false);
      setSafeAddress(null);
      setIsDeployed(false);
      setHasAllowances(false);
      setCredentials(null);
      return;
    }

    // Load from localStorage
    const cacheKey = `${STORAGE_KEY}:${address.toLowerCase()}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const session: StoredSession = JSON.parse(cached);
        // Check if session is less than 7 days old
        if (Date.now() - session.timestamp < 7 * 24 * 60 * 60 * 1000) {
          setSafeAddress(session.safeAddress);
          setCredentials(session.credentials);
          setIsDeployed(true);
          setHasAllowances(true);
          setIsLinked(true);
          console.log('[DomeRouter] Restored session from cache');
          
          // Set credentials in router if available
          if (routerRef.current && session.credentials) {
            routerRef.current.setCredentials(`user:${address.toLowerCase()}`, {
              apiKey: session.credentials.apiKey,
              apiSecret: session.credentials.apiSecret,
              apiPassphrase: session.credentials.apiPassphrase,
            });
          }
        } else {
          // Clear stale session
          localStorage.removeItem(cacheKey);
        }
      } catch (e) {
        console.error('[DomeRouter] Failed to parse cached session:', e);
        localStorage.removeItem(cacheKey);
      }
    }
    
    // Derive Safe address from EOA if we have the router
    if (routerRef.current) {
      const derivedSafe = routerRef.current.deriveSafeAddress(address);
      setSafeAddress(derivedSafe);
      console.log('[DomeRouter] Derived Safe address:', derivedSafe);
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
    setHasAllowances(false);
    setIsDeployed(false);
    toast.success('Trading session cleared');
  }, [address]);

  /**
   * Link user to Polymarket using Dome SDK's PolymarketRouter
   */
  const linkUser = useCallback(async () => {
    if (!address || !walletClient) {
      toast.error('Please connect your wallet first');
      return null;
    }

    if (!routerRef.current) {
      toast.error('Router not initialized. Please wait...');
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
    updateStage('linking-wallet');

    try {
      // Create RouterSigner adapter
      const signer: RouterSigner = createRouterSigner(walletClient, address);
      const userId = `user:${address.toLowerCase()}`;

      console.log('[DomeRouter] Calling router.linkUser with Safe wallet...');
      updateStage('deploying-safe', 'Setting up Safe wallet & deriving API keys...');

      // Use the SDK's linkUser with walletType: 'safe' for external wallets
      const result = await routerRef.current.linkUser({
        userId,
        signer,
        walletType: 'safe',
        autoDeploySafe: true,
        autoSetAllowances: true,
      });

      console.log('[DomeRouter] Link result:', result);

      // Result type depends on wallet type - Safe returns SafeLinkResult, EOA returns PolymarketCredentials
      // For Safe wallets, we get the full result with credentials, safeAddress, signerAddress
      const safeLinkResult = result as {
        credentials: { apiKey: string; apiSecret: string; apiPassphrase: string };
        safeAddress: string;
        signerAddress: string;
        safeDeployed: boolean;
        allowancesSet: number;
      };

      const creds: PolymarketCredentials = {
        apiKey: safeLinkResult.credentials.apiKey,
        apiSecret: safeLinkResult.credentials.apiSecret,
        apiPassphrase: safeLinkResult.credentials.apiPassphrase,
      };

      setCredentials(creds);
      setSafeAddress(safeLinkResult.safeAddress);
      setIsDeployed(true);
      setHasAllowances(safeLinkResult.allowancesSet > 0 || true); // SDK handles allowances
      setIsLinked(true);

      // Save to localStorage
      saveSession({
        safeAddress: safeLinkResult.safeAddress,
        credentials: creds,
        signerAddress: safeLinkResult.signerAddress,
      });

      updateStage('completed', 'Wallet linked successfully!');
      toast.success('Wallet linked to Polymarket!', {
        description: `Safe: ${safeLinkResult.safeAddress.slice(0, 10)}...`
      });

      return result;
    } catch (error: unknown) {
      console.error('[DomeRouter] Link error:', error);
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
   * Place an order using Dome SDK's PolymarketRouter
   * Orders are routed through Dome's servers, bypassing Cloudflare issues
   */
  const placeOrder = useCallback(async (params: TradeParams): Promise<OrderResult> => {
    if (!address || !walletClient) {
      toast.error('Please connect your wallet first');
      return { success: false, error: 'Wallet not connected' };
    }

    if (!routerRef.current) {
      toast.error('Router not initialized');
      return { success: false, error: 'Router not initialized' };
    }

    if (!isLinked || !credentials || !safeAddress) {
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
    updateStage('signing-order');

    try {
      // Normalize price
      const validatedPrice = normalizePrice(params.price);
      const size = params.amount / validatedPrice;

      // Validate minimum order size
      const MIN_ORDER_SIZE = 5;
      if (size < MIN_ORDER_SIZE) {
        throw new Error(`Minimum order size is ${MIN_ORDER_SIZE} shares`);
      }

      console.log('[DomeRouter] Placing order via SDK:', {
        tokenId: params.tokenId,
        side: params.side.toLowerCase(),
        size,
        price: validatedPrice,
        orderType: params.isMarketOrder ? 'FAK' : 'GTC',
        safeAddress,
      });

      // Create RouterSigner adapter
      const signer: RouterSigner = createRouterSigner(walletClient, address);
      const userId = `user:${address.toLowerCase()}`;

      updateStage('submitting-order', 'Signing and submitting order...');

      // Use SDK's placeOrder - orders are routed through Dome servers
      const result = await routerRef.current.placeOrder({
        userId,
        marketId: params.tokenId,
        side: params.side.toLowerCase() as 'buy' | 'sell',
        size,
        price: validatedPrice,
        signer,
        walletType: 'safe',
        funderAddress: safeAddress,
        negRisk: params.negRisk || false,
        orderType: params.isMarketOrder ? 'FAK' : 'GTC',
      }, credentials);

      console.log('[DomeRouter] Order result:', result);

      const orderResult: OrderResult = {
        success: true,
        orderId: result.orderId || result.orderHash,
        result,
      };

      setLastOrderResult(orderResult);
      updateStage('completed');
      
      const status = result.status || 'submitted';
      toast.success(`Order ${status}!`, {
        description: result.orderId 
          ? `Order ID: ${result.orderId.slice(0, 12)}...` 
          : 'Order submitted successfully'
      });

      return orderResult;
    } catch (error: unknown) {
      console.error('[DomeRouter] Order error:', error);
      
      let errorMessage = error instanceof Error ? error.message : 'Failed to place order';
      
      // Handle specific error cases
      if (errorMessage.includes('no match') || errorMessage.includes('No match')) {
        errorMessage = 'No buyers available at this price. Try a limit order instead.';
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid api key') || errorMessage.includes('credentials')) {
        // Clear session and prompt re-link
        clearSession();
        errorMessage = 'Trading session expired. Please link your wallet again.';
      } else if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
        errorMessage = 'Transaction rejected by user.';
      } else if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
        errorMessage = 'Insufficient balance. Please add more USDC.';
      }

      updateStage('error', errorMessage);
      toast.error(errorMessage);

      const result: OrderResult = { success: false, error: errorMessage };
      setLastOrderResult(result);
      return result;
    } finally {
      setIsPlacingOrder(false);
      setTimeout(() => {
        if (tradeStage === 'completed' || tradeStage === 'error') {
          updateStage('idle');
        }
      }, 2000);
    }
  }, [
    address,
    walletClient,
    chainId,
    switchChainAsync,
    isLinked,
    credentials,
    safeAddress,
    clearSession,
    updateStage,
    tradeStage,
  ]);

  /**
   * Check Safe deployment status using SDK
   */
  const checkDeploymentStatus = useCallback(async (): Promise<boolean> => {
    if (!safeAddress || !routerRef.current) return false;
    
    try {
      const deployed = await routerRef.current.isSafeDeployed(safeAddress);
      setIsDeployed(deployed);
      return deployed;
    } catch (e) {
      console.error('[DomeRouter] Status check failed:', e);
      return false;
    }
  }, [safeAddress]);

  return {
    // Connection state
    isConnected,
    address,
    
    // Link state
    isLinking,
    isLinked,
    linkUser,
    clearSession,
    
    // Safe state
    safeAddress,
    isDeployed,
    hasAllowances,
    checkDeploymentStatus,
    
    // Credentials (for external use like fetching positions)
    credentials,
    
    // Trading state
    isPlacingOrder,
    placeOrder,
    lastOrderResult,
    
    // Trade progress
    tradeStage,
    tradeStageMessage,
    
    // API key status
    isDomeReady: !!domeApiKey && !!routerRef.current,
  };
}
