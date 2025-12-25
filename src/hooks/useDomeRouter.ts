import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { toast } from 'sonner';
import { ethers } from 'ethers';

const POLYGON_CHAIN_ID = 137;
const STORAGE_KEY = 'dome_router_session';
const POLYGON_RPC = 'https://polygon-rpc.com';
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
 * Call the dome-router edge function
 */
async function callDomeRouter(action: string, payload: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/dome-router`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  
  return data;
}

/**
 * Derive Safe address using edge function
 */
async function deriveSafeAddress(eoaAddress: string): Promise<string> {
  const result = await callDomeRouter('derive_safe', { address: eoaAddress }) as { safeAddress: string };
  return result.safeAddress;
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

  // Helper to update trade stage
  const updateStage = useCallback((stage: TradeStage, customMessage?: string) => {
    setTradeStage(stage);
    setTradeStageMessage(customMessage || TRADE_STAGE_MESSAGES[stage]);
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

    // Derive Safe address from edge function
    deriveSafeAddress(address).then(derived => {
      setSafeAddress(derived);
      // Check if Safe is deployed
      checkSafeDeployed(derived).then(deployed => {
        setIsDeployed(deployed);
      }).catch(() => {});
    }).catch(e => {
      console.error('[DomeRouter] Failed to derive Safe address:', e);
    });
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
    toast.success('Trading session cleared');
  }, [address]);

  /**
   * Link user to Polymarket via edge function
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
    updateStage('linking-wallet');

    try {
      // Generate nonce and timestamp
      const nonce = Math.random().toString(36).substring(2, 15);
      const timestamp = Date.now();
      
      // Create message to sign
      const message = `Link wallet to Polymarket\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
      
      // Sign the message
      const signature = await walletClient.signMessage({ 
        account: address as `0x${string}`,
        message,
      });
      
      console.log('[DomeRouter] Calling link endpoint...');

      // Call edge function to link
      const result = await callDomeRouter('link', {
        address,
        signature,
        nonce,
        timestamp,
      }) as {
        safeAddress: string;
        credentials: PolymarketCredentials;
        isDeployed: boolean;
        allowancesSet: number;
      };

      console.log('[DomeRouter] Link result:', result);

      // Update state
      setCredentials(result.credentials);
      setSafeAddress(result.safeAddress);
      setIsDeployed(true);
      setHasAllowances(result.allowancesSet > 0);
      setIsLinked(true);

      // Save to localStorage
      saveSession({
        safeAddress: result.safeAddress,
        credentials: result.credentials,
        isDeployed: true,
        hasAllowances: true,
      });

      updateStage('completed', 'Wallet linked successfully!');
      toast.success('Wallet linked to Polymarket!', {
        description: `Safe: ${result.safeAddress.slice(0, 10)}...`
      });

      return result;
    } catch (error: unknown) {
      console.error('[DomeRouter] Link error:', error);
      const message = error instanceof Error ? error.message : 'Failed to link wallet';
      updateStage('error', message);

      if (message.includes('rejected') || message.includes('denied')) {
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
   * Place an order via edge function
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

      console.log('[DomeRouter] Placing order:', {
        tokenId: params.tokenId,
        side: params.side.toLowerCase(),
        size,
        price: validatedPrice,
        orderType: params.isMarketOrder ? 'FAK' : 'GTC',
        safeAddress,
      });

      // Create order message to sign
      const orderMessage = JSON.stringify({
        tokenId: params.tokenId,
        side: params.side.toLowerCase(),
        size,
        price: validatedPrice,
        timestamp: Date.now(),
      });

      // Sign the order
      const signature = await walletClient.signMessage({ 
        account: address as `0x${string}`,
        message: orderMessage,
      });
      updateStage('submitting-order');

      // Call edge function to place order
      const result = await callDomeRouter('place_order', {
        address,
        safeAddress,
        tokenId: params.tokenId,
        side: params.side.toLowerCase(),
        size,
        price: validatedPrice,
        orderType: params.isMarketOrder ? 'FAK' : 'GTC',
        signature,
        credentials,
      }) as { orderId: string };

      console.log('[DomeRouter] Order result:', result);

      const orderResult: OrderResult = {
        success: true,
        orderId: result.orderId,
        result,
      };

      setLastOrderResult(orderResult);
      updateStage('completed');
      toast.success(`Order placed! ID: ${result.orderId.slice(0, 12)}...`);

      return orderResult;
    } catch (error: unknown) {
      console.error('[DomeRouter] Order error:', error);
      
      let errorMessage = error instanceof Error ? error.message : 'Failed to place order';
      
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
   * Check Safe deployment status
   */
  const checkDeploymentStatus = useCallback(async (): Promise<boolean> => {
    if (!address || !safeAddress) return false;
    
    try {
      const result = await callDomeRouter('check_status', { address, safeAddress }) as { isDeployed: boolean };
      setIsDeployed(result.isDeployed);
      return result.isDeployed;
    } catch (e) {
      console.error('[DomeRouter] Status check failed:', e);
      return false;
    }
  }, [address, safeAddress]);

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
  };
}
