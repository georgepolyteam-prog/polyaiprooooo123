import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { toast } from 'sonner';
import { PolymarketRouter, deriveSafeAddress, isSafeDeployed, getPolygonProvider } from '@dome-api/sdk';
import type { RouterSigner, PolymarketCredentials as DomeCredentials, SafeLinkResult } from '@dome-api/sdk';

const POLYGON_CHAIN_ID = 137;
const STORAGE_KEY = 'dome_router_session_v8'; // Bump version for SDK migration

// Trade stage state machine for progress UI
export type TradeStage = 
  | 'idle' 
  | 'switching-network' 
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
  'linking-wallet': 'Setting up trading account...',
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
  safeAddress: string;
  credentials: PolymarketCredentials;
  signerAddress: string;
  timestamp: number;
}

/**
 * Create RouterSigner adapter from wagmi walletClient
 * This bridges wagmi's wallet client to the Dome SDK's expected signer interface
 */
function createRouterSigner(walletClient: any, address: string): RouterSigner {
  return {
    getAddress: async () => address,
    signTypedData: async (payload: any) => {
      return walletClient.signTypedData({
        domain: payload.domain,
        types: payload.types,
        primaryType: payload.primaryType,
        message: payload.message,
      });
    },
  };
}

/**
 * Dome Router Hook - Uses PolymarketRouter from @dome-api/sdk
 * 
 * Handles:
 * - Safe wallet derivation, deployment, and allowances (automatically)
 * - API credential creation (single signature)
 * - Order placement via Dome API
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
  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [isDeployed, setIsDeployed] = useState(false);
  const [hasAllowances, setHasAllowances] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrderResult, setLastOrderResult] = useState<OrderResult | null>(null);
  const [tradeStage, setTradeStage] = useState<TradeStage>('idle');
  const [tradeStageMessage, setTradeStageMessage] = useState('');

  // Create PolymarketRouter instance (memoized)
  // Note: We don't have the API key client-side, so placeOrder will go through edge function
  const router = useMemo(() => new PolymarketRouter({ 
    chainId: POLYGON_CHAIN_ID,
  }), []);

  // Helper to update trade stage
  const updateStage = useCallback((stage: TradeStage, customMessage?: string) => {
    setTradeStage(stage);
    setTradeStageMessage(customMessage || TRADE_STAGE_MESSAGES[stage]);
  }, []);

  // Derive Safe address when wallet connects
  useEffect(() => {
    if (!address) {
      setSafeAddress(null);
      return;
    }
    
    try {
      const derived = deriveSafeAddress(address);
      setSafeAddress(derived);
      console.log('[DomeRouter] Derived Safe address:', derived, 'from EOA:', address);
    } catch (e) {
      console.error('[DomeRouter] Failed to derive Safe address:', e);
    }
  }, [address]);

  // Check Safe deployment status when address changes
  useEffect(() => {
    if (!safeAddress) {
      setIsDeployed(false);
      return;
    }
    
    // Check cached status first
    const cached = localStorage.getItem(`safe_deployed:${safeAddress.toLowerCase()}`);
    if (cached === 'true') {
      setIsDeployed(true);
    }
    
    // Verify on-chain using Polygon provider
    const provider = getPolygonProvider();
    isSafeDeployed(safeAddress, provider).then(deployed => {
      setIsDeployed(deployed);
      if (deployed) {
        localStorage.setItem(`safe_deployed:${safeAddress.toLowerCase()}`, 'true');
      }
      console.log('[DomeRouter] Safe deployment status:', deployed);
    }).catch(e => {
      console.error('[DomeRouter] Failed to check Safe deployment:', e);
    });
  }, [safeAddress]);

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
          setSafeAddress(session.safeAddress);
          setIsLinked(true);
          setHasAllowances(true); // Assume allowances are set if we have a cached session
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

  // Load cached allowances status
  useEffect(() => {
    if (safeAddress) {
      const cached = localStorage.getItem(`safe_allowances:${safeAddress.toLowerCase()}`);
      if (cached === 'true') {
        setHasAllowances(true);
      }
    }
  }, [safeAddress]);

  // Save session to localStorage
  const saveSession = useCallback((session: Omit<StoredSession, 'timestamp'>) => {
    if (!address) return;
    const cacheKey = `${STORAGE_KEY}:${address.toLowerCase()}`;
    localStorage.setItem(cacheKey, JSON.stringify({
      ...session,
      timestamp: Date.now(),
    }));
  }, [address]);

  // Clear session - nuclear option to wipe all cached credentials
  const clearSession = useCallback(() => {
    if (!address) return;
    
    const cacheKey = `${STORAGE_KEY}:${address.toLowerCase()}`;
    localStorage.removeItem(cacheKey);
    
    // Also clear Safe-specific caches
    if (safeAddress) {
      localStorage.removeItem(`safe_deployed:${safeAddress.toLowerCase()}`);
      localStorage.removeItem(`safe_allowances:${safeAddress.toLowerCase()}`);
    }
    
    // Nuclear option: Clear everything
    try {
      console.log('[DomeRouter] Performing nuclear clear...');
      localStorage.clear();
      sessionStorage.clear();
      ['dome', 'dome_router', 'polymarket'].forEach(dbName => {
        indexedDB.deleteDatabase(dbName);
      });
      console.log('[DomeRouter] All storage cleared');
    } catch (error) {
      console.error('[DomeRouter] Error during nuclear clear:', error);
    }
    
    setIsLinked(false);
    setCredentials(null);
    setHasAllowances(false);
    setIsDeployed(false);
    
    toast.success('All credentials cleared - please refresh and re-link', {
      description: 'Cleared localStorage, sessionStorage, and IndexedDB'
    });
  }, [address, safeAddress]);

  /**
   * Link user using PolymarketRouter
   * Handles Safe deployment, allowances, and credential creation automatically
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
      console.log('[DomeRouter] Starting wallet link with PolymarketRouter...');
      console.log('[DomeRouter] EOA address:', address);

      updateStage('linking-wallet', 'Setting up trading account...');

      // Create RouterSigner adapter
      const signer = createRouterSigner(walletClient, address);

      // PolymarketRouter handles EVERYTHING:
      // - Safe address derivation
      // - Safe deployment (if needed)
      // - Allowance setting
      // - Credential creation
      // - Signature type management (internally)
      const result = await router.linkUser({
        userId: address,
        signer,
        walletType: 'safe',
        autoDeploySafe: true,
        autoSetAllowances: true,
      }) as SafeLinkResult;

      console.log('[DomeRouter] Link successful:', {
        safeAddress: result.safeAddress,
        hasCredentials: !!result.credentials,
        safeDeployed: result.safeDeployed,
        allowancesSet: result.allowancesSet,
      });

      const creds: PolymarketCredentials = {
        apiKey: result.credentials.apiKey,
        apiSecret: result.credentials.apiSecret,
        apiPassphrase: result.credentials.apiPassphrase,
      };

      setCredentials(creds);
      setSafeAddress(result.safeAddress);
      setIsLinked(true);
      setIsDeployed(true);
      setHasAllowances(result.allowancesSet > 0 || true);

      // Cache deployment and allowances
      localStorage.setItem(`safe_deployed:${result.safeAddress.toLowerCase()}`, 'true');
      localStorage.setItem(`safe_allowances:${result.safeAddress.toLowerCase()}`, 'true');

      // Save to localStorage
      saveSession({
        safeAddress: result.safeAddress,
        credentials: creds,
        signerAddress: address,
      });

      updateStage('completed', 'Wallet setup complete!');
      toast.success('Wallet linked to Polymarket!', {
        description: `Safe: ${result.safeAddress.slice(0, 10)}...`
      });

      return { credentials: creds, safeAddress: result.safeAddress };
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
  }, [address, walletClient, chainId, switchChainAsync, router, saveSession, updateStage]);

  /**
   * Place order using PolymarketRouter via edge function
   * Signs order client-side, submits via edge function with DOME_API_KEY
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
      updateStage('signing-order');

      // Calculate size from amount and price
      const size = params.amount / Math.max(params.price, 0.01);
      const orderType = params.isMarketOrder ? 'FOK' : 'GTC';

      console.log('[DomeRouter] Placing order with PolymarketRouter...');
      console.log('[DomeRouter] Order params:', {
        tokenId: params.tokenId,
        side: params.side,
        size,
        price: params.price,
        isMarketOrder: params.isMarketOrder,
        orderType,
        safeAddress,
      });

      // Create RouterSigner
      const signer = createRouterSigner(walletClient, address);

      updateStage('submitting-order');

      // Convert credentials to Dome format
      const domeCredentials: DomeCredentials = {
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        apiPassphrase: credentials.apiPassphrase,
      };

      // Use PolymarketRouter to place order
      // This handles signature type, order signing, and submission via Dome API
      const result = await router.placeOrder(
        {
          userId: address,
          marketId: params.tokenId,
          side: params.side.toLowerCase() as 'buy' | 'sell',
          size: size,
          price: params.price,
          orderType: orderType as 'GTC' | 'FOK',
          signer,
          walletType: 'safe',
          funderAddress: safeAddress,
          negRisk: params.negRisk ?? false,
        },
        domeCredentials
      );

      console.log('[DomeRouter] Order placed:', result);

      updateStage('completed');
      
      const orderId = result?.orderId || result?.order_id;
      toast.success('Order placed successfully!', {
        description: orderId 
          ? `Order ID: ${String(orderId).slice(0, 12)}...` 
          : 'Order submitted successfully'
      });

      const orderResult: OrderResult = {
        success: true,
        orderId,
        result,
      };

      setLastOrderResult(orderResult);
      return orderResult;
    } catch (error: unknown) {
      console.error('[DomeRouter] Order error:', error);
      
      let errorMessage = error instanceof Error ? error.message : 'Failed to place order';
      
      // Handle specific error cases
      if (errorMessage.includes('no match') || errorMessage.includes('No match')) {
        errorMessage = 'No buyers available at this price. Try a limit order instead.';
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid api key') || errorMessage.includes('credentials')) {
        clearSession();
        errorMessage = 'Trading session expired. Please link your wallet again.';
      } else if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
        errorMessage = 'Transaction rejected by user.';
      } else if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
        errorMessage = 'Insufficient balance. Please add more USDC to your Safe.';
      } else if (errorMessage.includes('API key') || errorMessage.includes('apiKey')) {
        errorMessage = 'Dome API not configured. Please contact support.';
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
    router,
    clearSession,
    updateStage,
    tradeStage,
  ]);

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
    
    // Credentials (for external use like fetching positions)
    credentials,
    
    // Order state
    isPlacingOrder,
    lastOrderResult,
    placeOrder,
    
    // Progress state
    tradeStage,
    tradeStageMessage,
    
    // Dome is always ready (SDK loaded)
    isDomeReady: true,
  };
}
