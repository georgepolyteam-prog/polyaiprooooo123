import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID
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
      
      // Try both TOKEN_PROGRAM_ID and TOKEN_2022_PROGRAM_ID (PumpFun uses Token-2022)
      let sourceAta: PublicKey | null = null;
      let sourceAccount: any = null;
      let tokenProgramId = TOKEN_PROGRAM_ID;
      
      // First try standard SPL Token
      try {
        const standardAta = await getAssociatedTokenAddress(
          mintPubkey,
          publicKey,
          false,
          TOKEN_PROGRAM_ID
        );
        sourceAccount = await getAccount(connection, standardAta, 'confirmed', TOKEN_PROGRAM_ID);
        sourceAta = standardAta;
        tokenProgramId = TOKEN_PROGRAM_ID;
      } catch (e) {
        // Try Token-2022 (used by PumpFun)
        try {
          const token2022Ata = await getAssociatedTokenAddress(
            mintPubkey,
            publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
          );
          sourceAccount = await getAccount(connection, token2022Ata, 'confirmed', TOKEN_2022_PROGRAM_ID);
          sourceAta = token2022Ata;
          tokenProgramId = TOKEN_2022_PROGRAM_ID;
        } catch (e2) {
          setError('No POLY tokens found in your wallet. Make sure you have POLY tokens.');
          setStage('error');
          return null;
        }
      }
      
      const balance = Number(sourceAccount.amount) / 1e6; // POLY has 6 decimals
      
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
