import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder/derive';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';

const POLYGON_CHAIN_ID = 137;
const BUILDER_SIGNER_URL = 'https://builder-signer.domeapi.io/builder-signer/sign';
const RELAYER_URL = 'https://relayer-v2.polymarket.com/';

// Polymarket contract addresses on Polygon
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const CTF_ADDRESS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';
const NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296';

// ABI interfaces for approval transactions
const ERC20_INTERFACE = new ethers.utils.Interface([
  'function approve(address spender, uint256 amount)'
]);
const ERC1155_INTERFACE = new ethers.utils.Interface([
  'function setApprovalForAll(address operator, bool approved)'
]);
export function useSafeWallet() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeployed, setIsDeployed] = useState(false);
  const [isSettingAllowances, setIsSettingAllowances] = useState(false);
  const [hasAllowances, setHasAllowances] = useState(false);
  const [relayClient, setRelayClient] = useState<RelayClient | null>(null);

  // Derive Safe address deterministically using official Polymarket derivation
  const safeAddress = useMemo(() => {
    if (!address) return null;
    try {
      const config = getContractConfig(POLYGON_CHAIN_ID);
      const derived = deriveSafe(address, config.SafeContracts.SafeFactory);
      console.log('[Safe] Derived address:', derived, 'from EOA:', address);
      return derived;
    } catch (e) {
      console.error('[Safe] Failed to derive address:', e);
      return null;
    }
  }, [address]);

  // Load cached deployment status
  useEffect(() => {
    if (safeAddress) {
      const cached = localStorage.getItem(`safe_deployed:${safeAddress.toLowerCase()}`);
      if (cached === 'true') {
        setIsDeployed(true);
      }
      const allowancesCached = localStorage.getItem(`safe_allowances:${safeAddress.toLowerCase()}`);
      if (allowancesCached === 'true') {
        setHasAllowances(true);
      }
    }
  }, [safeAddress]);

  // Check deployment status on mount/wallet change
  useEffect(() => {
    if (safeAddress && address && window.ethereum) {
      // Verify deployment via RPC on mount
      const verifyDeployment = async () => {
        try {
          const provider = new ethers.providers.Web3Provider(
            window.ethereum as ethers.providers.ExternalProvider
          );
          const code = await provider.getCode(safeAddress);
          const deployed = code !== '0x' && code !== '0x0';
          setIsDeployed(deployed);
          if (deployed) {
            localStorage.setItem(`safe_deployed:${safeAddress.toLowerCase()}`, 'true');
          }
          console.log('[Safe] Deployment status:', deployed);
        } catch (e) {
          console.error('[Safe] RPC check failed:', e);
        }
      };
      verifyDeployment();
    }
  }, [safeAddress, address]);
  // Create RelayClient when wallet is available
  const createRelayClient = useCallback(async (): Promise<RelayClient | null> => {
    if (!walletClient || !address) {
      console.error('[Safe] No wallet client available');
      return null;
    }

    try {
      // Convert wagmi wallet client to ethers signer
      const provider = new ethers.providers.Web3Provider(
        walletClient as unknown as ethers.providers.ExternalProvider
      );
      const signer = provider.getSigner();

      const builderConfig = new BuilderConfig({
        remoteBuilderConfig: {
          url: BUILDER_SIGNER_URL,
        },
      });

      const client = new RelayClient(
        RELAYER_URL,
        POLYGON_CHAIN_ID,
        signer,
        builderConfig
      );

      setRelayClient(client);
      return client;
    } catch (e) {
      console.error('[Safe] Failed to create RelayClient:', e);
      return null;
    }
  }, [walletClient, address]);

  // Check if Safe is deployed on-chain
  const checkDeployment = useCallback(async (): Promise<boolean> => {
    if (!safeAddress || !window.ethereum) return false;

    try {
      const provider = new ethers.providers.Web3Provider(
        window.ethereum as ethers.providers.ExternalProvider
      );
      const code = await provider.getCode(safeAddress);
      const deployed = code !== '0x' && code !== '0x0';
      
      setIsDeployed(deployed);
      
      if (deployed) {
        localStorage.setItem(`safe_deployed:${safeAddress.toLowerCase()}`, 'true');
      }
      
      console.log('[Safe] Deployment status:', deployed);
      return deployed;
    } catch (e) {
      console.error('[Safe] Failed to check deployment:', e);
      return false;
    }
  }, [safeAddress]);

  // Deploy Safe smart wallet
  const deploySafe = useCallback(async (): Promise<string | null> => {
    if (!address || !safeAddress) {
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

    setIsDeploying(true);
    try {
      toast.info('Deploying Safe wallet...', { 
        description: 'Please confirm the transaction in your wallet' 
      });

      let client = relayClient;
      if (!client) {
        client = await createRelayClient();
      }

      if (!client) {
        throw new Error('Failed to create relay client');
      }

      console.log('[Safe] Deploying Safe...');
      const response = await client.deploy();
      const result = await response.wait();

      if (!result || !result.proxyAddress) {
        throw new Error('Safe deployment failed - no proxy address returned');
      }

      console.log('[Safe] Deployed at:', result.proxyAddress);
      setIsDeployed(true);
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
  }, [address, safeAddress, relayClient, createRelayClient, checkDeployment]);

  // Set token allowances for Polymarket contracts
  const setAllowances = useCallback(async (): Promise<boolean> => {
    if (!safeAddress) {
      toast.error('Safe address not available');
      return false;
    }

    const deployed = await checkDeployment();
    if (!deployed) {
      toast.error('Please deploy your Safe wallet first');
      return false;
    }

    setIsSettingAllowances(true);
    try {
      toast.info('Setting token allowances...', {
        description: 'Batching 6 approvals into one transaction'
      });

      let client = relayClient;
      if (!client) {
        client = await createRelayClient();
      }

      if (!client) {
        throw new Error('Failed to create relay client');
      }

      const MAX_UINT256 = ethers.constants.MaxUint256;

      // Build 6 approval transactions to batch execute via Safe
      const transactions = [
        // USDC approvals (3)
        {
          to: USDC_ADDRESS,
          data: ERC20_INTERFACE.encodeFunctionData('approve', [CTF_EXCHANGE, MAX_UINT256]),
          value: '0'
        },
        {
          to: USDC_ADDRESS,
          data: ERC20_INTERFACE.encodeFunctionData('approve', [NEG_RISK_CTF_EXCHANGE, MAX_UINT256]),
          value: '0'
        },
        {
          to: USDC_ADDRESS,
          data: ERC20_INTERFACE.encodeFunctionData('approve', [NEG_RISK_ADAPTER, MAX_UINT256]),
          value: '0'
        },
        // CTF (ERC1155) approvals (3)
        {
          to: CTF_ADDRESS,
          data: ERC1155_INTERFACE.encodeFunctionData('setApprovalForAll', [CTF_EXCHANGE, true]),
          value: '0'
        },
        {
          to: CTF_ADDRESS,
          data: ERC1155_INTERFACE.encodeFunctionData('setApprovalForAll', [NEG_RISK_CTF_EXCHANGE, true]),
          value: '0'
        },
        {
          to: CTF_ADDRESS,
          data: ERC1155_INTERFACE.encodeFunctionData('setApprovalForAll', [NEG_RISK_ADAPTER, true]),
          value: '0'
        },
      ];

      console.log('[Safe] Executing 6 approval transactions via Safe...');
      const response = await client.execute(transactions);
      const result = await response.wait();

      if (!result) {
        throw new Error('Allowance transaction failed');
      }

      console.log('[Safe] Allowances set successfully');
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
  }, [safeAddress, relayClient, createRelayClient, checkDeployment]);

  // Check if Safe is deployed using RelayClient
  const checkDeploymentViaRelay = useCallback(async (): Promise<boolean> => {
    if (!safeAddress) return false;

    try {
      let client = relayClient;
      if (!client) {
        client = await createRelayClient();
      }

      if (client) {
        const deployed = await (client as any).getDeployed(safeAddress);
        setIsDeployed(deployed);
        if (deployed) {
          localStorage.setItem(`safe_deployed:${safeAddress.toLowerCase()}`, 'true');
        }
        return deployed;
      }
    } catch (e) {
      console.warn('[Safe] Relay check failed, falling back to RPC:', e);
    }

    // Fallback to direct RPC check
    return checkDeployment();
  }, [safeAddress, relayClient, createRelayClient, checkDeployment]);

  return {
    safeAddress,
    isDeployed,
    isDeploying,
    deploySafe,
    checkDeployment: checkDeploymentViaRelay,
    hasAllowances,
    isSettingAllowances,
    setAllowances,
    createRelayClient,
  };
}
