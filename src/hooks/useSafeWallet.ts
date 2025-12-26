import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { toast } from 'sonner';
import { 
  deriveSafeAddress, 
  isSafeDeployed, 
  getPolygonProvider,
  createRelayClient,
  deploySafe as deployNewSafe,
  setSafeUsdcApproval,
} from '@dome-api/sdk';
import type { RouterSigner } from '@dome-api/sdk';
import { ethers } from 'ethers';

const POLYGON_CHAIN_ID = 137;
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

/**
 * Create RouterSigner adapter from wagmi walletClient
 */
function createRouterSigner(walletClient: any, address: string): RouterSigner {
  return {
    getAddress: async () => address,
    signTypedData: async (payload: any) => {
      return walletClient.signTypedData({
        domain: payload.domain,
        types: payload.types,
        primaryType: payload.primaryType,
        message: payload.message,
      });
    },
  };
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

  // Derive Safe address deterministically using Dome SDK
  const safeAddress = useMemo(() => {
    if (!address) return null;
    try {
      const derived = deriveSafeAddress(address);
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

  // Check deployment status using Dome SDK
  const checkDeployment = useCallback(async (): Promise<boolean> => {
    if (!safeAddress) return false;
    
    // If we've already confirmed deployment, don't re-check (avoids flaky resets)
    if (deploymentConfirmed.current) {
      console.log('[Safe] Deployment already confirmed, skipping check');
      return true;
    }

    try {
      const provider = getPolygonProvider();
      const deployed = await isSafeDeployed(safeAddress, provider);
      
      if (deployed) {
        setIsDeployed(true);
        deploymentConfirmed.current = true;
        localStorage.setItem(`safe_deployed:${safeAddress.toLowerCase()}`, 'true');
      }
      console.log('[Safe] Polygon deployment status:', deployed);
      return deployed;
    } catch (e) {
      console.error('[Safe] Polygon deployment check failed:', e);
      return false;
    }
  }, [safeAddress]);

  // Check deployment status on mount/wallet change
  useEffect(() => {
    if (safeAddress && address) {
      checkDeployment();
    }
  }, [safeAddress, address, checkDeployment]);

  // Deploy Safe smart wallet using Dome SDK
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

    setIsDeploying(true);
    try {
      toast.info('Deploying Safe wallet...', { 
        description: 'Please confirm the transaction in your wallet' 
      });

      // Create RouterSigner and RelayClient using Dome SDK
      const signer = createRouterSigner(walletClient, address);
      const relayClient = createRelayClient(signer);

      console.log('[Safe] Deploying Safe...');
      const result = await deployNewSafe(relayClient);

      console.log('[Safe] Deployed at:', result.safeAddress);
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

  // Set token allowances for Polymarket contracts using Dome SDK
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

    setIsSettingAllowances(true);
    try {
      toast.info('Setting token allowances...', {
        description: 'Batching approvals into one transaction'
      });

      // Create RouterSigner and RelayClient using Dome SDK
      const signer = createRouterSigner(walletClient, address);
      const relayClient = createRelayClient(signer);

      console.log('[Safe] Setting allowances via Dome SDK...');
      await setSafeUsdcApproval(relayClient);

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

      // Create RouterSigner and RelayClient using Dome SDK
      const signer = createRouterSigner(walletClient, address);
      const relayClient = createRelayClient(signer);

      // Convert amount to USDC units (6 decimals)
      const amountInUnits = Math.floor(amount * 1e6);

      // Build transfer transaction
      const ERC20_TRANSFER_INTERFACE = new ethers.utils.Interface([
        'function transfer(address to, uint256 amount)'
      ]);

      const transaction = {
        to: USDC_ADDRESS,
        data: ERC20_TRANSFER_INTERFACE.encodeFunctionData('transfer', [toAddress, amountInUnits]),
        value: '0',
        operation: 0, // Call operation
      };

      console.log('[Safe] Executing USDC transfer:', { amount, amountInUnits, toAddress });
      const response = await relayClient.execute([transaction] as any);
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
    isWithdrawing,
    withdrawUSDC,
  };
}
