import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder/derive';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';

// ============================================================================
// EXPORTED CONSTANTS (matching Dome SDK reference)
// ============================================================================

export const POLYGON_CHAIN_ID = 137;
export const DEFAULT_RPC_URL = 'https://polygon-rpc.com';
export const DEFAULT_RELAYER_URL = 'https://relayer-v2.polymarket.com/';
export const DEFAULT_BUILDER_SIGNER_URL = 'https://builder-signer.domeapi.io/builder-signer/sign';

export const POLYGON_ADDRESSES = {
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8DB438C',
  NEG_RISK_CTF_EXCHANGE: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  NEG_RISK_ADAPTER: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
};

// ============================================================================
// EXPORTED TYPES & INTERFACES (matching Dome SDK reference)
// ============================================================================

export interface SafeInitResult {
  safeAddress: string;
  wasAlreadyDeployed: boolean;
  deploymentTxHash?: string | undefined;
}

export interface SafeAllowanceStatus {
  allSet: boolean;
  ctfExchange: boolean;
  negRiskCtfExchange: boolean;
  negRiskAdapter: boolean;
}

export interface Eip712Payload {
  domain: ethers.TypedDataDomain;
  types: Record<string, ethers.TypedDataField[]>;
  value: Record<string, any>;
}

export interface RouterSigner {
  getAddress(): Promise<string>;
  signTypedData(payload: Eip712Payload): Promise<string>;
}

export interface RelayClientOptions {
  chainId?: number;
  relayerUrl?: string;
  builderSigningUrl?: string;
}

export interface InitializeSafeOptions extends RelayClientOptions {
  onProgress?: (step: string) => void;
}

// ============================================================================
// RouterSignerEthersAdapter (matching Dome SDK reference exactly)
// ============================================================================

/**
 * Adapter to convert a RouterSigner to an ethers.Signer
 * Required for RelayClient which expects an ethers.Signer
 */
export class RouterSignerEthersAdapter extends ethers.Signer {
  constructor(
    private readonly routerSigner: RouterSigner,
    provider: ethers.providers.Provider
  ) {
    super();
    (this as any).provider = provider;
  }

  async getAddress(): Promise<string> {
    return this.routerSigner.getAddress();
  }

  async signTransaction(): Promise<string> {
    throw new Error('RouterSignerEthersAdapter does not support signTransaction');
  }

  async signMessage(): Promise<string> {
    throw new Error('RouterSignerEthersAdapter does not support signMessage');
  }

  async _signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, any>
  ): Promise<string> {
    return this.routerSigner.signTypedData({ domain, types, value });
  }

  connect(provider: ethers.providers.Provider): ethers.Signer {
    return new RouterSignerEthersAdapter(this.routerSigner, provider);
  }
}

// ============================================================================
// STANDALONE UTILITY FUNCTIONS (matching Dome SDK reference)
// ============================================================================

/**
 * Get a Polygon JSON-RPC provider
 */
export function getPolygonProvider(rpcUrl: string = DEFAULT_RPC_URL): ethers.providers.JsonRpcProvider {
  return new ethers.providers.JsonRpcProvider(rpcUrl);
}

/**
 * Derive Safe address from EOA using the official Polymarket library
 */
export function deriveSafeAddress(eoaAddress: string, chainId: number = POLYGON_CHAIN_ID): string {
  const config = getContractConfig(chainId);
  return deriveSafe(eoaAddress, config.SafeContracts.SafeFactory);
}

/**
 * Check if Safe is deployed via RPC (code check)
 */
export async function isSafeDeployed(
  safeAddress: string,
  provider: ethers.providers.Provider
): Promise<boolean> {
  try {
    const code = await provider.getCode(safeAddress);
    return code !== '0x' && code.length > 2;
  } catch (e) {
    console.error('[Safe] RPC deployment check failed:', e);
    return false;
  }
}

/**
 * Check if Safe is deployed via RelayClient API
 */
export async function isSafeDeployedViaRelay(
  relayClient: RelayClient,
  safeAddress: string
): Promise<boolean> {
  try {
    return await (relayClient as any).getDeployed(safeAddress);
  } catch (e) {
    console.log('[Safe] RelayClient getDeployed failed:', e);
    return false;
  }
}

/**
 * Create an ethers.Signer from a RouterSigner
 */
export function createEthersSignerFromRouter(
  routerSigner: RouterSigner,
  provider: ethers.providers.Provider
): ethers.Signer {
  return new RouterSignerEthersAdapter(routerSigner, provider);
}

/**
 * Convert wagmi walletClient to ethers JsonRpcSigner
 */
export function walletClientToSigner(walletClient: any): ethers.providers.JsonRpcSigner {
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
 * Create RelayClient with BuilderConfig for Dome integration
 */
export function createRelayClient(
  signer: RouterSigner | ethers.Signer,
  options: RelayClientOptions = {}
): RelayClient {
  const {
    chainId = POLYGON_CHAIN_ID,
    relayerUrl = DEFAULT_RELAYER_URL,
    builderSigningUrl = DEFAULT_BUILDER_SIGNER_URL,
  } = options;

  const builderConfig = new BuilderConfig({
    remoteBuilderConfig: {
      url: builderSigningUrl,
    },
  });

  // If signer is a RouterSigner, convert it to ethers.Signer
  let ethersSigner: ethers.Signer;
  if ('signTypedData' in signer && typeof (signer as RouterSigner).signTypedData === 'function') {
    const provider = getPolygonProvider();
    ethersSigner = createEthersSignerFromRouter(signer as RouterSigner, provider);
  } else {
    ethersSigner = signer as ethers.Signer;
  }

  return new RelayClient(
    relayerUrl,
    chainId,
    ethersSigner as ethers.providers.JsonRpcSigner,
    builderConfig
  );
}

/**
 * Deploy Safe via RelayClient
 */
export async function deploySafe(relayClient: RelayClient): Promise<SafeInitResult> {
  const signerAddress = await (relayClient as any).signer.getAddress();
  const safeAddress = deriveSafeAddress(signerAddress);
  
  // Check if already deployed
  const provider = getPolygonProvider();
  const alreadyDeployed = await isSafeDeployed(safeAddress, provider);
  
  if (alreadyDeployed) {
    console.log('[Safe] Already deployed at:', safeAddress);
    return {
      safeAddress,
      wasAlreadyDeployed: true,
      deploymentTxHash: undefined,
    };
  }

  console.log('[Safe] Deploying via RelayClient...');
  const response = await relayClient.deploy();
  const result = await response.wait();

  if (!result?.proxyAddress) {
    throw new Error('Safe deployment failed - no proxy address returned');
  }

  console.log('[Safe] Deployed at:', result.proxyAddress);
  return {
    safeAddress: result.proxyAddress,
    wasAlreadyDeployed: false,
    deploymentTxHash: result.transactionHash || undefined,
  };
}

/**
 * Check USDC approval for a specific spender
 */
export async function checkSafeUsdcApproval(
  safeAddress: string,
  spender: string,
  provider: ethers.providers.Provider
): Promise<boolean> {
  try {
    const usdcContract = new ethers.Contract(
      POLYGON_ADDRESSES.USDC,
      ['function allowance(address owner, address spender) view returns (uint256)'],
      provider
    );
    const allowance = await usdcContract.allowance(safeAddress, spender);
    return allowance.gt(0);
  } catch (e) {
    console.error('[Safe] Failed to check USDC approval:', e);
    return false;
  }
}

/**
 * Check all required allowances for a Safe
 */
export async function checkSafeAllowances(
  safeAddress: string,
  provider: ethers.providers.Provider
): Promise<SafeAllowanceStatus> {
  try {
    const usdcContract = new ethers.Contract(
      POLYGON_ADDRESSES.USDC,
      ['function allowance(address owner, address spender) view returns (uint256)'],
      provider
    );

    const [ctf, negRiskCtf, negRiskAdapter] = await Promise.all([
      usdcContract.allowance(safeAddress, POLYGON_ADDRESSES.CTF_EXCHANGE),
      usdcContract.allowance(safeAddress, POLYGON_ADDRESSES.NEG_RISK_CTF_EXCHANGE),
      usdcContract.allowance(safeAddress, POLYGON_ADDRESSES.NEG_RISK_ADAPTER),
    ]);

    const result = {
      ctfExchange: ctf.gt(0),
      negRiskCtfExchange: negRiskCtf.gt(0),
      negRiskAdapter: negRiskAdapter.gt(0),
      allSet: ctf.gt(0) && negRiskCtf.gt(0) && negRiskAdapter.gt(0),
    };

    console.log('[Safe] Allowance check:', result);
    return result;
  } catch (e) {
    console.error('[Safe] Failed to check allowances:', e);
    return { allSet: false, ctfExchange: false, negRiskCtfExchange: false, negRiskAdapter: false };
  }
}

/**
 * Set USDC approvals via RelayClient (from Safe, not EOA)
 */
export async function setSafeUsdcApproval(
  relayClient: RelayClient,
  onProgress?: (step: string) => void
): Promise<boolean> {
  try {
    onProgress?.('Setting USDC approvals...');
    console.log('[Safe] Setting allowances via RelayClient (from Safe)...');

    // Use RelayClient.setAllowances() with fallbacks for different method names
    const client = relayClient as any;
    if (typeof client.setAllowances === 'function') {
      await client.setAllowances();
    } else if (typeof client.approveAll === 'function') {
      await client.approveAll();
    } else if (typeof client.setApprovals === 'function') {
      await client.setApprovals();
    } else {
      console.warn('[Safe] RelayClient setAllowances method not found');
      return false;
    }

    console.log('[Safe] Allowances set successfully');
    onProgress?.('Allowances set');
    return true;
  } catch (e) {
    console.error('[Safe] Failed to set allowances:', e);
    return false;
  }
}

/**
 * Full Safe initialization flow: deploy + set allowances
 */
export async function initializeSafe(
  signer: RouterSigner,
  options: InitializeSafeOptions = {}
): Promise<SafeInitResult> {
  const { onProgress, ...relayClientOptions } = options;

  onProgress?.('Creating relay client...');
  const relayClient = createRelayClient(signer, relayClientOptions);

  onProgress?.('Checking deployment status...');
  const eoaAddress = await signer.getAddress();
  const safeAddress = deriveSafeAddress(eoaAddress);
  const provider = getPolygonProvider(options.chainId === POLYGON_CHAIN_ID ? DEFAULT_RPC_URL : undefined);

  const alreadyDeployed = await isSafeDeployed(safeAddress, provider);

  let result: SafeInitResult;

  if (alreadyDeployed) {
    onProgress?.('Safe already deployed');
    result = {
      safeAddress,
      wasAlreadyDeployed: true,
      deploymentTxHash: undefined,
    };
  } else {
    onProgress?.('Deploying Safe...');
    result = await deploySafe(relayClient);
  }

  // Check and set allowances
  onProgress?.('Checking allowances...');
  const allowances = await checkSafeAllowances(safeAddress, provider);

  if (!allowances.allSet) {
    onProgress?.('Setting allowances...');
    await setSafeUsdcApproval(relayClient, onProgress);
  } else {
    onProgress?.('Allowances already set');
  }

  onProgress?.('Initialization complete');
  return result;
}

// ============================================================================
// REACT HOOK (uses standalone functions internally)
// ============================================================================

export function useSafeWallet() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeployed, setIsDeployed] = useState(false);
  const [isSettingAllowances, setIsSettingAllowances] = useState(false);
  const [hasAllowances, setHasAllowances] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Track if we've confirmed deployment to avoid flaky re-checks
  const deploymentConfirmed = useRef(false);

  // Store RelayClient instance
  const relayClientRef = useRef<RelayClient | null>(null);

  // Derive Safe address deterministically using the official library
  const safeAddress = useMemo(() => {
    if (!address) return null;
    try {
      const derived = deriveSafeAddress(address);
      console.log('[Safe] Derived address (via library):', derived, 'from EOA:', address);
      return derived;
    } catch (e) {
      console.error('[Safe] Failed to derive address:', e);
      return null;
    }
  }, [address]);

  // Create/update RelayClient when walletClient changes
  useEffect(() => {
    if (walletClient) {
      try {
        const signer = walletClientToSigner(walletClient);
        relayClientRef.current = createRelayClient(signer);
        console.log('[Safe] RelayClient created with BuilderConfig');
      } catch (e) {
        console.error('[Safe] Failed to create RelayClient:', e);
        relayClientRef.current = null;
      }
    } else {
      relayClientRef.current = null;
    }
  }, [walletClient]);

  // Load cached deployment status
  useEffect(() => {
    if (safeAddress) {
      const cached = localStorage.getItem(`safe_deployed:${safeAddress.toLowerCase()}`);
      if (cached === 'true') {
        setIsDeployed(true);
        deploymentConfirmed.current = true;
      }
      const allowancesCached = localStorage.getItem(`safe_allowances:${safeAddress.toLowerCase()}`);
      if (allowancesCached === 'true') {
        setHasAllowances(true);
      }
    }
  }, [safeAddress]);

  // Check deployment status using RelayClient or fallback to RPC
  const checkDeployment = useCallback(async (): Promise<boolean> => {
    if (!safeAddress) return false;

    // If we've already confirmed deployment, don't re-check
    if (deploymentConfirmed.current) {
      console.log('[Safe] Deployment already confirmed, skipping check');
      return true;
    }

    try {
      const provider = getPolygonProvider();
      let deployed = false;

      // Try RelayClient first
      if (relayClientRef.current) {
        try {
          deployed = await isSafeDeployedViaRelay(relayClientRef.current, safeAddress);
          console.log('[Safe] RelayClient deployment check:', deployed);
        } catch (e) {
          console.log('[Safe] RelayClient check failed, falling back to RPC');
          deployed = await isSafeDeployed(safeAddress, provider);
        }
      } else {
        // Fallback to RPC check
        deployed = await isSafeDeployed(safeAddress, provider);
      }

      if (deployed) {
        setIsDeployed(true);
        deploymentConfirmed.current = true;
        localStorage.setItem(`safe_deployed:${safeAddress.toLowerCase()}`, 'true');
      }
      console.log('[Safe] Deployment status:', deployed);
      return deployed;
    } catch (e) {
      console.error('[Safe] Deployment check failed:', e);
      return false;
    }
  }, [safeAddress]);

  // Check deployment status on mount/wallet change
  useEffect(() => {
    if (safeAddress && address) {
      checkDeployment();
    }
  }, [safeAddress, address, checkDeployment]);

  // Deploy Safe smart wallet using RelayClient
  const deploySafeWallet = useCallback(async (): Promise<string | null> => {
    if (!address || !safeAddress || !walletClient) {
      toast.error('Connect wallet first');
      return null;
    }

    // Check if already deployed
    const alreadyDeployed = await checkDeployment();
    if (alreadyDeployed) {
      console.log('[Safe] Already deployed at:', safeAddress);
      toast.success('Safe wallet already deployed!');
      return safeAddress;
    }

    // Ensure RelayClient is available
    if (!relayClientRef.current) {
      const signer = walletClientToSigner(walletClient);
      relayClientRef.current = createRelayClient(signer);
    }

    setIsDeploying(true);
    try {
      toast.info('Deploying Safe wallet...', {
        description: 'Please confirm the transaction in your wallet'
      });

      const result = await deploySafe(relayClientRef.current);

      setIsDeployed(true);
      deploymentConfirmed.current = true;
      localStorage.setItem(`safe_deployed:${safeAddress.toLowerCase()}`, 'true');

      toast.success('Safe wallet deployed!', {
        description: `Address: ${result.safeAddress.slice(0, 10)}...`
      });

      return result.safeAddress;
    } catch (error: any) {
      console.error('[Safe] Deployment error:', error);
      toast.error('Failed to deploy Safe wallet', {
        description: error.message || 'Please try again'
      });
      return null;
    } finally {
      setIsDeploying(false);
    }
  }, [address, safeAddress, walletClient, checkDeployment]);

  // Check allowances on-chain for a given Safe address
  const checkAllowancesOnChain = useCallback(async (): Promise<SafeAllowanceStatus> => {
    if (!safeAddress) {
      return { allSet: false, ctfExchange: false, negRiskCtfExchange: false, negRiskAdapter: false };
    }

    const provider = getPolygonProvider();
    return checkSafeAllowances(safeAddress, provider);
  }, [safeAddress]);

  // Set token allowances using RelayClient (sets from Safe, not EOA)
  const setAllowances = useCallback(async (): Promise<boolean> => {
    if (!safeAddress || !walletClient || !address) {
      console.log('[Safe] setAllowances aborted: missing requirements');
      toast.error('Safe address not available');
      return false;
    }

    // Check deployment
    if (!deploymentConfirmed.current) {
      const deployed = await checkDeployment();
      if (!deployed) {
        console.log('[Safe] setAllowances aborted: Safe not deployed');
        toast.error('Please deploy your Safe wallet first');
        return false;
      }
    }
    console.log('[Safe] setAllowances: deployment confirmed, proceeding...');

    // Ensure RelayClient is available
    if (!relayClientRef.current) {
      const signer = walletClientToSigner(walletClient);
      relayClientRef.current = createRelayClient(signer);
    }

    setIsSettingAllowances(true);
    try {
      toast.info('Setting token allowances...', {
        description: 'Please confirm the transaction in your wallet'
      });

      const success = await setSafeUsdcApproval(relayClientRef.current);

      if (success) {
        setHasAllowances(true);
        localStorage.setItem(`safe_allowances:${safeAddress.toLowerCase()}`, 'true');
        toast.success('Token allowances set!', {
          description: 'Your Safe is ready for trading'
        });
      }

      return success;
    } catch (error: any) {
      console.error('[Safe] Allowance error:', error);
      toast.error('Failed to set allowances', {
        description: error.message || 'Please try again'
      });
      return false;
    } finally {
      setIsSettingAllowances(false);
    }
  }, [safeAddress, walletClient, address, checkDeployment]);

  // Withdraw USDC from Safe to EOA
  const withdrawUSDC = useCallback(async (amount: number, toAddress: string): Promise<boolean> => {
    if (!safeAddress || !walletClient || !address) {
      toast.error('Safe address not available');
      return false;
    }

    const deployed = await checkDeployment();
    if (!deployed) {
      toast.error('Safe wallet not deployed');
      return false;
    }

    setIsWithdrawing(true);
    try {
      toast.info('Initiating withdrawal...', {
        description: `Withdrawing ${amount} USDC to ${toAddress.slice(0, 8)}...`
      });

      // Create signer from walletClient
      const signer = walletClientToSigner(walletClient);

      // Convert amount to USDC units (6 decimals)
      const amountInUnits = ethers.utils.parseUnits(amount.toString(), 6);

      // USDC transfer interface
      const erc20Interface = new ethers.utils.Interface([
        'function transfer(address to, uint256 amount) external returns (bool)'
      ]);

      const usdc = new ethers.Contract(POLYGON_ADDRESSES.USDC, erc20Interface, signer);

      console.log('[Safe] Executing USDC transfer:', { amount, toAddress });
      const tx = await usdc.transfer(toAddress, amountInUnits);
      await tx.wait();

      console.log('[Safe] Withdrawal successful');
      toast.success('Withdrawal successful!', {
        description: `${amount} USDC sent to your wallet`
      });

      return true;
    } catch (error: any) {
      console.error('[Safe] Withdrawal error:', error);
      toast.error('Failed to withdraw USDC', {
        description: error.message || 'Please try again'
      });
      return false;
    } finally {
      setIsWithdrawing(false);
    }
  }, [safeAddress, walletClient, address, checkDeployment]);

  return {
    safeAddress,
    isDeployed,
    isDeploying,
    deploySafe: deploySafeWallet,
    checkDeployment,
    hasAllowances,
    isSettingAllowances,
    setAllowances,
    checkAllowancesOnChain,
    isWithdrawing,
    withdrawUSDC,
  };
}
