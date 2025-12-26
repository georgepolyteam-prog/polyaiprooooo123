import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { toast } from 'sonner';
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder/derive';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';
import { useSafeWallet } from './useSafeWallet';

const POLYGON_CHAIN_ID = 137;
const STORAGE_KEY = 'dome_router_session_v2';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Polymarket CTF Exchange contract address
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';

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

// Generate random salt for order uniqueness
function generateSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// EIP-712 domain and types for Polymarket L1 auth
const L1_AUTH_DOMAIN = {
  name: 'ClobAuthDomain',
  version: '1',
  chainId: POLYGON_CHAIN_ID,
} as const;

const L1_AUTH_TYPES = {
  ClobAuth: [
    { name: 'address', type: 'address' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'message', type: 'string' },
  ],
} as const;

// EIP-712 domain and types for Polymarket Order signing
const ORDER_DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: POLYGON_CHAIN_ID,
  verifyingContract: CTF_EXCHANGE as `0x${string}`,
} as const;

const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
} as const;

// Signature types
const SIGNATURE_TYPE_POLY_GNOSIS_SAFE = 2;

// Order sides
const ORDER_SIDE_BUY = 0;
const ORDER_SIDE_SELL = 1;

export function useDomeRouter() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  
  // Use useSafeWallet for Safe operations
  const { 
    safeAddress: derivedSafeAddress,
    isDeployed: safeIsDeployed,
    deploySafe,
    hasAllowances: safeHasAllowances,
    setAllowances,
    isDeploying,
    isSettingAllowances,
  } = useSafeWallet();
  
  // State
  const [isLinking, setIsLinking] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [credentials, setCredentials] = useState<PolymarketCredentials | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrderResult, setLastOrderResult] = useState<OrderResult | null>(null);
  const [tradeStage, setTradeStage] = useState<TradeStage>('idle');
  const [tradeStageMessage, setTradeStageMessage] = useState('');

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
    toast.success('Trading session cleared');
  }, [address]);

  /**
   * Link user to Polymarket via EIP-712 signature
   * Creates/derives API credentials through edge function
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
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = '0';
      const message = 'This message attests that I control the given wallet';

      console.log('[DomeRouter] Signing EIP-712 auth message...');

      // Sign EIP-712 typed data for L1 auth
      const signature = await walletClient.signTypedData({
        account: address,
        domain: L1_AUTH_DOMAIN,
        types: L1_AUTH_TYPES,
        primaryType: 'ClobAuth',
        message: {
          address: address,
          timestamp: timestamp,
          nonce: BigInt(nonce),
          message: message,
        },
      });

      console.log('[DomeRouter] Signature obtained, calling edge function...');
      updateStage('deploying-safe', 'Creating API credentials...');

      // Call edge function to create/derive credentials
      const response = await fetch(`${SUPABASE_URL}/functions/v1/builder-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'l1_create_or_derive_api_creds',
          address,
          signature,
          timestamp,
          nonce,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[DomeRouter] Edge function error:', error);
        throw new Error('Failed to create API credentials');
      }

      const data = await response.json();
      console.log('[DomeRouter] Edge function response:', data);

      if (!data.creds) {
        throw new Error('No credentials returned');
      }

      const creds: PolymarketCredentials = {
        apiKey: data.creds.apiKey,
        apiSecret: data.creds.secret,
        apiPassphrase: data.creds.passphrase,
      };

      if (!safeAddress) {
        throw new Error('Failed to derive Safe address');
      }

      setCredentials(creds);
      setIsLinked(true);

      // Save to localStorage
      saveSession({
        safeAddress,
        credentials: creds,
        signerAddress: address,
      });

      updateStage('completed', 'Wallet linked successfully!');
      toast.success('Wallet linked to Polymarket!', {
        description: `Safe: ${safeAddress.slice(0, 10)}...`
      });

      return { credentials: creds, safeAddress };
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
  }, [address, walletClient, chainId, switchChainAsync, safeAddress, saveSession, updateStage]);

  /**
   * Build and sign an order client-side, then submit via edge function
   * Uses signatureType=2 (POLY_GNOSIS_SAFE) with Safe address as maker/funder
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
      // Check Safe deployment first
      if (!safeIsDeployed) {
        updateStage('deploying-safe');
        toast.info('Deploying Safe wallet...');
        const deployed = await deploySafe();
        if (!deployed) {
          throw new Error('Failed to deploy Safe wallet');
        }
      }

      // Check allowances
      if (!safeHasAllowances) {
        updateStage('setting-allowances');
        toast.info('Setting token allowances...');
        const success = await setAllowances();
        if (!success) {
          throw new Error('Failed to set token allowances');
        }
      }

      updateStage('signing-order');

      // Normalize price and calculate amounts
      const validatedPrice = normalizePrice(params.price);
      const size = params.amount / validatedPrice;

      // Validate minimum order size
      const MIN_ORDER_SIZE = 5;
      if (size < MIN_ORDER_SIZE) {
        throw new Error(`Minimum order size is ${MIN_ORDER_SIZE} shares`);
      }

      // Calculate maker and taker amounts (in wei, 6 decimals for USDC)
      const side = params.side === 'BUY' ? ORDER_SIDE_BUY : ORDER_SIDE_SELL;
      
      // For USDC amounts (6 decimals)
      const USDC_DECIMALS = 6;
      const sizeInWei = BigInt(Math.floor(size * 10 ** USDC_DECIMALS));
      const priceScaled = BigInt(Math.floor(validatedPrice * 10 ** USDC_DECIMALS));
      
      let makerAmount: bigint;
      let takerAmount: bigint;
      
      if (side === ORDER_SIDE_BUY) {
        // Buying: maker gives USDC, taker gives tokens
        makerAmount = (sizeInWei * priceScaled) / BigInt(10 ** USDC_DECIMALS);
        takerAmount = sizeInWei;
      } else {
        // Selling: maker gives tokens, taker gives USDC
        makerAmount = sizeInWei;
        takerAmount = (sizeInWei * priceScaled) / BigInt(10 ** USDC_DECIMALS);
      }

      // Build order
      const salt = generateSalt();
      const expiration = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24); // 24 hours
      const nonce = BigInt(0);
      const feeRateBps = BigInt(0);

      // Use correct exchange for neg risk markets
      const exchange = params.negRisk ? NEG_RISK_CTF_EXCHANGE : CTF_EXCHANGE;
      const orderDomain = {
        ...ORDER_DOMAIN,
        verifyingContract: exchange as `0x${string}`,
      };

      const order = {
        salt: BigInt(salt),
        maker: safeAddress as `0x${string}`, // Safe is the maker (holds funds)
        signer: address as `0x${string}`, // EOA signs on behalf of Safe
        taker: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Any taker
        tokenId: BigInt(params.tokenId),
        makerAmount,
        takerAmount,
        expiration,
        nonce,
        feeRateBps,
        side,
        signatureType: SIGNATURE_TYPE_POLY_GNOSIS_SAFE, // Safe wallet signature
      };

      console.log('[DomeRouter] Signing order with signatureType=2 (Safe):', {
        maker: order.maker,
        signer: order.signer,
        tokenId: params.tokenId,
        side: params.side,
        makerAmount: makerAmount.toString(),
        takerAmount: takerAmount.toString(),
      });

      // Sign the order with EIP-712
      const signature = await walletClient.signTypedData({
        account: address,
        domain: orderDomain,
        types: ORDER_TYPES,
        primaryType: 'Order',
        message: order,
      });

      console.log('[DomeRouter] Order signed, submitting to edge function...');
      updateStage('submitting-order', 'Submitting order...');

      // Build signed order for API
      const signedOrder = {
        salt: salt,
        maker: safeAddress,
        signer: address,
        taker: '0x0000000000000000000000000000000000000000',
        tokenId: params.tokenId,
        makerAmount: makerAmount.toString(),
        takerAmount: takerAmount.toString(),
        expiration: expiration.toString(),
        nonce: nonce.toString(),
        feeRateBps: feeRateBps.toString(),
        side,
        signatureType: SIGNATURE_TYPE_POLY_GNOSIS_SAFE,
        signature,
      };

      // Submit to edge function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/dome-router`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place_order',
          signedOrder,
          orderType: params.isMarketOrder ? 'FAK' : 'GTC',
          credentials,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to place order');
      }

      console.log('[DomeRouter] Order result:', data);

      const orderResult: OrderResult = {
        success: true,
        orderId: data.orderId,
        result: data,
      };

      setLastOrderResult(orderResult);
      updateStage('completed');
      
      toast.success('Order placed!', {
        description: data.orderId 
          ? `Order ID: ${data.orderId.slice(0, 12)}...` 
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
    safeIsDeployed,
    safeHasAllowances,
    deploySafe,
    setAllowances,
    clearSession,
    updateStage,
    tradeStage,
  ]);

  /**
   * Check Safe deployment status
   */
  const checkDeploymentStatus = useCallback(async (): Promise<boolean> => {
    if (!safeAddress || !address) return false;
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/dome-router`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_status',
          address,
          safeAddress,
        }),
      });

      const data = await response.json();
      return data.isDeployed || false;
    } catch (e) {
      console.error('[DomeRouter] Status check failed:', e);
      return false;
    }
  }, [safeAddress, address]);

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