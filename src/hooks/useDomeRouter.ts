import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { toast } from 'sonner';
import { ClobClient, Side } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import { supabase } from '@/integrations/supabase/client';
import { useSafeWallet } from './useSafeWallet';

const POLYGON_CHAIN_ID = 137;
const STORAGE_KEY = 'dome_router_session_v9'; // Bump version for ClobClient migration

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
 * Dome Router Hook - Uses ClobClient directly in browser
 * 
 * Handles:
 * - Safe wallet derivation, deployment, and allowances (via useSafeWallet)
 * - API credential creation (single signature via ClobClient)
 * - Order placement via edge function
 */
export function useDomeRouter() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  
  // Use Safe wallet hook for deployment and allowances
  const {
    safeAddress,
    isDeployed,
    isDeploying,
    deploySafe,
    hasAllowances,
    isSettingAllowances,
    setAllowances,
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
    
    toast.success('All credentials cleared - please refresh and re-link', {
      description: 'Cleared localStorage, sessionStorage, and IndexedDB'
    });
  }, [address, safeAddress]);

  /**
   * Link user to Polymarket - CLIENT-SIDE credential creation using ClobClient
   * 
   * Uses EOA signer to sign the credential request
   * signatureType = 2 (Safe wallet mode)
   * Credentials registered to the Safe address
   * funderAddress = Safe (where USDC is held)
   * 
   * IMPORTANT: Safe must be deployed BEFORE credentials are created
   */
  const linkUser = useCallback(async () => {
    if (!address || !walletClient) {
      toast.error('Please connect your wallet first');
      return null;
    }

    if (!safeAddress) {
      toast.error('Safe address not derived yet');
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
      console.log('[DomeRouter] ========== STARTING LINK FLOW ==========');
      console.log('[DomeRouter] EOA (signer):', address);
      console.log('[DomeRouter] Safe (maker/funder):', safeAddress);

      // STEP 1: Check and deploy Safe BEFORE credential creation
      console.log('[DomeRouter] Step 1: Checking Safe deployment status...');
      await checkDeployment();
      
      if (!isDeployed) {
        console.log('[DomeRouter] Safe not deployed, deploying now...');
        updateStage('deploying-safe', 'Deploying Safe wallet...');
        const deployed = await deploySafe();
        if (!deployed) {
          throw new Error('Safe deployment failed - cannot create credentials without deployed Safe');
        }
        console.log('[DomeRouter] Safe deployed successfully');
      } else {
        console.log('[DomeRouter] Safe already deployed');
      }

      // STEP 2: Create credentials
      updateStage('linking-wallet', 'Creating API credentials...');

      // Create ethers signer from wagmi walletClient
      const eoaSigner = walletClientToSigner(walletClient);

      console.log('[DomeRouter] Step 2: Creating credentials with:');
      console.log('[DomeRouter]   signatureType = 2 (Safe wallet)');
      console.log('[DomeRouter]   EOA (signer):', address);
      console.log('[DomeRouter]   Safe (maker + funder):', safeAddress);

      // Create ClobClient for credential generation
      // signatureType = 2 (Safe wallet mode)
      // funderAddress = Safe address
      const clobClient = new ClobClient(
        'https://clob.polymarket.com',
        POLYGON_CHAIN_ID,
        eoaSigner,
        undefined, // No credentials yet
        2, // signatureType = 2 (Safe wallet)
        safeAddress // funderAddress = Safe
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

      // STEP 3: Verify credentials work
      console.log('[DomeRouter] Step 3: Verifying credentials...');
      updateStage('linking-wallet', 'Verifying credentials...');
      
      try {
        // Create a new ClobClient WITH the credentials to verify they work
        const verifyClobClient = new ClobClient(
          'https://clob.polymarket.com',
          POLYGON_CHAIN_ID,
          eoaSigner,
          { key: creds.apiKey, secret: creds.apiSecret, passphrase: creds.apiPassphrase },
          2,
          safeAddress
        );
        
        // Try to get API keys - this will fail if credentials are invalid
        const apiKeys = await verifyClobClient.getApiKeys();
        console.log('[DomeRouter] Credential verification SUCCESS - API keys response received:', !!apiKeys);
      } catch (verifyErr) {
        console.warn('[DomeRouter] Credential verification failed:', verifyErr);
        // Don't fail the whole flow - credentials might still work for trading
        console.log('[DomeRouter] Proceeding despite verification failure (credentials may still work)');
      }

      setCredentials(creds);
      setIsLinked(true);

      // Save to localStorage
      saveSession({
        safeAddress,
        credentials: creds,
        signerAddress: address,
      });

      console.log('[DomeRouter] ========== LINK SUCCESSFUL ==========');
      console.log('[DomeRouter] Summary:', {
        eoaAddress: address,
        safeAddress: safeAddress,
        credentialKeyPrefix: creds.apiKey.slice(0, 8) + '...',
        signatureType: 2,
      });

      updateStage('completed', 'Wallet linked successfully!');
      toast.success('Wallet linked to Polymarket!', {
        description: `Safe: ${safeAddress.slice(0, 10)}...`
      });

      return { credentials: creds, safeAddress };
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
  }, [address, walletClient, safeAddress, chainId, switchChainAsync, saveSession, updateStage, isDeployed, checkDeployment, deploySafe]);

  /**
   * Place order - Signs order client-side, submits via edge function
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

    // Check Safe deployment
    if (!isDeployed) {
      updateStage('deploying-safe');
      toast.info('Deploying Safe wallet...');
      const deployed = await deploySafe();
      if (!deployed) {
        updateStage('error', 'Failed to deploy Safe wallet');
        return { success: false, error: 'Failed to deploy Safe wallet' };
      }
    }

    // Check allowances
    if (!hasAllowances) {
      updateStage('setting-allowances');
      toast.info('Setting token allowances...');
      const success = await setAllowances();
      if (!success) {
        updateStage('error', 'Failed to set token allowances');
        return { success: false, error: 'Failed to set token allowances' };
      }
    }

    setIsPlacingOrder(true);
    setLastOrderResult(null);

    try {
      updateStage('signing-order');

      // Calculate size from amount and price
      const roundedPrice = Math.round(params.price * 100) / 100;
      const size = params.amount / Math.max(roundedPrice, 0.01);
      const orderType = params.isMarketOrder ? 'FOK' : 'GTC';

      console.log('[DomeRouter] Order params:', {
        tokenId: params.tokenId,
        price: roundedPrice,
        size,
        side: params.side,
        negRisk: params.negRisk,
        orderType,
        funderAddress: safeAddress,
      });

      // Create ethers signer
      const signer = walletClientToSigner(walletClient);

      // Create ClobClient with credentials
      const clobCreds = {
        key: credentials.apiKey,
        secret: credentials.apiSecret,
        passphrase: credentials.apiPassphrase,
      };

      const clobClient = new ClobClient(
        'https://clob.polymarket.com',
        POLYGON_CHAIN_ID,
        signer,
        clobCreds,
        2, // signatureType = 2 (Safe wallet)
        safeAddress // funderAddress = Safe
      );

      // Build and sign order
      const orderArgs = {
        tokenID: params.tokenId,
        price: roundedPrice,
        size: size,
        side: params.side === 'BUY' ? Side.BUY : Side.SELL,
        feeRateBps: 100,
        nonce: Date.now(),
      };

      console.log('[DomeRouter] Creating order with ClobClient...');
      const signedOrder = await clobClient.createOrder(orderArgs);

      console.log('[DomeRouter] Order signed:', {
        salt: String(signedOrder.salt).slice(0, 10),
        maker: signedOrder.maker?.slice(0, 10),
        signer: signedOrder.signer?.slice(0, 10),
        makerAmount: signedOrder.makerAmount,
        takerAmount: signedOrder.takerAmount,
      });

      updateStage('submitting-order');

      // Sanitize order for transmission
      const sanitizedOrder = {
        ...signedOrder,
        salt: String(signedOrder.salt),
        makerAmount: String(signedOrder.makerAmount),
        takerAmount: String(signedOrder.takerAmount),
        expiration: String(signedOrder.expiration),
        nonce: String(signedOrder.nonce),
        feeRateBps: String(signedOrder.feeRateBps),
        side: params.side === 'BUY' ? 0 : 1,
        signatureType: signedOrder.signatureType ?? 2,
      };

      // Submit via edge function
      const { data, error } = await supabase.functions.invoke('dome-place-order', {
        body: {
          signedOrder: sanitizedOrder,
          orderType,
          credentials: {
            apiKey: credentials.apiKey,
            apiSecret: credentials.apiSecret,
            apiPassphrase: credentials.apiPassphrase,
          },
          orderParams: {
            funderAddress: safeAddress,
            negRisk: params.negRisk ?? false,
          },
        },
      });

      if (error) {
        console.error('[DomeRouter] Edge function error:', error);
        throw new Error(error.message || 'Edge function call failed');
      }

      if (!data?.success) {
        console.error('[DomeRouter] Order placement failed:', data);
        throw new Error(data?.error || 'Order placement failed');
      }

      console.log('[DomeRouter] Order placed:', data);

      updateStage('completed');
      
      const orderId = data.orderId;
      toast.success('Order placed successfully!', {
        description: orderId 
          ? `Order ID: ${String(orderId).slice(0, 12)}...` 
          : 'Order submitted successfully'
      });

      const orderResult: OrderResult = {
        success: true,
        orderId,
        result: data,
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
    isDeployed,
    hasAllowances,
    deploySafe,
    setAllowances,
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
    
    // Safe state (from useSafeWallet)
    safeAddress,
    isDeployed,
    hasAllowances,
    isDeploying,
    isSettingAllowances,
    deploySafe,
    setAllowances,
    checkDeploymentStatus: checkDeployment,
    
    // Credentials (for external use like fetching positions)
    credentials,
    
    // Order state
    isPlacingOrder,
    lastOrderResult,
    placeOrder,
    
    // Progress state
    tradeStage,
    tradeStageMessage,
    
    // Dome is always ready (no SDK init needed)
    isDomeReady: true,
  };
}
