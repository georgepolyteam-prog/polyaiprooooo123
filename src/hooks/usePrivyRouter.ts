import { useState, useCallback, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'privy_polymarket_session_v1';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Trade stage state machine for progress UI
export type TradeStage = 
  | 'idle' 
  | 'linking-wallet'
  | 'signing-order' 
  | 'submitting-order' 
  | 'completed' 
  | 'error';

const TRADE_STAGE_MESSAGES: Record<TradeStage, string> = {
  'idle': '',
  'linking-wallet': 'Linking wallet to Polymarket...',
  'signing-order': 'Signing order...',
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

interface PolymarketCredentials {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
}

interface StoredSession {
  walletAddress: string;
  credentials: PolymarketCredentials;
  privyUserId: string;
  timestamp: number;
}

export function usePrivyRouter() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  
  // State
  const [isLinking, setIsLinking] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [credentials, setCredentials] = useState<PolymarketCredentials | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrderResult, setLastOrderResult] = useState<OrderResult | null>(null);
  const [tradeStage, setTradeStage] = useState<TradeStage>('idle');
  const [tradeStageMessage, setTradeStageMessage] = useState('');

  // Get embedded wallet
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const walletAddress = embeddedWallet?.address;

  // Helper to update trade stage
  const updateStage = useCallback((stage: TradeStage, customMessage?: string) => {
    setTradeStage(stage);
    setTradeStageMessage(customMessage || TRADE_STAGE_MESSAGES[stage]);
  }, []);

  // Load cached session on mount
  useEffect(() => {
    if (!user?.id || !walletAddress) {
      setIsLinked(false);
      setCredentials(null);
      return;
    }

    const cacheKey = `${STORAGE_KEY}:${walletAddress.toLowerCase()}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const session: StoredSession = JSON.parse(cached);
        // Check if session is less than 7 days old
        if (Date.now() - session.timestamp < 7 * 24 * 60 * 60 * 1000) {
          setCredentials(session.credentials);
          setIsLinked(true);
          console.log('[PrivyRouter] Restored session from cache');
        } else {
          localStorage.removeItem(cacheKey);
        }
      } catch (e) {
        console.error('[PrivyRouter] Failed to parse cached session:', e);
        localStorage.removeItem(cacheKey);
      }
    }
  }, [user?.id, walletAddress]);

  // Save session to localStorage
  const saveSession = useCallback((session: Omit<StoredSession, 'timestamp'>) => {
    if (!walletAddress) return;
    const cacheKey = `${STORAGE_KEY}:${walletAddress.toLowerCase()}`;
    localStorage.setItem(cacheKey, JSON.stringify({
      ...session,
      timestamp: Date.now(),
    }));
  }, [walletAddress]);

  // Clear session
  const clearSession = useCallback(() => {
    if (!walletAddress) return;
    const cacheKey = `${STORAGE_KEY}:${walletAddress.toLowerCase()}`;
    localStorage.removeItem(cacheKey);
    setIsLinked(false);
    setCredentials(null);
    toast.success('Trading session cleared');
  }, [walletAddress]);

  /**
   * Link user to Polymarket via Privy server-side signing
   * Uses edge function with Privy authorization key
   */
  const linkUser = useCallback(async () => {
    if (!authenticated || !user?.id || !embeddedWallet) {
      toast.error('Please log in first');
      return null;
    }

    setIsLinking(true);
    updateStage('linking-wallet');

    try {
      console.log('[PrivyRouter] Linking user to Polymarket...');

      // Call edge function to link user (server-side signing)
      const response = await fetch(`${SUPABASE_URL}/functions/v1/privy-link-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          privyUserId: user.id,
          walletAddress: embeddedWallet.address,
          privyWalletId: embeddedWallet.address, // Using address as ID for embedded wallets
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to link wallet');
      }

      const creds: PolymarketCredentials = {
        apiKey: result.credentials.apiKey,
        apiSecret: result.credentials.apiSecret,
        apiPassphrase: result.credentials.apiPassphrase,
      };

      setCredentials(creds);
      setIsLinked(true);

      // Save to localStorage
      saveSession({
        walletAddress: embeddedWallet.address,
        credentials: creds,
        privyUserId: user.id,
      });

      updateStage('completed', 'Wallet linked successfully!');
      toast.success('Wallet linked to Polymarket!');

      return { credentials: creds, walletAddress: embeddedWallet.address };
    } catch (error: unknown) {
      console.error('[PrivyRouter] Link error:', error);
      const message = error instanceof Error ? error.message : 'Failed to link wallet';
      updateStage('error', message);
      toast.error(message);
      return null;
    } finally {
      setIsLinking(false);
      setTimeout(() => updateStage('idle'), 2000);
    }
  }, [authenticated, user?.id, embeddedWallet, saveSession, updateStage]);

  /**
   * Place an order via Privy server-side signing
   */
  const placeOrder = useCallback(async (params: TradeParams): Promise<OrderResult> => {
    if (!authenticated || !user?.id || !embeddedWallet) {
      toast.error('Please log in first');
      return { success: false, error: 'Not authenticated' };
    }

    if (!isLinked || !credentials) {
      toast.error('Please link your wallet first');
      return { success: false, error: 'Wallet not linked' };
    }

    setIsPlacingOrder(true);
    setLastOrderResult(null);

    try {
      updateStage('signing-order');

      // Calculate size (shares) from amount (USDC) and price
      const size = params.amount / params.price;
      const MIN_ORDER_SIZE = 5;
      if (size < MIN_ORDER_SIZE) {
        throw new Error(`Minimum order size is ${MIN_ORDER_SIZE} shares`);
      }

      const orderType = params.isMarketOrder ? 'FOK' : 'GTC';

      console.log('[PrivyRouter] Placing order...', {
        tokenId: params.tokenId,
        price: params.price,
        size,
        side: params.side,
        orderType,
      });

      updateStage('submitting-order', 'Submitting order via Dome...');

      // Call edge function to place order (server-side signing + submission)
      const response = await fetch(`${SUPABASE_URL}/functions/v1/privy-place-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          privyUserId: user.id,
          walletAddress: embeddedWallet.address,
          credentials: {
            apiKey: credentials.apiKey,
            apiSecret: credentials.apiSecret,
            apiPassphrase: credentials.apiPassphrase,
          },
          order: {
            tokenId: params.tokenId,
            side: params.side,
            size,
            price: params.price,
            orderType,
            tickSize: params.tickSize || '0.01',
            negRisk: params.negRisk,
          },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to place order');
      }

      const orderResult: OrderResult = {
        success: true,
        orderId: result.orderId,
        result: result.result,
      };

      setLastOrderResult(orderResult);
      updateStage('completed');
      
      toast.success('Order placed!', {
        description: result.orderId 
          ? `Order ID: ${String(result.orderId).slice(0, 12)}...` 
          : 'Order submitted successfully'
      });

      return orderResult;
    } catch (error: unknown) {
      console.error('[PrivyRouter] Order error:', error);
      const message = error instanceof Error ? error.message : 'Failed to place order';
      updateStage('error', message);
      toast.error(message);
      
      const orderResult: OrderResult = {
        success: false,
        error: message,
      };
      setLastOrderResult(orderResult);
      return orderResult;
    } finally {
      setIsPlacingOrder(false);
      setTimeout(() => updateStage('idle'), 2000);
    }
  }, [authenticated, user?.id, embeddedWallet, isLinked, credentials, updateStage]);

  return {
    // Auth state
    isReady: ready,
    isAuthenticated: authenticated,
    user,
    walletAddress,
    embeddedWallet,
    
    // Auth actions
    login,
    logout,
    
    // Linking state
    isLinked,
    isLinking,
    linkUser,
    credentials,
    
    // Trading state
    isPlacingOrder,
    placeOrder,
    lastOrderResult,
    tradeStage,
    tradeStageMessage,
    
    // Utils
    clearSession,
  };
}
