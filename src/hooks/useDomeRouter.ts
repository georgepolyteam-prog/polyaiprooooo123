import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { toast } from 'sonner';
import { useSafeWallet } from './useSafeWallet';
import { supabase } from '@/integrations/supabase/client';

const POLYGON_CHAIN_ID = 137;
const STORAGE_KEY = 'dome_router_session_v6'; // Bump version for client-side credential creation

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
  'linking-wallet': 'Sign to create trading credentials...',
  'deploying-safe': 'Deploying Safe wallet...',
  'setting-allowances': 'Setting token allowances...',
  'signing-order': 'Please sign the order in your wallet...',
  'submitting-order': 'Submitting order to Polymarket...',
  'completed': 'Order placed successfully!',
  'error': 'Order failed',
};

// Rounding configuration based on market tick size
const ROUNDING_CONFIG: Record<string, { price: number; size: number; amount: number }> = {
  '0.1': { price: 1, size: 2, amount: 3 },
  '0.01': { price: 2, size: 2, amount: 4 },
  '0.001': { price: 3, size: 2, amount: 5 },
  '0.0001': { price: 4, size: 2, amount: 6 },
};

// Helper to round down to specific decimal places
const roundDown = (value: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor) / factor;
};

// Helper to round to nearest decimal places
const roundNearest = (value: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
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
   * Link user to Polymarket - CLIENT-SIDE credential creation
   * 
   * L1 Authentication (API Key Creation):
   * - Uses EOA signer to sign the credential request
   * - signatureType = 2 (Safe wallet mode)
   * - Credentials registered to the Safe address
   * - funderAddress = Safe (where USDC is held)
   * 
   * Order Placement:
   * - Safe is the maker (owns the USDC funds)
   * - EOA is the signer (authorizes the trade)
   * - signatureType = 2 ensures Polymarket checks Safe balance
   * - This is the standard pattern for Safe wallet trading
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

      console.log('[DomeRouter] Starting wallet link (client-side)...');
      console.log('[DomeRouter] EOA (signer):', address);
      console.log('[DomeRouter] Safe (maker/funder):', safeAddress);

      updateStage('linking-wallet', 'Sign to create trading credentials...');

      // Import ClobClient for credential creation
      const { ClobClient } = await import('@polymarket/clob-client');
      const { ethers } = await import('ethers');
      
      // Create ethers provider and EOA signer from walletClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = new ethers.providers.Web3Provider(
        walletClient as unknown as any
      );
      const eoaSigner = provider.getSigner();

      console.log('[DomeRouter] Using signatureType=2 (Safe) for credential creation');
      console.log('[DomeRouter]   EOA (signer):', address);
      console.log('[DomeRouter]   Safe (maker + funder):', safeAddress);

      // Import BuilderConfig for Dome integration
      const { BuilderConfig } = await import('@polymarket/builder-signing-sdk');

      // Create Dome's builder config
      const builderConfig = new BuilderConfig({
        remoteBuilderConfig: {
          url: 'https://builder-signer.domeapi.io/builder-signer/sign',
        },
      });

      // Create ClobClient with EOA signer for L1 auth
      // Use signatureType=2 (Safe) so credentials are tied to Safe address
      const clobClient = new ClobClient(
        'https://clob.polymarket.com',
        POLYGON_CHAIN_ID,
        eoaSigner,    // EOA signer (signs the message)
        undefined,    // no credentials yet
        2,            // signatureType = 2 (Safe wallet)
        safeAddress,  // funderAddress = Safe (where USDC lives)
        undefined,    // 7th param
        false,        // 8th param
        builderConfig // 9th param - Dome builder config!
      );

      console.log('[DomeRouter] ClobClient initialized, attempting credential creation...');

      // DERIVE-FIRST STRATEGY:
      // 1. Try deriveApiKey() first - works if user already has credentials
      // 2. If derive fails or returns empty, try createApiKey()
      // 3. If both fail, throw with detailed error
      let apiKeyCreds;
      let credentialSource = '';
      const nonce = Date.now(); // Use timestamp as nonce to avoid replay issues

      // Helper to check if credentials are valid
      const isValidCreds = (creds: unknown): creds is { key: string; secret: string; passphrase: string } => {
        return !!(creds && typeof creds === 'object' && 
          'key' in creds && 'secret' in creds && 'passphrase' in creds &&
          creds.key && creds.secret && creds.passphrase);
      };

      // Step 1: Try deriveApiKey first (most common case - user already has creds)
      try {
        console.log('[DomeRouter] Attempting deriveApiKey (nonce:', nonce, ')...');
        apiKeyCreds = await clobClient.deriveApiKey(nonce);
        
        if (isValidCreds(apiKeyCreds)) {
          credentialSource = 'derived';
          console.log('[DomeRouter] Successfully derived existing credentials');
        } else {
          console.log('[DomeRouter] deriveApiKey returned incomplete creds, will try create');
          apiKeyCreds = null;
        }
      } catch (deriveError: unknown) {
        console.log('[DomeRouter] deriveApiKey failed:', deriveError instanceof Error ? deriveError.message : deriveError);
        apiKeyCreds = null;
      }

      // Step 2: If derive didn't work, try createApiKey
      if (!apiKeyCreds) {
        try {
          console.log('[DomeRouter] Attempting createApiKey (nonce:', nonce, ')...');
          apiKeyCreds = await clobClient.createApiKey(nonce);
          
          if (isValidCreds(apiKeyCreds)) {
            credentialSource = 'created';
            console.log('[DomeRouter] Successfully created new credentials');
          } else {
            console.log('[DomeRouter] createApiKey returned incomplete creds');
            apiKeyCreds = null;
          }
        } catch (createError: unknown) {
          console.error('[DomeRouter] createApiKey failed:', createError instanceof Error ? createError.message : createError);
          // Don't throw yet - check if we got partial creds
        }
      }

      // Step 3: Final validation
      if (!isValidCreds(apiKeyCreds)) {
        console.error('[DomeRouter] All credential methods failed. Final state:', {
          hasKey: !!apiKeyCreds?.key,
          hasSecret: !!apiKeyCreds?.secret,
          hasPassphrase: !!apiKeyCreds?.passphrase,
        });
        throw new Error('Failed to obtain valid trading credentials. Please try again.');
      }

      console.log('[DomeRouter] Credential acquisition complete:', {
        source: credentialSource,
        hasKey: true,
        hasSecret: true,
        hasPassphrase: true,
      });

      const creds: PolymarketCredentials = {
        apiKey: apiKeyCreds.key,
        apiSecret: apiKeyCreds.secret,
        apiPassphrase: apiKeyCreds.passphrase,
      };

      console.log('[DomeRouter] Link successful:', {
        hasCredentials: !!creds.apiKey,
        safeAddress: safeAddress?.slice(0, 10),
      });

      setCredentials(creds);
      setIsLinked(true);

      // Save to localStorage
      saveSession({
        safeAddress,
        credentials: creds,
        signerAddress: address,
      });

      updateStage('completed', 'Wallet setup complete!');
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
   * Place an order via edge function
   * Signs the order client-side with signatureType=2 and funderAddress=safeAddress
   * Then submits via edge function to Dome API
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

      // Get rounding config based on tick size (default to 0.01 if not specified)
      const tickSize = params.tickSize || '0.01';
      const roundingConfig = ROUNDING_CONFIG[tickSize] || ROUNDING_CONFIG['0.01'];

      // Round price first (USDC precision - always 2 decimals)
      const roundedPrice = roundNearest(params.price, roundingConfig.price);

      // Calculate raw size from amount and price
      const rawSize = params.amount / roundedPrice;
      
      // Round size to configured decimals (shares precision for takerAmount)
      let size = roundDown(rawSize, roundingConfig.size);
      
      // Calculate target cost - ensure minimum $1 for market orders
      let targetCost = Math.round(params.amount * 100) / 100;
      if (params.isMarketOrder && targetCost < 1.0) {
        targetCost = 1.0; // Polymarket requires minimum $1 for market orders
        console.log('[DomeRouter] Adjusted target cost to $1 minimum for market order');
      }

      // Calculate size that produces this exact cost
      size = targetCost / roundedPrice;
      size = Math.round(size * 100) / 100; // Round to 2 decimals

      // Verify the cost is valid (2 decimals)
      let actualCost = Math.round(size * roundedPrice * 100) / 100;

      // If cost is less than target due to rounding, adjust size up
      if (actualCost < targetCost) {
        size = size + 0.01;
        actualCost = Math.round(size * roundedPrice * 100) / 100;
      }

      console.log('[DomeRouter] Final calculation:', {
        requestedAmount: params.amount,
        targetCost,
        price: roundedPrice,
        size,
        actualCost,
        meetsMinimum: actualCost >= 1.0,
        has2Decimals: Math.abs(actualCost - Math.round(actualCost * 100) / 100) < 0.001,
      });
      
      const MIN_ORDER_SIZE = 5;
      if (size < MIN_ORDER_SIZE) {
        throw new Error(`Minimum order size is ${MIN_ORDER_SIZE} shares`);
      }

      const orderType = params.isMarketOrder ? 'FOK' : 'GTC';

      console.log('[DomeRouter] Creating order for submission...');
      console.log('[DomeRouter] Order params:', {
        tokenId: params.tokenId,
        price: roundedPrice,
        size,
        side: params.side,
        negRisk: params.negRisk,
        orderType,
        funderAddress: safeAddress,
      });

      // Build signed order using Polymarket ClobClient
      const { ClobClient, Side } = await import('@polymarket/clob-client');
      const { BuilderConfig } = await import('@polymarket/builder-signing-sdk');
      const ethersLib = await import('ethers');
      
      // Create a minimal signer for ClobClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = new (ethersLib as any).ethers.providers.Web3Provider(
        walletClient as unknown as any
      );
      const signer = provider.getSigner();
      
      // Convert credentials to ClobClient format
      const clobCreds = {
        key: credentials.apiKey,
        secret: credentials.apiSecret,
        passphrase: credentials.apiPassphrase,
      };

      // Create Dome's builder config
      const builderConfig = new BuilderConfig({
        remoteBuilderConfig: {
          url: 'https://builder-signer.domeapi.io/builder-signer/sign',
        },
      });
      
      // Initialize ClobClient for order signing
      // Use signatureType=2 (Safe) to match credentials from linkUser
      const clobClient = new ClobClient(
        'https://clob.polymarket.com',
        POLYGON_CHAIN_ID,
        signer,
        clobCreds,
        2,            // signatureType = 2 (Safe wallet)
        safeAddress,  // funderAddress = Safe (where USDC lives)
        undefined,    // 7th param
        false,        // 8th param
        builderConfig // 9th param - Dome builder config!
      );

      // Convert side to ClobClient enum
      const clobSide = params.side === 'BUY' ? Side.BUY : Side.SELL;

      // Create and sign the order with rounded values
      // IMPORTANT: Pass tickSize and negRisk in options so ClobClient uses correct rounding
      const order = await clobClient.createOrder(
        {
          tokenID: params.tokenId,
          price: roundedPrice,
          size: size,
          side: clobSide,
          feeRateBps: 0, // Dome handles fees
        },
        {
          tickSize: tickSize as '0.1' | '0.01' | '0.001' | '0.0001',  // Cast to TickSize type
          negRisk: params.negRisk ?? false,  // Required for correct exchange contract
        }
      );

      console.log('[DomeRouter] Order signed with amounts:', {
        maker: order.maker?.slice(0, 10),
        signer: order.signer?.slice(0, 10),
        tokenId: order.tokenId?.slice(0, 20),
        side: order.side,
        makerAmount: order.makerAmount,
        takerAmount: order.takerAmount,
      });

      updateStage('submitting-order');

      // Submit via edge function to Dome API
      const { data, error } = await supabase.functions.invoke('dome-place-order', {
        body: {
          signedOrder: order,
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
        throw new Error(error.message || 'Failed to place order');
      }

      if (!data?.success) {
        console.error('[DomeRouter] Order failed:', data);
        throw new Error(data?.error || 'Order rejected');
      }

      console.log('[DomeRouter] Order placed via Dome:', data);

      updateStage('completed');
      
      const orderId = data.orderId;
      toast.success('Order placed via Dome!', {
        description: orderId 
          ? `Order ID: ${String(orderId).slice(0, 12)}...` 
          : 'Order submitted successfully'
      });

      const result: OrderResult = {
        success: true,
        orderId,
        result: data.result,
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
    
    // Order state
    isPlacingOrder,
    lastOrderResult,
    placeOrder,
    
    // Progress state
    tradeStage,
    tradeStageMessage,
    
    // Dome is always ready (uses edge functions, not client SDK)
    isDomeReady: true,
  };
}
