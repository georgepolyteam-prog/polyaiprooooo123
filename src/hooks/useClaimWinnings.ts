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

// USDC Transfer event signature
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;

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
  status: 'idle' | 'pending' | 'confirming' | 'verifying' | 'success' | 'failed' | 'error';
  hash?: `0x${string}`;
  error?: string;
  verifiedAmount?: number; // Actual USDC received (verified from logs)
  usdcTransferred?: boolean; // Whether USDC transfer was found in logs
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

/**
 * Comprehensive hook to check payout status
 * Checks both payoutDenominator AND payoutNumerators to ensure payouts are truly settled
 */
export function usePayoutStatus(conditionId: string | undefined, enabled: boolean = true) {
  // Check payoutDenominator
  const { data: denominator, isLoading: isDenomLoading, refetch: refetchDenom } = useReadContract({
    address: CTF_CONTRACT,
    abi: CTF_ABI,
    functionName: 'payoutDenominator',
    args: conditionId ? [conditionId as `0x${string}`] : undefined,
    query: {
      enabled: enabled && !!conditionId,
    },
  });

  // Check payoutNumerators (returns array)
  const { data: numerators, isLoading: isNumLoading, refetch: refetchNum } = useReadContract({
    address: CTF_CONTRACT,
    abi: CTF_ABI,
    functionName: 'payoutNumerators',
    args: conditionId ? [conditionId as `0x${string}`] : undefined,
    query: {
      enabled: enabled && !!conditionId,
    },
  });

  const isLoading = isDenomLoading || isNumLoading;
  
  // Payouts are reported if denominator > 0
  const payoutsReported = denominator !== undefined && denominator > BigInt(0);
  
  // Check if both numerators are zero (shouldn't happen if denominator > 0, but be safe)
  const bothNumeratorsZero = numerators !== undefined && 
    numerators.length >= 2 && 
    numerators[0] === BigInt(0) && 
    numerators[1] === BigInt(0);
  
  // Ready for redemption: denominator > 0 AND at least one numerator is non-zero
  const readyForRedemption = payoutsReported && !bothNumeratorsZero;
  
  // Determine winning outcome
  let winningOutcome: 'YES' | 'NO' | null = null;
  if (numerators && numerators.length >= 2) {
    if (numerators[1] > BigInt(0)) {
      winningOutcome = 'YES';
    } else if (numerators[0] > BigInt(0)) {
      winningOutcome = 'NO';
    }
  }

  const refetch = useCallback(() => {
    refetchDenom();
    refetchNum();
  }, [refetchDenom, refetchNum]);

  return {
    payoutsReported,
    readyForRedemption,
    winningOutcome,
    denominator: denominator ? Number(denominator) : 0,
    numerators: numerators ? numerators.map(n => Number(n)) : [],
    isLoading,
    refetch,
  };
}

// Legacy hook for backward compatibility - now uses usePayoutStatus internally
export function usePayoutSettled(conditionId: string | undefined, enabled: boolean = true) {
  const { payoutsReported, denominator, isLoading, refetch } = usePayoutStatus(conditionId, enabled);

  return {
    isSettled: payoutsReported,
    denominator,
    isLoading,
    refetch,
  };
}

/**
 * Helper function to verify USDC transfer from transaction logs
 * Returns the amount of USDC transferred, or null if no transfer found
 */
export function verifyUsdcTransfer(logs: readonly { address: string; topics: readonly string[]; data: string }[]): number | null {
  const usdcTransferLog = logs.find(log => 
    log.address.toLowerCase() === USDC_ADDRESS.toLowerCase() &&
    log.topics[0] === TRANSFER_TOPIC
  );

  if (!usdcTransferLog) {
    return null;
  }

  try {
    // Parse the amount from the log data
    const amount = BigInt(usdcTransferLog.data);
    // Convert from USDC decimals (6)
    return Number(amount) / 1e6;
  } catch {
    return null;
  }
}
