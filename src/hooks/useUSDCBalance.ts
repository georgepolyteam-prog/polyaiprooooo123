import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { polygon } from 'wagmi/chains';

// USDC on Polygon
const USDC_POLYGON = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const;

// Polymarket Contract Addresses (from official examples)
const CTF_CONTRACT = '0x4d97dcd97ec945f40cf65f87097ace5ea0476045' as const;
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as const;
const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a' as const;
const NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296' as const;

// Max uint256 for unlimited approval
const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

// Minimal ERC20 ABI for balance and approval
const erc20Abi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// ERC1155 ABI for outcome token approvals
const erc1155Abi = [
  {
    name: 'isApprovedForAll',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'setApprovalForAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
] as const;

interface UseUSDCBalanceOptions {
  /** Address to check balance for (defaults to connected wallet) */
  targetAddress?: `0x${string}` | string;
}

export function useUSDCBalance(options: UseUSDCBalanceOptions = {}) {
  const { address: connectedAddress, isConnected } = useAccount();
  const [isApproving, setIsApproving] = useState(false);

  // Use targetAddress if provided, otherwise use connected address
  const address = (options.targetAddress as `0x${string}`) || connectedAddress;

  // Read USDC balance for target address
  const { 
    data: balanceData, 
    isLoading: isLoadingBalance,
    refetch: refetchBalance,
  } = useReadContract({
    address: USDC_POLYGON,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: polygon.id,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Read USDC allowances for all 4 required spenders
  const { data: ctfContractAllowance, refetch: refetchCtfContractAllowance } = useReadContract({
    address: USDC_POLYGON,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, CTF_CONTRACT] : undefined,
    chainId: polygon.id,
    query: { enabled: !!address && isConnected },
  });

  const { data: ctfExchangeAllowance, refetch: refetchCtfExchangeAllowance } = useReadContract({
    address: USDC_POLYGON,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, CTF_EXCHANGE] : undefined,
    chainId: polygon.id,
    query: { enabled: !!address && isConnected },
  });

  const { data: negRiskExchangeAllowance, refetch: refetchNegRiskExchangeAllowance } = useReadContract({
    address: USDC_POLYGON,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, NEG_RISK_CTF_EXCHANGE] : undefined,
    chainId: polygon.id,
    query: { enabled: !!address && isConnected },
  });

  const { data: negRiskAdapterAllowance, refetch: refetchNegRiskAdapterAllowance } = useReadContract({
    address: USDC_POLYGON,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, NEG_RISK_ADAPTER] : undefined,
    chainId: polygon.id,
    query: { enabled: !!address && isConnected },
  });

  // Read ERC1155 approvals for outcome tokens (3 operators)
  const { data: ctfExchangeErc1155Approved, refetch: refetchCtfExchangeErc1155 } = useReadContract({
    address: CTF_CONTRACT,
    abi: erc1155Abi,
    functionName: 'isApprovedForAll',
    args: address ? [address, CTF_EXCHANGE] : undefined,
    chainId: polygon.id,
    query: { enabled: !!address && isConnected },
  });

  const { data: negRiskExchangeErc1155Approved, refetch: refetchNegRiskExchangeErc1155 } = useReadContract({
    address: CTF_CONTRACT,
    abi: erc1155Abi,
    functionName: 'isApprovedForAll',
    args: address ? [address, NEG_RISK_CTF_EXCHANGE] : undefined,
    chainId: polygon.id,
    query: { enabled: !!address && isConnected },
  });

  const { data: negRiskAdapterErc1155Approved, refetch: refetchNegRiskAdapterErc1155 } = useReadContract({
    address: CTF_CONTRACT,
    abi: erc1155Abi,
    functionName: 'isApprovedForAll',
    args: address ? [address, NEG_RISK_ADAPTER] : undefined,
    chainId: polygon.id,
    query: { enabled: !!address && isConnected },
  });

  // Write contract for approvals
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  
  const [isWaitingForConfirmation, setIsWaitingForConfirmation] = useState(false);

  // Format balance to human-readable USDC (6 decimals)
  const balance = balanceData ? Number(balanceData) / 1e6 : 0;
  const formattedBalance = balance.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });

  // Check USDC approvals (need at least 1M USDC threshold)
  const APPROVAL_THRESHOLD = BigInt(1e12); // 1M USDC
  const isApprovedCtfContract = ctfContractAllowance ? ctfContractAllowance >= APPROVAL_THRESHOLD : false;
  const isApprovedCtfExchange = ctfExchangeAllowance ? ctfExchangeAllowance >= APPROVAL_THRESHOLD : false;
  const isApprovedNegRiskExchange = negRiskExchangeAllowance ? negRiskExchangeAllowance >= APPROVAL_THRESHOLD : false;
  const isApprovedNegRiskAdapter = negRiskAdapterAllowance ? negRiskAdapterAllowance >= APPROVAL_THRESHOLD : false;

  // Check ERC1155 approvals
  const isErc1155CtfExchangeApproved = !!ctfExchangeErc1155Approved;
  const isErc1155NegRiskExchangeApproved = !!negRiskExchangeErc1155Approved;
  const isErc1155NegRiskAdapterApproved = !!negRiskAdapterErc1155Approved;

  // All approvals required for trading
  const isFullyApproved = 
    isApprovedCtfContract && 
    isApprovedCtfExchange && 
    isApprovedNegRiskExchange && 
    isApprovedNegRiskAdapter &&
    isErc1155CtfExchangeApproved &&
    isErc1155NegRiskExchangeApproved &&
    isErc1155NegRiskAdapterApproved;

  // Legacy compatibility
  const isApprovedForCTF = isApprovedCtfExchange;
  const isApprovedForNegRisk = isApprovedNegRiskExchange;

  // Get public client for waiting for transactions
  const publicClient = usePublicClient({ chainId: polygon.id });

  // Helper to wait for transaction confirmation
  const waitForTransaction = async (hash: `0x${string}`, description: string) => {
    if (!publicClient) throw new Error('Public client not available');
    
    toast.info(`${description} - waiting for confirmation...`);
    setIsWaitingForConfirmation(true);
    
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        confirmations: 1,
      });
      
      if (receipt.status === 'reverted') {
        throw new Error(`${description} transaction reverted`);
      }
      
      toast.success(`${description} confirmed!`);
      return receipt;
    } finally {
      setIsWaitingForConfirmation(false);
    }
  };

  // Check if balance is sufficient for an amount
  const hasSufficientBalance = (amount: number) => balance >= amount;

  // Approve all required contracts for USDC spending and outcome token management
  const approveUSDC = useCallback(async () => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return false;
    }

    if (!publicClient) {
      toast.error('Network not ready');
      return false;
    }

    setIsApproving(true);

    try {
      // USDC ERC20 approvals (4 spenders)
      const usdcSpenders = [
        { name: 'CTF Contract', address: CTF_CONTRACT, approved: isApprovedCtfContract },
        { name: 'CTF Exchange', address: CTF_EXCHANGE, approved: isApprovedCtfExchange },
        { name: 'Neg Risk Exchange', address: NEG_RISK_CTF_EXCHANGE, approved: isApprovedNegRiskExchange },
        { name: 'Neg Risk Adapter', address: NEG_RISK_ADAPTER, approved: isApprovedNegRiskAdapter },
      ];

      for (const spender of usdcSpenders) {
        if (!spender.approved) {
          toast.info(`Approving USDC for ${spender.name}...`);
          const hash = await writeContractAsync({
            account: address as `0x${string}`,
            chain: polygon,
            address: USDC_POLYGON,
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender.address, MAX_UINT256],
          });
          // Wait for transaction to be confirmed on-chain
          await waitForTransaction(hash, `USDC approval for ${spender.name}`);
        }
      }

      // ERC1155 approvals for outcome tokens (3 operators)
      const erc1155Operators = [
        { name: 'CTF Exchange', address: CTF_EXCHANGE, approved: isErc1155CtfExchangeApproved },
        { name: 'Neg Risk Exchange', address: NEG_RISK_CTF_EXCHANGE, approved: isErc1155NegRiskExchangeApproved },
        { name: 'Neg Risk Adapter', address: NEG_RISK_ADAPTER, approved: isErc1155NegRiskAdapterApproved },
      ];

      for (const operator of erc1155Operators) {
        if (!operator.approved) {
          toast.info(`Approving outcome tokens for ${operator.name}...`);
          const hash = await writeContractAsync({
            account: address as `0x${string}`,
            chain: polygon,
            address: CTF_CONTRACT,
            abi: erc1155Abi,
            functionName: 'setApprovalForAll',
            args: [operator.address, true],
          });
          // Wait for transaction to be confirmed on-chain
          await waitForTransaction(hash, `Outcome token approval for ${operator.name}`);
        }
      }

      // Refetch all allowances after confirmations
      await Promise.all([
        refetchCtfContractAllowance(),
        refetchCtfExchangeAllowance(),
        refetchNegRiskExchangeAllowance(),
        refetchNegRiskAdapterAllowance(),
        refetchCtfExchangeErc1155(),
        refetchNegRiskExchangeErc1155(),
        refetchNegRiskAdapterErc1155(),
      ]);

      toast.success('All trading approvals confirmed!');
      return true;
    } catch (error: unknown) {
      console.error('Approval error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve';
      toast.error(errorMessage);
      return false;
    } finally {
      setIsApproving(false);
    }
  }, [
    address, 
    publicClient,
    isApprovedCtfContract, isApprovedCtfExchange, isApprovedNegRiskExchange, isApprovedNegRiskAdapter,
    isErc1155CtfExchangeApproved, isErc1155NegRiskExchangeApproved, isErc1155NegRiskAdapterApproved,
    writeContractAsync,
    refetchCtfContractAllowance, refetchCtfExchangeAllowance, refetchNegRiskExchangeAllowance, refetchNegRiskAdapterAllowance,
    refetchCtfExchangeErc1155, refetchNegRiskExchangeErc1155, refetchNegRiskAdapterErc1155,
  ]);
  // Refetch all data
  const refetch = async () => {
    await Promise.all([
      refetchBalance(),
      refetchCtfContractAllowance(),
      refetchCtfExchangeAllowance(),
      refetchNegRiskExchangeAllowance(),
      refetchNegRiskAdapterAllowance(),
      refetchCtfExchangeErc1155(),
      refetchNegRiskExchangeErc1155(),
      refetchNegRiskAdapterErc1155(),
    ]);
  };

  return {
    balance,
    formattedBalance,
    isLoadingBalance,
    isApprovedForCTF,
    isApprovedForNegRisk,
    isFullyApproved,
    isApproving: isApproving || isWritePending || isWaitingForConfirmation,
    hasSufficientBalance,
    approveUSDC,
    refetch,
    USDC_POLYGON,
    CTF_EXCHANGE,
    NEG_RISK_CTF_EXCHANGE,
  };
}
