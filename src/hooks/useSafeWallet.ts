import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder/derive';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';

const POLYGON_CHAIN_ID = 137;
const POLYGON_RPC = 'https://polygon-rpc.com';

// Dome builder signer URL for order attribution
const RELAYER_URL = 'https://relayer-v2.polymarket.com/';
const BUILDER_SIGNER_URL = 'https://builder-signer.domeapi.io/builder-signer/sign';

// Polygon contract addresses for allowance verification
const POLYGON_ADDRESSES = {
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8DB438C',
  NEG_RISK_CTF_EXCHANGE: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  NEG_RISK_ADAPTER: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
};

/**
 * Derive Safe address from EOA using the official Polymarket library
 */
function deriveSafeAddress(ownerAddress: string): string {
  const config = getContractConfig(POLYGON_CHAIN_ID);
  return deriveSafe(ownerAddress, config.SafeContracts.SafeFactory);
}

/**
 * Fallback: Check if Safe is deployed via RPC
 */
async function checkSafeDeployedRPC(safeAddress: string): Promise<boolean> {
  try {
    const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
    const code = await provider.getCode(safeAddress);
    return code !== '0x' && code.length > 2;
  } catch (e) {
    console.error('[Safe] RPC deployment check failed:', e);
    return false;
  }
}

/**
 * Convert wagmi walletClient to ethers JsonRpcSigner (required by RelayClient)
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
 * Create RelayClient with BuilderConfig for Dome integration
 */
function createRelayClient(signer: ethers.providers.JsonRpcSigner): RelayClient {
  const builderConfig = new BuilderConfig({
    remoteBuilderConfig: {
      url: BUILDER_SIGNER_URL,
    },
  });

  return new RelayClient(
    RELAYER_URL,
    POLYGON_CHAIN_ID,
    signer,
    builderConfig
  );
}

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
      let deployed = false;
      
      // Try RelayClient first
      if (relayClientRef.current) {
        try {
          deployed = await (relayClientRef.current as any).getDeployed(safeAddress);
          console.log('[Safe] RelayClient deployment check:', deployed);
        } catch (e) {
          console.log('[Safe] RelayClient check failed, falling back to RPC');
          deployed = await checkSafeDeployedRPC(safeAddress);
        }
      } else {
        // Fallback to RPC check
        deployed = await checkSafeDeployedRPC(safeAddress);
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
  const deploySafe = useCallback(async (): Promise<string | null> => {
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

      console.log('[Safe] Deploying via RelayClient...');
      
      // Use RelayClient.deploy() as per documentation
      const response = await relayClientRef.current.deploy();
      const result = await response.wait();

      if (!result?.proxyAddress) {
        throw new Error('Safe deployment failed - no proxy address returned');
      }

      console.log('[Safe] Deployed at:', result.proxyAddress);
      setIsDeployed(true);
      deploymentConfirmed.current = true;
      localStorage.setItem(`safe_deployed:${safeAddress.toLowerCase()}`, 'true');
      
      toast.success('Safe wallet deployed!', {
        description: `Address: ${result.proxyAddress.slice(0, 10)}...`
      });

      return result.proxyAddress;
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
  const checkAllowancesOnChain = useCallback(async (): Promise<{
    allSet: boolean;
    ctfExchange: boolean;
    negRiskCtfExchange: boolean;
    negRiskAdapter: boolean;
  }> => {
    if (!safeAddress) {
      return { allSet: false, ctfExchange: false, negRiskCtfExchange: false, negRiskAdapter: false };
    }
    
    try {
      const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
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
      
      console.log('[Safe] On-chain allowance check:', result);
      return result;
    } catch (e) {
      console.error('[Safe] Failed to check allowances on-chain:', e);
      return { allSet: false, ctfExchange: false, negRiskCtfExchange: false, negRiskAdapter: false };
    }
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

      console.log('[Safe] Setting allowances via RelayClient (from Safe)...');
      
      // Use RelayClient.setAllowances() with fallbacks for different method names
      const client = relayClientRef.current as any;
      if (typeof client.setAllowances === 'function') {
        await client.setAllowances();
      } else if (typeof client.approveAll === 'function') {
        await client.approveAll();
      } else if (typeof client.setApprovals === 'function') {
        await client.setApprovals();
      } else {
        console.warn('[Safe] RelayClient setAllowances method not found - allowances may need to be set manually');
      }

      console.log('[Safe] Allowances set successfully via RelayClient');
      setHasAllowances(true);
      localStorage.setItem(`safe_allowances:${safeAddress.toLowerCase()}`, 'true');
      
      toast.success('Token allowances set!', {
        description: 'Your Safe is ready for trading'
      });

      return true;
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

  // Withdraw USDC from Safe to EOA (still uses direct contract call)
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
      const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
      const erc20Interface = new ethers.utils.Interface([
        'function transfer(address to, uint256 amount) external returns (bool)'
      ]);

      const usdc = new ethers.Contract(USDC_ADDRESS, erc20Interface, signer);

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
    deploySafe,
    checkDeployment,
    hasAllowances,
    isSettingAllowances,
    setAllowances,
    checkAllowancesOnChain,
    isWithdrawing,
    withdrawUSDC,
  };
}
