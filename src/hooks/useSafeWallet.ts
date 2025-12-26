import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { toast } from 'sonner';
import { ethers } from 'ethers';

const POLYGON_CHAIN_ID = 137;
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

// Polymarket exchange contracts
const POLYMARKET_CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const POLYMARKET_NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';

// Safe constants for address derivation
const SAFE_FACTORY_ADDRESS = '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2';
const SAFE_SINGLETON_ADDRESS = '0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552';
const SAFE_FALLBACK_HANDLER = '0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4';

// Polygon RPC for read operations
const POLYGON_RPC = 'https://polygon-rpc.com';

/**
 * Derive Safe address from EOA using CREATE2
 * This matches the derivation used by Polymarket/Dome
 */
function deriveSafeAddress(ownerAddress: string): string {
  const owners = [ownerAddress.toLowerCase()];
  const threshold = 1;

  // Encode Safe setup data
  const safeInterface = new ethers.utils.Interface([
    'function setup(address[] calldata _owners, uint256 _threshold, address to, bytes calldata data, address fallbackHandler, address paymentToken, uint256 payment, address payable paymentReceiver)'
  ]);

  const setupData = safeInterface.encodeFunctionData('setup', [
    owners,
    threshold,
    ethers.constants.AddressZero,
    '0x',
    SAFE_FALLBACK_HANDLER,
    ethers.constants.AddressZero,
    0,
    ethers.constants.AddressZero,
  ]);

  // Create salt from setup hash
  const salt = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'uint256'],
      [ethers.utils.keccak256(setupData), 0]
    )
  );

  // Calculate CREATE2 address
  const proxyCreationCode = ethers.utils.solidityPack(
    ['bytes', 'bytes32'],
    [
      '0x608060405234801561001057600080fd5b5060405161017338038061017383398101604081905261002f91610059565b6001600160a01b0316600090815260016020819052604090912055610087565b60006020828403121561006a578081fd5b81516001600160a01b038116811461008057600080fd5b9392505050565b60de8061009560003960006101f35260f3fe',
      ethers.utils.defaultAbiCoder.encode(['address'], [SAFE_SINGLETON_ADDRESS])
    ]
  );

  const initCodeHash = ethers.utils.keccak256(proxyCreationCode);

  const safeAddress = ethers.utils.getCreate2Address(
    SAFE_FACTORY_ADDRESS,
    salt,
    initCodeHash
  );

  return safeAddress;
}

/**
 * Check if Safe is deployed on Polygon
 */
async function checkSafeDeployed(safeAddress: string): Promise<boolean> {
  try {
    const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
    const code = await provider.getCode(safeAddress);
    return code !== '0x' && code.length > 2;
  } catch (e) {
    console.error('[Safe] Failed to check deployment:', e);
    return false;
  }
}

/**
 * Convert wagmi walletClient to ethers signer
 */
function walletClientToSigner(walletClient: any): ethers.Signer {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new ethers.providers.Web3Provider(transport, network);
  return provider.getSigner(account.address);
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

  // Derive Safe address deterministically
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

  // Check deployment status
  const checkDeployment = useCallback(async (): Promise<boolean> => {
    if (!safeAddress) return false;
    
    // If we've already confirmed deployment, don't re-check
    if (deploymentConfirmed.current) {
      console.log('[Safe] Deployment already confirmed, skipping check');
      return true;
    }

    try {
      const deployed = await checkSafeDeployed(safeAddress);
      
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

  // Deploy Safe smart wallet
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

      // Create signer from walletClient
      const signer = walletClientToSigner(walletClient);

      // Safe Factory interface
      const factoryInterface = new ethers.utils.Interface([
        'function createProxyWithNonce(address _singleton, bytes memory initializer, uint256 saltNonce) external returns (address proxy)'
      ]);

      // Safe setup data
      const safeInterface = new ethers.utils.Interface([
        'function setup(address[] calldata _owners, uint256 _threshold, address to, bytes calldata data, address fallbackHandler, address paymentToken, uint256 payment, address payable paymentReceiver)'
      ]);

      const setupData = safeInterface.encodeFunctionData('setup', [
        [address],
        1,
        ethers.constants.AddressZero,
        '0x',
        SAFE_FALLBACK_HANDLER,
        ethers.constants.AddressZero,
        0,
        ethers.constants.AddressZero,
      ]);

      const factory = new ethers.Contract(SAFE_FACTORY_ADDRESS, factoryInterface, signer);
      
      console.log('[Safe] Deploying Safe...');
      const tx = await factory.createProxyWithNonce(SAFE_SINGLETON_ADDRESS, setupData, 0);
      await tx.wait();

      console.log('[Safe] Deployed at:', safeAddress);
      setIsDeployed(true);
      deploymentConfirmed.current = true;
      localStorage.setItem(`safe_deployed:${safeAddress.toLowerCase()}`, 'true');
      
      toast.success('Safe wallet deployed!', {
        description: `Address: ${safeAddress.slice(0, 10)}...`
      });

      return safeAddress;
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

  // Set token allowances for Polymarket contracts
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
        description: 'Please confirm the transaction in your wallet'
      });

      // Create signer from walletClient
      const signer = walletClientToSigner(walletClient);

      // USDC interface
      const erc20Interface = new ethers.utils.Interface([
        'function approve(address spender, uint256 amount) external returns (bool)'
      ]);

      const usdc = new ethers.Contract(USDC_ADDRESS, erc20Interface, signer);
      const maxApproval = ethers.constants.MaxUint256;

      // Approve both exchange contracts
      console.log('[Safe] Approving CTF Exchange...');
      const tx1 = await usdc.approve(POLYMARKET_CTF_EXCHANGE, maxApproval);
      await tx1.wait();

      console.log('[Safe] Approving Neg Risk CTF Exchange...');
      const tx2 = await usdc.approve(POLYMARKET_NEG_RISK_CTF_EXCHANGE, maxApproval);
      await tx2.wait();

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

      // Create signer from walletClient
      const signer = walletClientToSigner(walletClient);

      // Convert amount to USDC units (6 decimals)
      const amountInUnits = ethers.utils.parseUnits(amount.toString(), 6);

      // USDC transfer interface
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
    isWithdrawing,
    withdrawUSDC,
  };
}
