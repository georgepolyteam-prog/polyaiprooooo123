import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';

export type TransferStage = 
  | 'idle' 
  | 'connecting' 
  | 'checking-balance'
  | 'awaiting-signature'
  | 'confirming'
  | 'verifying-credits'
  | 'completed' 
  | 'error';

interface UsePolyTokenTransferReturn {
  stage: TransferStage;
  stageMessage: string;
  signature: string | null;
  error: string | null;
  transfer: (amount: number, destinationAddress: string, tokenMint: string) => Promise<string | null>;
  reset: () => void;
  setCompleted: () => void;
}

const STAGE_MESSAGES: Record<TransferStage, string> = {
  'idle': '',
  'connecting': 'Connecting to Solana...',
  'checking-balance': 'Checking your POLY balance...',
  'awaiting-signature': 'Waiting for wallet signature...',
  'confirming': 'Confirming transaction on-chain...',
  'verifying-credits': 'Adding credits to your account...',
  'completed': 'Deposit successful!',
  'error': 'Something went wrong'
};

export function usePolyTokenTransfer(): UsePolyTokenTransferReturn {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  
  const [stage, setStage] = useState<TransferStage>('idle');
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setCompleted = useCallback(() => {
    setStage('completed');
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setSignature(null);
    setError(null);
  }, []);

  const transfer = useCallback(async (
    amount: number, 
    destinationAddress: string, 
    tokenMint: string
  ): Promise<string | null> => {
    if (!publicKey || !connected) {
      setError('Wallet not connected');
      setStage('error');
      return null;
    }

    try {
      setError(null);
      setSignature(null);
      
      // Stage 1: Connecting
      setStage('connecting');
      await new Promise(r => setTimeout(r, 300)); // Brief visual pause
      
      const mintPubkey = new PublicKey(tokenMint);
      const destinationPubkey = new PublicKey(destinationAddress);
      
      // Stage 2: Check balance
      setStage('checking-balance');
      
      console.log('[POLY transfer] Checking mint:', tokenMint);
      console.log('[POLY transfer] Wallet:', publicKey.toBase58());

      // Try Token-2022 first (PumpFun tokens like POLY)
      let sourceAta: PublicKey | null = null;
      let sourceAccount: any = null;
      let tokenProgramId = TOKEN_2022_PROGRAM_ID;

      let accountInfo = null as any;

      try {
        sourceAta = getAssociatedTokenAddressSync(
          mintPubkey,
          publicKey,
          false,
          TOKEN_2022_PROGRAM_ID
        );
        accountInfo = await connection.getAccountInfo(sourceAta, 'confirmed');

        if (accountInfo) {
          console.log('[POLY transfer] Found Token-2022 account:', sourceAta.toBase58());
        } else {
          console.log('[POLY transfer] Not Token-2022, trying standard SPL...');
        }
      } catch (err) {
        console.warn('[POLY transfer] Token-2022 ATA lookup failed:', err);
      }

      // If Token-2022 didn't work, try standard token program
      if (!accountInfo) {
        tokenProgramId = TOKEN_PROGRAM_ID;

        try {
          sourceAta = getAssociatedTokenAddressSync(
            mintPubkey,
            publicKey,
            false,
            TOKEN_PROGRAM_ID
          );
          accountInfo = await connection.getAccountInfo(sourceAta, 'confirmed');

          if (accountInfo) {
            console.log('[POLY transfer] Found standard SPL account:', sourceAta.toBase58());
          }
        } catch (err) {
          console.warn('[POLY transfer] Standard SPL ATA lookup failed:', err);
        }
      }

      if (!accountInfo || !sourceAta) {
        console.error('[POLY transfer] Token account not found for mint in either program');
        setError('No POLY tokens found in your wallet. Make sure you have POLY tokens.');
        setStage('error');
        return null;
      }

      try {
        sourceAccount = await getAccount(connection, sourceAta, 'confirmed', tokenProgramId);
      } catch (err) {
        console.error('[POLY transfer] Failed to parse token account:', err);
        setError('Found token account but could not read balance. Please try again.');
        setStage('error');
        return null;
      }

      console.log('[POLY transfer] Using token program:', tokenProgramId.toBase58());
      
      const balance = Number(sourceAccount.amount) / 1e6; // POLY has 6 decimals
      console.log('[POLY transfer] Raw amount:', sourceAccount.amount?.toString?.() ?? sourceAccount.amount);
      console.log('[POLY transfer] Detected balance:', balance, 'POLY');

      if (balance < amount) {
        setError(`Insufficient balance. You have ${balance.toFixed(2)} POLY but need ${amount} POLY.`);
        setStage('error');
        return null;
      }
      
      // Get destination token account using the same token program
      const destinationAta = await getAssociatedTokenAddress(
        mintPubkey,
        destinationPubkey,
        false,
        tokenProgramId
      );
      
      // Stage 3: Awaiting signature
      setStage('awaiting-signature');
      
      // Create transfer instruction (amount in smallest units - 6 decimals for POLY)
      const transferInstruction = createTransferInstruction(
        sourceAta,
        destinationAta,
        publicKey,
        amount * 1e6, // Convert to smallest unit
        [],
        tokenProgramId
      );
      
      // Create transaction
      const transaction = new Transaction().add(transferInstruction);
      
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      // Send transaction (this will prompt wallet signature)
      const txSignature = await sendTransaction(transaction, connection);
      setSignature(txSignature);
      
      // Stage 4: Confirming
      setStage('confirming');
      
      // Wait for confirmation
      await connection.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      // Stage 5: Verifying credits (handled by caller)
      setStage('verifying-credits');
      
      return txSignature;
      
    } catch (err: any) {
      console.error('Transfer error:', err);
      
      // Handle user rejection
      if (err.message?.includes('User rejected') || err.name === 'WalletSignTransactionError') {
        setError('Transaction cancelled. You can try again when ready.');
      } else if (err.message?.includes('insufficient')) {
        setError('Insufficient SOL for transaction fees.');
      } else {
        setError(err.message || 'Transfer failed. Please try again.');
      }
      
      setStage('error');
      return null;
    }
  }, [publicKey, connected, connection, sendTransaction]);

  return {
    stage,
    stageMessage: error && stage === 'error' ? error : STAGE_MESSAGES[stage],
    signature,
    error,
    transfer,
    reset,
    setCompleted
  };
}
