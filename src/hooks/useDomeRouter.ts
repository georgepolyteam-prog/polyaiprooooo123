import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { toast } from 'sonner';
import { ClobClient, Side as ClobSide } from '@polymarket/clob-client';
import { useSafeWallet } from './useSafeWallet';
import type { WalletClient } from 'viem';

const POLYGON_CHAIN_ID = 137;
const STORAGE_KEY = 'dome_router_session_v3';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const CLOB_HOST = 'https://clob.polymarket.com';

// Signature type for Safe/Gnosis wallet
const SIGNATURE_TYPE_SAFE = 2;

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
 * Create an ethers-compatible signer adapter from wagmi walletClient
 * This adapter works with @polymarket/clob-client which expects ethers Signer
 */
function createEthersAdapter(walletClient: WalletClient, address: `0x${string}`) {
  return {
    getAddress: async () => address,
    
    // ClobClient uses _signTypedData for EIP-712 signatures
    _signTypedData: async (
      domain: { name?: string; version?: string; chainId?: number | bigint; verifyingContract?: string },
      types: Record<string, Array<{ name: string; type: string }>>,
      value: Record<string, unknown>
    ): Promise<string> => {
      // Find the primary type (the one that's not EIP712Domain)
      const primaryType = Object.keys(types).find(key => key !== 'EIP712Domain') || '';
      
      // Convert domain to proper format
      const domainForWagmi = {
        name: domain.name,
        version: domain.version,
        chainId: typeof domain.chainId === 'bigint' ? Number(domain.chainId) : domain.chainId,
        verifyingContract: domain.verifyingContract as `0x${string}` | undefined,
      };
      
      return await walletClient.signTypedData({
        account: address,
        domain: domainForWagmi,
        types,
        primaryType,
        message: value,
      });
    },
    
    // For personal sign (used in some auth flows)
    signMessage: async (message: string | Uint8Array): Promise<string> => {
      const msg = typeof message === 'string' ? message : new TextDecoder().decode(message);
      return await walletClient.signMessage({
        account: address,
        message: msg,
      });
    },
  };
}

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
   * Link user to Polymarket using @polymarket/clob-client
   * Uses createOrDeriveApiKey() which handles all L1 auth internally
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
      console.log('[DomeRouter] Creating ethers adapter for ClobClient...');
      
      // Create ethers-compatible signer adapter
      const ethersAdapter = createEthersAdapter(walletClient, address);
      
      // Create ClobClient without credentials (for L1 auth)
      // Use signatureType=2 (Safe) and funderAddress=safeAddress
      const clobClient = new ClobClient(
        CLOB_HOST,
        POLYGON_CHAIN_ID,
        ethersAdapter as unknown as import('@ethersproject/providers').JsonRpcSigner,
        undefined, // No credentials yet
        SIGNATURE_TYPE_SAFE,
        safeAddress || undefined, // funderAddress is the Safe
      );

      console.log('[DomeRouter] Calling createOrDeriveApiKey...');
      updateStage('linking-wallet', 'Please sign in your wallet...');

      // ClobClient handles L1 auth signature internally
      const apiKeyCreds = await clobClient.createOrDeriveApiKey();

      console.log('[DomeRouter] API credentials obtained:', {
        hasKey: !!apiKeyCreds?.key,
        hasSecret: !!apiKeyCreds?.secret,
        hasPassphrase: !!apiKeyCreds?.passphrase,
      });

      if (!apiKeyCreds?.key || !apiKeyCreds?.secret || !apiKeyCreds?.passphrase) {
        throw new Error('Invalid credentials returned');
      }

      if (!safeAddress) {
        throw new Error('Failed to derive Safe address');
      }

      // Map to our credential format
      const creds: PolymarketCredentials = {
        apiKey: apiKeyCreds.key,
        apiSecret: apiKeyCreds.secret,
        apiPassphrase: apiKeyCreds.passphrase,
      };

      setCredentials(creds);
      setIsLinked(true);

      // Deploy Safe if not already deployed
      if (!safeIsDeployed) {
        console.log('[DomeRouter] Deploying Safe wallet...');
        updateStage('deploying-safe', 'Deploying Safe wallet...');
        const deployed = await deploySafe();
        if (!deployed) {
          throw new Error('Failed to deploy Safe wallet');
        }
        console.log('[DomeRouter] Safe wallet deployed successfully');
      }

      // Set allowances if not already set - don't fail the entire link if this fails
      if (!safeHasAllowances) {
        console.log('[DomeRouter] Setting token allowances...');
        updateStage('setting-allowances', 'Setting token allowances...');
        try {
          const allowancesSet = await setAllowances();
          if (!allowancesSet) {
            console.warn('[DomeRouter] Allowances not set, user can retry later');
            toast.warning('Allowances need to be set before trading', {
              description: 'Tap "Set Allowances" to complete setup'
            });
          } else {
            console.log('[DomeRouter] Token allowances set successfully');
          }
        } catch (allowanceError) {
          console.error('[DomeRouter] Allowance error (non-fatal):', allowanceError);
          toast.warning('Allowances need to be set before trading', {
            description: 'Tap "Set Allowances" to complete setup'
          });
        }
      }

      // Save to localStorage
      saveSession({
        safeAddress,
        credentials: creds,
        signerAddress: address,
      });

      updateStage('completed', 'Wallet setup complete!');
      toast.success('Wallet linked to Polymarket!', {
        description: `Safe deployed: ${safeAddress.slice(0, 10)}...`
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
  }, [address, walletClient, chainId, switchChainAsync, safeAddress, saveSession, updateStage, safeIsDeployed, deploySafe, safeHasAllowances, setAllowances]);

  /**
   * Place an order using ClobClient.createOrder() to sign locally,
   * then submit via Dome API for geo-unrestricted trading and builder attribution
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

      console.log('[DomeRouter] Creating ClobClient for order signing...');

      // Create ethers adapter
      const ethersAdapter = createEthersAdapter(walletClient, address);
      
      // Create ClobClient with credentials for order signing
      const clobClient = new ClobClient(
        CLOB_HOST,
        POLYGON_CHAIN_ID,
        ethersAdapter as unknown as import('@ethersproject/providers').JsonRpcSigner,
        {
          key: credentials.apiKey,
          secret: credentials.apiSecret,
          passphrase: credentials.apiPassphrase,
        },
        SIGNATURE_TYPE_SAFE,
        safeAddress, // funderAddress is the Safe
      );

      // Calculate size (shares) from amount (USDC) and price
      const size = params.amount / params.price;
      const MIN_ORDER_SIZE = 5;
      if (size < MIN_ORDER_SIZE) {
        throw new Error(`Minimum order size is ${MIN_ORDER_SIZE} shares`);
      }

      const orderType = params.isMarketOrder ? 'FOK' : 'GTC';

      console.log('[DomeRouter] Signing order locally with createOrder...', {
        tokenId: params.tokenId,
        price: params.price,
        size,
        side: params.side,
        negRisk: params.negRisk,
        orderType,
      });

      // Use ClobClient.createOrder() to sign the order locally (no submission)
      const signedOrder = await clobClient.createOrder(
        {
          tokenID: params.tokenId,
          price: params.price,
          size: size,
          side: params.side === 'BUY' ? ClobSide.BUY : ClobSide.SELL,
        },
        {
          tickSize: params.tickSize || '0.01',
          negRisk: params.negRisk,
        }
      );

      console.log('[DomeRouter] Order signed locally:', signedOrder);

      // Convert numeric side to string for Dome API
      // ClobClient returns side as 0 (BUY) or 1 (SELL), but Dome expects "BUY" or "SELL"
      const signedOrderForDome = {
        ...signedOrder,
        side: typeof signedOrder.side === 'number' 
          ? (signedOrder.side === 0 ? 'BUY' : 'SELL') 
          : signedOrder.side,
      };

      updateStage('submitting-order', 'Submitting order via Dome...');

      // Generate a client order ID for tracking
      const clientOrderId = crypto.randomUUID();

      // Submit signed order to Dome API via edge function
      console.log('[DomeRouter] Submitting to Dome API via edge function...');
      
      const domeResponse = await fetch(`${SUPABASE_URL}/functions/v1/dome-place-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signedOrder: signedOrderForDome,
          orderType,
          credentials: {
            apiKey: credentials.apiKey,
            apiSecret: credentials.apiSecret,
            apiPassphrase: credentials.apiPassphrase,
          },
          clientOrderId,
        }),
      });

      const domeResult = await domeResponse.json();
      
      console.log('[DomeRouter] Dome API response:', domeResult);

      if (!domeResult.success) {
        throw new Error(domeResult.error || 'Failed to place order via Dome');
      }

      const orderId = domeResult.orderId || domeResult.result?.orderID;

      const orderResult: OrderResult = {
        success: true,
        orderId,
        result: domeResult.result,
      };

      setLastOrderResult(orderResult);
      updateStage('completed');
      
      toast.success('Order placed via Dome!', {
        description: orderId 
          ? `Order ID: ${String(orderId).slice(0, 12)}...` 
          : `Status: ${domeResult.status || 'Submitted'}`
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
