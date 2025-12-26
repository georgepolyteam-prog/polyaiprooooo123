import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder/derive';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';

const POLYGON_CHAIN_ID = 137;
const BUILDER_SIGNER_URL = 'https://builder-signer.domeapi.io/builder-signer/sign';
const RELAYER_URL = 'https://relayer-v2.polymarket.com/';

// Polygon public RPC for reliable deployment checks
const POLYGON_RPC_URL = 'https://polygon-rpc.com';

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
  const polygonPublicClient = usePublicClient({ chainId: POLYGON_CHAIN_ID });
  
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeployed, setIsDeployed] = useState(false);
  const [isSettingAllowances, setIsSettingAllowances] = useState(false);
  const [hasAllowances, setHasAllowances] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [relayClient, setRelayClient] = useState<RelayClient | null>(null);
  
  // Track if we've confirmed deployment to avoid flaky re-checks
  const deploymentConfirmed = useRef(false);

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
        deploymentConfirmed.current = true;
      }
      const allowancesCached = localStorage.getItem(`safe_allowances:${safeAddress.toLowerCase()}`);
      if (allowancesCached === 'true') {
        setHasAllowances(true);
      }
    }
  }, [safeAddress]);

  // Check deployment status using Polygon-specific provider (not window.ethereum which may be on wrong chain)
  const checkDeploymentPolygon = useCallback(async (): Promise<boolean> => {
    if (!safeAddress) return false;
    
    // If we've already confirmed deployment, don't re-check (avoids flaky resets)
    if (deploymentConfirmed.current) {
      console.log('[Safe] Deployment already confirmed, skipping check');
      return true;
    }

    try {
      // Use wagmi's Polygon public client if available
      if (polygonPublicClient) {
        const bytecode = await polygonPublicClient.getBytecode({ address: safeAddress as `0x${string}` });
        const deployed = !!bytecode && bytecode !== '0x';
        
        if (deployed) {
          setIsDeployed(true);
          deploymentConfirmed.current = true;
          localStorage.setItem(`safe_deployed:${safeAddress.toLowerCase()}`, 'true');
        }
        console.log('[Safe] Polygon deployment status:', deployed);
        return deployed;
      }
      
      // Fallback to Polygon RPC directly
      const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC_URL);
      const code = await provider.getCode(safeAddress);
      const deployed = code !== '0x' && code !== '0x0';
      
      if (deployed) {
        setIsDeployed(true);
        deploymentConfirmed.current = true;
        localStorage.setItem(`safe_deployed:${safeAddress.toLowerCase()}`, 'true');
      }
      console.log('[Safe] Polygon RPC deployment status:', deployed);
      return deployed;
    } catch (e) {
      console.error('[Safe] Polygon deployment check failed:', e);
      return false;
    }
  }, [safeAddress, polygonPublicClient]);

  // Check deployment status on mount/wallet change
  useEffect(() => {
    if (safeAddress && address) {
      checkDeploymentPolygon();
    }
  }, [safeAddress, address, checkDeploymentPolygon]);
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

  // Check if Safe is deployed on-chain (uses Polygon-specific provider)
  const checkDeployment = useCallback(async (): Promise<boolean> => {
    return checkDeploymentPolygon();
  }, [checkDeploymentPolygon]);

  // Deploy Safe smart wallet
  const deploySafe = useCallback(async (): Promise<string | null> => {
    if (!address || !safeAddress) {
      toast.error('Connect wallet first');
      return null;
    }

    // Check if already deployed using Polygon-specific check
    const alreadyDeployed = await checkDeploymentPolygon();
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
      deploymentConfirmed.current = true; // Mark as confirmed to prevent flaky resets
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
  }, [address, safeAddress, relayClient, createRelayClient, checkDeploymentPolygon]);

  // Set token allowances for Polymarket contracts
  const setAllowances = useCallback(async (): Promise<boolean> => {
    if (!safeAddress) {
      console.log('[Safe] setAllowances aborted: no safeAddress');
      toast.error('Safe address not available');
      return false;
    }

    // Check deployment - use confirmed flag to avoid flaky checks
    if (!deploymentConfirmed.current) {
      const deployed = await checkDeploymentPolygon();
      if (!deployed) {
        console.log('[Safe] setAllowances aborted: Safe not deployed');
        toast.error('Please deploy your Safe wallet first');
        return false;
      }
    }
    console.log('[Safe] setAllowances: deployment confirmed, proceeding...');

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
  }, [safeAddress, relayClient, createRelayClient, checkDeploymentPolygon]);

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

  // Withdraw USDC from Safe to EOA
  const withdrawUSDC = useCallback(async (amount: number, toAddress: string): Promise<boolean> => {
    if (!safeAddress) {
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

      let client = relayClient;
      if (!client) {
        client = await createRelayClient();
      }

      if (!client) {
        throw new Error('Failed to create relay client');
      }

      // Convert amount to USDC units (6 decimals)
      const amountInUnits = Math.floor(amount * 1e6);

      // Build transfer transaction
      const ERC20_TRANSFER_INTERFACE = new ethers.utils.Interface([
        'function transfer(address to, uint256 amount)'
      ]);

      const transaction = {
        to: USDC_ADDRESS,
        data: ERC20_TRANSFER_INTERFACE.encodeFunctionData('transfer', [toAddress, amountInUnits]),
        value: '0'
      };

      console.log('[Safe] Executing USDC transfer:', { amount, amountInUnits, toAddress });
      const response = await client.execute([transaction]);
      const result = await response.wait();

      if (!result) {
        throw new Error('Withdrawal transaction failed');
      }

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
    isWithdrawing,
    withdrawUSDC,
    createRelayClient,
  };
}
