import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import { 
  PolymarketRouter, 
  type RouterSigner, 
  type PolymarketCredentials,
  type SafeLinkResult,
  type PlaceOrderParams,
  deriveSafeAddress,
} from '@dome-api/sdk';

const POLYGON_CHAIN_ID = 137;
const STORAGE_KEY = 'dome_router_session';
const POLYGON_RPC = 'https://polygon-rpc.com';

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
}

interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  result?: unknown;
}

interface StoredSession {
  safeAddress: string;
  credentials: PolymarketCredentials;
  isDeployed: boolean;
  hasAllowances: boolean;
  timestamp: number;
}

// Normalize price to avoid floating point errors
function normalizePrice(price: number): number {
  const rounded = Math.round(price * 100) / 100;
  return Math.max(0.01, Math.min(0.99, rounded));
}

/**
 * Check if Safe is deployed on-chain
 */
async function checkSafeDeployed(safeAddress: string): Promise<boolean> {
  try {
    const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
    const code = await provider.getCode(safeAddress);
    return code !== '0x' && code !== '0x0';
  } catch (e) {
    console.error('[DomeRouter] Failed to check Safe deployment:', e);
    return false;
  }
}

/**
 * Create a wagmi-compatible RouterSigner from wallet client
 */
function createWagmiSigner(walletClient: any): RouterSigner {
  return {
    async getAddress(): Promise<string> {
      return walletClient.account.address;
    },
    async signTypedData(payload): Promise<string> {
      const signature = await walletClient.signTypedData({
        domain: payload.domain,
        types: payload.types,
        primaryType: payload.primaryType,
        message: payload.message,
      });
      return signature;
    },
  };
}

// Singleton router instance
let routerInstance: PolymarketRouter | null = null;
let routerApiKey: string | null = null;

export function useDomeRouter() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
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
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);

  // Helper to update trade stage
  const updateStage = useCallback((stage: TradeStage, customMessage?: string) => {
    setTradeStage(stage);
    setTradeStageMessage(customMessage || TRADE_STAGE_MESSAGES[stage]);
  }, []);

  // Derive Safe address deterministically
  const derivedSafeAddress = useMemo(() => {
    if (!address) return null;
    try {
      return deriveSafeAddress(address);
    } catch (e) {
      console.error('[DomeRouter] Failed to derive Safe address:', e);
      return null;
    }
  }, [address]);

  // Load API key on mount
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        // Check if we have a cached API key
        const cached = localStorage.getItem('dome_api_key');
        if (cached) {
          routerApiKey = cached;
          setApiKeyLoaded(true);
          return;
        }

        // Fetch from edge function
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-dome-api-key`);
        if (response.ok) {
          const data = await response.json();
          if (data.apiKey) {
            routerApiKey = data.apiKey;
            localStorage.setItem('dome_api_key', data.apiKey);
            setApiKeyLoaded(true);
          }
        }
      } catch (e) {
        console.error('[DomeRouter] Failed to load API key:', e);
      }
    };
    loadApiKey();
  }, []);

  // Get or create router instance
  const getRouter = useCallback((): PolymarketRouter => {
    if (routerInstance && routerApiKey) return routerInstance;
    
    routerInstance = new PolymarketRouter({
      chainId: POLYGON_CHAIN_ID,
      apiKey: routerApiKey || undefined,
    });
    
    return routerInstance;
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
          setIsDeployed(session.isDeployed);
          setHasAllowances(session.hasAllowances);
          setIsLinked(true);
          
          // Update router's internal state
          const router = getRouter();
          router.setCredentials(address, session.credentials);
          router.setSafeAddress(address, session.safeAddress);
          
          console.log('[DomeRouter] Restored session from cache');
        } else {
          // Clear stale session
          localStorage.removeItem(cacheKey);
        }
      } catch (e) {
        console.error('[DomeRouter] Failed to parse cached session:', e);
        localStorage.removeItem(cacheKey);
      }
    }

    // Also set derived Safe address
    if (derivedSafeAddress) {
      setSafeAddress(derivedSafeAddress);
      
      // Check if Safe is deployed
      checkSafeDeployed(derivedSafeAddress).then(deployed => {
        setIsDeployed(deployed);
      }).catch(() => {});
    }
  }, [address, derivedSafeAddress, getRouter]);

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
    localStorage.removeItem('dome_api_key');
    routerInstance = null;
    setIsLinked(false);
    setCredentials(null);
    setHasAllowances(false);
    toast.success('Trading session cleared');
  }, [address]);

  /**
   * Link user to Polymarket using SDK's Safe wallet flow
   * This handles Safe deployment, credentials, and allowances automatically
   */
  const linkUser = useCallback(async () => {
    if (!address || !walletClient) {
      toast.error('Please connect your wallet first');
      return null;
    }

    setIsLinking(true);
    updateStage('linking-wallet');

    try {
      const signer = createWagmiSigner(walletClient);
      const router = getRouter();

      console.log('[DomeRouter] Starting Safe wallet link flow...');
      console.log('[DomeRouter] EOA address:', address);
      console.log('[DomeRouter] Derived Safe:', derivedSafeAddress);

      // Use SDK's linkUser with Safe wallet type
      const result = await router.linkUser({
        userId: address,
        signer,
        walletType: 'safe',
        autoDeploySafe: true,
        autoSetAllowances: true,
      });

      // Type guard for SafeLinkResult
      const safeLinkResult = result as SafeLinkResult;
      
      console.log('[DomeRouter] Link result:', safeLinkResult);

      // Update state
      const creds: PolymarketCredentials = {
        apiKey: safeLinkResult.credentials.apiKey,
        apiSecret: safeLinkResult.credentials.apiSecret,
        apiPassphrase: safeLinkResult.credentials.apiPassphrase,
      };

      setCredentials(creds);
      setSafeAddress(safeLinkResult.safeAddress);
      setIsDeployed(true);
      setHasAllowances(safeLinkResult.allowancesSet > 0 || true);
      setIsLinked(true);

      // Save to localStorage
      saveSession({
        safeAddress: safeLinkResult.safeAddress,
        credentials: creds,
        isDeployed: true,
        hasAllowances: true,
      });

      updateStage('completed', 'Wallet linked successfully!');
      toast.success('Wallet linked to Polymarket!', {
        description: `Safe: ${safeLinkResult.safeAddress.slice(0, 10)}...`
      });

      return safeLinkResult;
    } catch (error: any) {
      console.error('[DomeRouter] Link error:', error);
      updateStage('error', error.message);

      if (error.message?.includes('rejected') || error.code === 4001) {
        toast.error('Signature rejected');
      } else {
        toast.error(error.message || 'Failed to link wallet');
      }

      return null;
    } finally {
      setIsLinking(false);
      setTimeout(() => updateStage('idle'), 2000);
    }
  }, [address, walletClient, derivedSafeAddress, getRouter, saveSession, updateStage]);

  /**
   * Place an order using SDK's placeOrder method
   * Routes through Dome server for execution
   */
  const placeOrder = useCallback(async (params: TradeParams): Promise<OrderResult> => {
    if (!address || !walletClient) {
      toast.error('Please connect your wallet first');
      return { success: false, error: 'Wallet not connected' };
    }

    if (!isLinked || !credentials || !safeAddress) {
      toast.error('Please link your wallet first');
      return { success: false, error: 'Wallet not linked' };
    }

    if (!apiKeyLoaded || !routerApiKey) {
      toast.error('Trading not ready. Please try again.');
      return { success: false, error: 'API key not loaded' };
    }

    setIsPlacingOrder(true);
    setLastOrderResult(null);
    updateStage('signing-order');

    try {
      const signer = createWagmiSigner(walletClient);
      const router = getRouter();

      // Normalize price
      const validatedPrice = normalizePrice(params.price);
      const size = params.amount / validatedPrice;

      // Validate minimum order size
      const MIN_ORDER_SIZE = 5;
      if (size < MIN_ORDER_SIZE) {
        throw new Error(`Minimum order size is ${MIN_ORDER_SIZE} shares`);
      }

      console.log('[DomeRouter] Placing order:', {
        tokenId: params.tokenId,
        side: params.side.toLowerCase(),
        size,
        price: validatedPrice,
        orderType: params.isMarketOrder ? 'FAK' : 'GTC',
        safeAddress,
      });

      // Build order params for SDK
      const orderParams: PlaceOrderParams = {
        userId: address,
        marketId: params.tokenId,
        side: params.side.toLowerCase() as 'buy' | 'sell',
        size,
        price: validatedPrice,
        signer,
        walletType: 'safe',
        funderAddress: safeAddress,
        orderType: params.isMarketOrder ? 'FAK' : 'GTC',
      };

      updateStage('submitting-order');

      // Use SDK's placeOrder which routes through Dome server
      const result = await router.placeOrder(orderParams, credentials);

      console.log('[DomeRouter] Order result:', result);

      // Handle response
      if (result?.error) {
        throw new Error(result.error.message || 'Order failed');
      }

      const orderId = result?.result?.orderId || result?.orderId;
      
      if (!orderId) {
        throw new Error('Order failed - no order ID returned');
      }

      const orderResult: OrderResult = {
        success: true,
        orderId,
        result,
      };

      setLastOrderResult(orderResult);
      updateStage('completed');
      toast.success(`Order placed! ID: ${orderId.slice(0, 12)}...`);

      return orderResult;
    } catch (error: any) {
      console.error('[DomeRouter] Order error:', error);
      
      let errorMessage = error.message || 'Failed to place order';
      
      // Handle specific error cases
      if (errorMessage.includes('no match')) {
        errorMessage = 'No buyers available at this price. Try a limit order instead.';
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid api key')) {
        // Clear session and prompt re-link
        clearSession();
        errorMessage = 'Trading session expired. Please link your wallet again.';
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
    isLinked,
    credentials,
    safeAddress,
    apiKeyLoaded,
    getRouter,
    clearSession,
    updateStage,
    tradeStage,
  ]);

  /**
   * Check if Safe has all required allowances
   */
  const checkAllowances = useCallback(async (): Promise<boolean> => {
    if (!safeAddress) return false;
    
    try {
      const router = getRouter();
      const result = await router.checkSafeAllowances(safeAddress);
      setHasAllowances(result.allSet);
      return result.allSet;
    } catch (e) {
      console.error('[DomeRouter] Allowance check failed:', e);
      return false;
    }
  }, [safeAddress, getRouter]);

  /**
   * Manually set allowances for Safe wallet
   */
  const setAllowancesManually = useCallback(async (): Promise<boolean> => {
    if (!walletClient || !safeAddress) {
      toast.error('Wallet not connected');
      return false;
    }

    try {
      updateStage('setting-allowances');
      const signer = createWagmiSigner(walletClient);
      const router = getRouter();
      
      await router.setSafeAllowances(signer, (step) => {
        console.log('[DomeRouter] Allowance step:', step);
      });

      setHasAllowances(true);
      updateStage('completed', 'Allowances set!');
      toast.success('Token allowances set!');
      return true;
    } catch (e: any) {
      console.error('[DomeRouter] Set allowances failed:', e);
      updateStage('error', e.message);
      toast.error(e.message || 'Failed to set allowances');
      return false;
    } finally {
      setTimeout(() => updateStage('idle'), 2000);
    }
  }, [walletClient, safeAddress, getRouter, updateStage]);

  return {
    // State
    isConnected,
    address,
    isLinked,
    isLinking,
    safeAddress: safeAddress || derivedSafeAddress,
    isDeployed,
    hasAllowances,
    credentials,
    isPlacingOrder,
    lastOrderResult,
    tradeStage,
    tradeStageMessage,
    
    // Actions
    linkUser,
    placeOrder,
    checkAllowances,
    setAllowances: setAllowancesManually,
    clearSession,
    
    // Router access (for advanced use)
    getRouter,
  };
}
