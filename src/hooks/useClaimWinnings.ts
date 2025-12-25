import { useState, useCallback } from 'react';
import { useAccount, useWriteContract, useReadContract, useChainId } from 'wagmi';
import { polygon } from 'wagmi/chains';
import { toast } from 'sonner';

// Polygon chain ID
const POLYGON_CHAIN_ID = 137;

// Conditional Token Framework (CTF) contract on Polygon
const CTF_CONTRACT = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as const;
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const;
const ZERO_BYTES = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

// CTF ABI - only the functions we need
const CTF_ABI = [
  {
    inputs: [
      { name: 'collateralToken', type: 'address' },
      { name: 'parentCollectionId', type: 'bytes32' },
      { name: 'conditionId', type: 'bytes32' },
      { name: 'indexSets', type: 'uint256[]' },
    ],
    name: 'redeemPositions',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'conditionId', type: 'bytes32' }],
    name: 'payoutNumerators',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'conditionId', type: 'bytes32' }],
    name: 'payoutDenominator',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface ClaimablePosition {
  conditionId: string;
  title: string;
  eventSlug: string;
  outcome: 'YES' | 'NO';
  winningShares: number;
  claimableUsdc: number;
  yesTokenId?: string;
  noTokenId?: string;
}

export interface ClaimState {
  status: 'idle' | 'pending' | 'confirming' | 'success' | 'error';
  hash?: `0x${string}`;
  error?: string;
}

export function useClaimWinnings() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [claimStates, setClaimStates] = useState<Record<string, ClaimState>>({});

  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  const updateClaimState = useCallback((conditionId: string, state: Partial<ClaimState>) => {
    setClaimStates(prev => ({
      ...prev,
      [conditionId]: { ...prev[conditionId], ...state } as ClaimState,
    }));
  }, []);

  const claimWinnings = useCallback(async (position: ClaimablePosition): Promise<boolean> => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first');
      return false;
    }

    if (chainId !== POLYGON_CHAIN_ID) {
      toast.error('Please switch to Polygon network');
      return false;
    }

    const { conditionId } = position;

    try {
      updateClaimState(conditionId, { status: 'pending', error: undefined });

      // Call redeemPositions on the CTF contract
      const hash = await writeContractAsync({
        account: address as `0x${string}`,
        chain: polygon,
        address: CTF_CONTRACT,
        abi: CTF_ABI,
        functionName: 'redeemPositions',
        args: [
          USDC_ADDRESS,
          ZERO_BYTES,
          conditionId as `0x${string}`,
          [BigInt(1), BigInt(2)], // Index sets for YES|NO partition
        ],
      });

      updateClaimState(conditionId, { status: 'confirming', hash });
      toast.info('Transaction submitted, waiting for confirmation...');

      // Note: Transaction confirmation will be handled by the component
      // using useWaitForTransactionReceipt
      return true;
    } catch (error: any) {
      console.error('Claim failed:', error);
      const errorMessage = error?.message?.includes('User rejected')
        ? 'Transaction rejected'
        : 'Claim failed. Please try again.';
      
      updateClaimState(conditionId, { status: 'error', error: errorMessage });
      toast.error(errorMessage);
      return false;
    }
  }, [address, isConnected, chainId, writeContractAsync, updateClaimState]);

  const resetClaimState = useCallback((conditionId: string) => {
    setClaimStates(prev => {
      const newState = { ...prev };
      delete newState[conditionId];
      return newState;
    });
  }, []);

  const getClaimState = useCallback((conditionId: string): ClaimState => {
    return claimStates[conditionId] || { status: 'idle' };
  }, [claimStates]);

  return {
    claimWinnings,
    claimStates,
    getClaimState,
    resetClaimState,
    updateClaimState,
    isWritePending,
  };
}

// Helper hook to check token balance
export function useTokenBalance(tokenId: string | undefined, enabled: boolean = true) {
  const { address } = useAccount();

  const { data: balance, isLoading, refetch } = useReadContract({
    address: CTF_CONTRACT,
    abi: CTF_ABI,
    functionName: 'balanceOf',
    args: address && tokenId ? [address, BigInt(tokenId)] : undefined,
    query: {
      enabled: enabled && !!address && !!tokenId,
    },
  });

  return {
    balance: balance ? Number(balance) / 1e6 : 0, // Convert from USDC decimals
    isLoading,
    refetch,
  };
}

// Helper hook to check if payouts are settled (payoutDenominator > 0)
export function usePayoutSettled(conditionId: string | undefined, enabled: boolean = true) {
  const { data: denominator, isLoading, refetch } = useReadContract({
    address: CTF_CONTRACT,
    abi: CTF_ABI,
    functionName: 'payoutDenominator',
    args: conditionId ? [conditionId as `0x${string}`] : undefined,
    query: {
      enabled: enabled && !!conditionId,
    },
  });

  const isSettled = denominator !== undefined && denominator > BigInt(0);

  return {
    isSettled,
    denominator: denominator ? Number(denominator) : 0,
    isLoading,
    refetch,
  };
}
