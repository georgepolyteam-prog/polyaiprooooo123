import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { toast } from 'sonner';
import { 
  PolymarketRouter, 
  RouterSigner, 
  Eip712Payload,
  PolymarketCredentials,
  SafeLinkResult 
} from '@dome-api/sdk';
import { useSafeWallet } from './useSafeWallet';
import { supabase } from '@/integrations/supabase/client';
import type { WalletClient } from 'viem';

const POLYGON_CHAIN_ID = 137;
const STORAGE_KEY = 'dome_router_session_v4'; // Bump version to clear old cached credentials

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
  tickSize?: '0.1' | '0.01' | '0.001' | '0.0001';
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
  signerAddress: string;
  timestamp: number;
}

/**
 * Create a RouterSigner adapter from wagmi walletClient
 * This adapter works with Dome SDK's PolymarketRouter
 */
function createRouterSigner(walletClient: WalletClient, address: `0x${string}`): RouterSigner {
  return {
    async getAddress(): Promise<string> {
      return address;
    },
    
    async signTypedData(payload: Eip712Payload): Promise<string> {
      console.log('[RouterSigner] Signing EIP-712 payload:', {
        primaryType: payload.primaryType,
        domain: payload.domain,
      });
      
      // Convert domain to proper format for wagmi
      const domainForWagmi = {
        name: payload.domain.name,
        version: payload.domain.version,
        chainId: typeof payload.domain.chainId === 'bigint' 
          ? Number(payload.domain.chainId) 
          : payload.domain.chainId,
        verifyingContract: payload.domain.verifyingContract as `0x${string}` | undefined,
      };
      
      const signature = await walletClient.signTypedData({
        account: address,
        domain: domainForWagmi,
        types: payload.types,
        primaryType: payload.primaryType,
        message: payload.message,
      });
      
      console.log('[RouterSigner] Signature obtained:', signature.slice(0, 20) + '...');
      return signature;
    },
  };
}

export function useDomeRouter() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  
  // Use useSafeWallet for Safe operations (deployment check, address derivation)
  const { 
    safeAddress: derivedSafeAddress,
    isDeployed: safeIsDeployed,
    deploySafe,
    hasAllowances: safeHasAllowances,
    setAllowances,
    isDeploying,
    isSettingAllowances,
    checkDeployment,
  } = useSafeWallet();
  
  // State
  const [isLinking, setIsLinking] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [credentials, setCredentials] = useState<PolymarketCredentials | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrderResult, setLastOrderResult] = useState<OrderResult | null>(null);
  const [tradeStage, setTradeStage] = useState<TradeStage>('idle');
  const [tradeStageMessage, setTradeStageMessage] = useState('');
  
  // Lazy-initialize the router (only on first use)
  const routerRef = useRef<PolymarketRouter | null>(null);
  
  const getRouter = useCallback(() => {
    if (!routerRef.current) {
      console.log('[DomeRouter] Initializing PolymarketRouter...');
      routerRef.current = new PolymarketRouter({
        chainId: POLYGON_CHAIN_ID,
        // Note: apiKey is only needed for server-side placeOrder
        // We use edge function for that, so no apiKey needed here
      });
    }
    return routerRef.current;
  }, []);

  // Use derived Safe address from useSafeWallet
  const safeAddress = derivedSafeAddress;

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
          
          // Sync credentials with router
          const router = getRouter();
          router.setCredentials(address, session.credentials);
          if (session.safeAddress) {
            router.setSafeAddress(address, session.safeAddress);
          }
        } else {
          localStorage.removeItem(cacheKey);
        }
      } catch (e) {
        console.error('[DomeRouter] Failed to parse cached session:', e);
        localStorage.removeItem(cacheKey);
      }
    }
  }, [address, getRouter]);

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
    toast.success('Trading session cleared');
  }, [address]);

  /**
   * Link user to Polymarket using Dome SDK's PolymarketRouter
   * Uses router.linkUser() which handles Safe deployment, allowances, and credential creation
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
      if (!safeAddress) {
        throw new Error('Failed to derive Safe address');
      }

      console.log('[DomeRouter] Starting wallet link with PolymarketRouter...');
      console.log('[DomeRouter] EOA (signer):', address);
      console.log('[DomeRouter] Safe (funder):', safeAddress);

      // Create RouterSigner adapter for wagmi
      const signer = createRouterSigner(walletClient, address);
      
      // Get the router instance
      const router = getRouter();

      updateStage('linking-wallet', 'Please sign in your wallet...');

      // Use Dome SDK's linkUser with Safe wallet type
      // This handles: Safe deployment check, allowances, and credential creation
      console.log('[DomeRouter] Calling router.linkUser() with walletType: safe...');
      
      const result = await router.linkUser({
        userId: address, // Use address as userId for now
        signer,
        walletType: 'safe', // Use Safe wallet (external wallet like MetaMask)
        autoDeploySafe: true, // Let router handle Safe deployment
        autoSetAllowances: true, // Let router handle allowances
      });

      console.log('[DomeRouter] linkUser result:', result);

      // Handle SafeLinkResult (returned when using walletType: 'safe')
      let creds: PolymarketCredentials;
      let resultSafeAddress = safeAddress;
      
      if ('safeAddress' in result) {
        // SafeLinkResult
        const safeLinkResult = result as SafeLinkResult;
        creds = {
          apiKey: safeLinkResult.credentials.apiKey,
          apiSecret: safeLinkResult.credentials.apiSecret,
          apiPassphrase: safeLinkResult.credentials.apiPassphrase,
        };
        resultSafeAddress = safeLinkResult.safeAddress;
        
        console.log('[DomeRouter] Safe link completed:', {
          safeAddress: resultSafeAddress,
          safeDeployed: safeLinkResult.safeDeployed,
          allowancesSet: safeLinkResult.allowancesSet,
          hasCredentials: !!creds.apiKey,
        });
      } else {
        // PolymarketCredentials (returned when using walletType: 'eoa')
        creds = result as PolymarketCredentials;
        console.log('[DomeRouter] EOA credentials obtained:', {
          hasKey: !!creds.apiKey,
        });
      }

      if (!creds?.apiKey || !creds?.apiSecret || !creds?.apiPassphrase) {
        throw new Error('Invalid credentials returned from router');
      }

      setCredentials(creds);
      setIsLinked(true);

      // Save to localStorage
      saveSession({
        safeAddress: resultSafeAddress,
        credentials: creds,
        signerAddress: address,
      });

      updateStage('completed', 'Wallet setup complete!');
      toast.success('Wallet linked to Polymarket!', {
        description: `Safe: ${resultSafeAddress.slice(0, 10)}...`
      });

      return { credentials: creds, safeAddress: resultSafeAddress };
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
  }, [address, walletClient, chainId, switchChainAsync, safeAddress, saveSession, updateStage, getRouter]);

  /**
   * Place an order using Dome SDK's PolymarketRouter
   * Signs the order client-side, then submits via edge function to Dome API
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
      // Check Safe deployment first (using useSafeWallet state)
      if (!safeIsDeployed) {
        updateStage('deploying-safe');
        toast.info('Deploying Safe wallet...');
        const deployed = await deploySafe();
        if (!deployed) {
          throw new Error('Failed to deploy Safe wallet');
        }
      }

      // Check allowances (using useSafeWallet state)
      if (!safeHasAllowances) {
        updateStage('setting-allowances');
        toast.info('Setting token allowances...');
        const success = await setAllowances();
        if (!success) {
          throw new Error('Failed to set token allowances');
        }
      }

      updateStage('signing-order');

      // Calculate size (shares) from amount (USDC) and price
      const size = params.amount / params.price;
      const MIN_ORDER_SIZE = 5;
      if (size < MIN_ORDER_SIZE) {
        throw new Error(`Minimum order size is ${MIN_ORDER_SIZE} shares`);
      }

      const orderType = params.isMarketOrder ? 'FOK' : 'GTC';

      console.log('[DomeRouter] Creating order with PolymarketRouter...');
      console.log('[DomeRouter] Order params:', {
        tokenId: params.tokenId,
        price: params.price,
        size,
        side: params.side,
        negRisk: params.negRisk,
        orderType,
        funderAddress: safeAddress,
      });

      // Create RouterSigner adapter
      const signer = createRouterSigner(walletClient, address);
      
      // Get the router instance
      const router = getRouter();

      // Ensure credentials are set in the router
      router.setCredentials(address, credentials);
      router.setSafeAddress(address, safeAddress);

      // Use router.placeOrder with Safe wallet configuration
      // The router handles: order signing with builder-signer, and submission to Dome API
      const orderResult = await router.placeOrder({
        userId: address,
        marketId: params.tokenId, // tokenId is the market identifier
        side: params.side.toLowerCase() as 'buy' | 'sell',
        size,
        price: params.price,
        signer,
        walletType: 'safe',
        funderAddress: safeAddress, // CRITICAL: This is the Safe address that holds funds
        negRisk: params.negRisk ?? false,
        orderType,
      }, credentials);

      console.log('[DomeRouter] Order placed via router:', orderResult);

      updateStage('completed');
      
      const orderId = orderResult?.orderId || orderResult?.result?.orderId;
      toast.success('Order placed via Dome!', {
        description: orderId 
          ? `Order ID: ${String(orderId).slice(0, 12)}...` 
          : 'Order submitted successfully'
      });

      const result: OrderResult = {
        success: true,
        orderId,
        result: orderResult,
      };

      setLastOrderResult(result);
      return result;
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
        errorMessage = 'Insufficient balance. Please add more USDC.';
      } else if (errorMessage.includes('Dome API key not configured') || errorMessage.includes('Dome API not configured')) {
        errorMessage = 'Dome routing not available. Please contact support.';
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
    safeIsDeployed,
    safeHasAllowances,
    deploySafe,
    setAllowances,
    clearSession,
    updateStage,
    tradeStage,
    getRouter,
  ]);

  /**
   * Check Safe deployment status (delegates to useSafeWallet)
   */
  const checkDeploymentStatus = useCallback(async (): Promise<boolean> => {
    if (!safeAddress || !address) return false;
    return checkDeployment();
  }, [safeAddress, address, checkDeployment]);

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
    isDeployed: safeIsDeployed,
    hasAllowances: safeHasAllowances,
    checkDeploymentStatus,
    isDeploying,
    isSettingAllowances,
    setAllowances, // Expose for retry UI
    deploySafe, // Expose for retry UI
    
    // Credentials (for external use like fetching positions)
    credentials,
    
    // Trading state
    isPlacingOrder,
    placeOrder,
    lastOrderResult,
    
    // Trade progress
    tradeStage,
    tradeStageMessage,
    
    // Always ready since we use edge functions
    isDomeReady: true,
  };
}
