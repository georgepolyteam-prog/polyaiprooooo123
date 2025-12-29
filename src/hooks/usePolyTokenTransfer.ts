import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
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
      
      console.log('[POLY transfer] ===== Starting Balance Check =====');
      console.log('[POLY transfer] Token mint:', tokenMint);
      console.log('[POLY transfer] Wallet:', publicKey.toBase58());
      console.log('[POLY transfer] Destination:', destinationAddress);

      // Try to find token account - Token-2022 first (PumpFun tokens), then standard SPL
      let sourceAta: PublicKey | null = null;
      let tokenProgramId = TOKEN_2022_PROGRAM_ID;
      let accountInfo: any = null;
      let tokenDecimals = 6; // Default, will be updated from on-chain data

      // Try Token-2022 first (PumpFun tokens like POLY use this)
      try {
        sourceAta = getAssociatedTokenAddressSync(
          mintPubkey,
          publicKey,
          false,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        console.log('[POLY transfer] Token-2022 ATA:', sourceAta.toBase58());
        
        accountInfo = await connection.getAccountInfo(sourceAta, 'confirmed');
        
        if (accountInfo) {
          console.log('[POLY transfer] ✓ Found Token-2022 account, size:', accountInfo.data.length);
          tokenProgramId = TOKEN_2022_PROGRAM_ID;
        } else {
          console.log('[POLY transfer] Token-2022 account not found, trying standard SPL...');
        }
      } catch (err: any) {
        console.warn('[POLY transfer] Token-2022 ATA lookup error:', err.message);
        // Check if it's an RPC error vs just "account not found"
        if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('fetch')) {
          setError('Unable to connect to Solana network. Please try again.');
          setStage('error');
          return null;
        }
      }

      // If Token-2022 didn't work, try standard SPL token program
      if (!accountInfo) {
        try {
          sourceAta = getAssociatedTokenAddressSync(
            mintPubkey,
            publicKey,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
          console.log('[POLY transfer] Standard SPL ATA:', sourceAta.toBase58());
          
          accountInfo = await connection.getAccountInfo(sourceAta, 'confirmed');
          
          if (accountInfo) {
            console.log('[POLY transfer] ✓ Found standard SPL account, size:', accountInfo.data.length);
            tokenProgramId = TOKEN_PROGRAM_ID;
          } else {
            console.log('[POLY transfer] Standard SPL account also not found');
          }
        } catch (err: any) {
          console.warn('[POLY transfer] Standard SPL ATA lookup error:', err.message);
          if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('fetch')) {
            setError('Unable to connect to Solana network. Please try again.');
            setStage('error');
            return null;
          }
        }
      }

      // If still no account found, the user doesn't have this token
      if (!accountInfo || !sourceAta) {
        console.error('[POLY transfer] ✗ No token account found in either program');
        setError('No POLY tokens found in your wallet. Make sure you have POLY tokens before depositing.');
        setStage('error');
        return null;
      }

      // Parse the account to get balance
      let sourceAccount: any;
      try {
        sourceAccount = await getAccount(connection, sourceAta, 'confirmed', tokenProgramId);
        console.log('[POLY transfer] Token program:', tokenProgramId.toBase58());
        console.log('[POLY transfer] Raw amount:', sourceAccount.amount.toString());
      } catch (err: any) {
        console.error('[POLY transfer] Failed to parse token account:', err);
        if (err.message?.includes('401') || err.message?.includes('403')) {
          setError('Unable to connect to Solana network. Please try again.');
        } else {
          setError('Found token account but could not read balance. Please try again.');
        }
        setStage('error');
        return null;
      }

      // Try to get token decimals from mint account
      try {
        const mintInfo = await connection.getParsedAccountInfo(mintPubkey, 'confirmed');
        if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
          tokenDecimals = mintInfo.value.data.parsed?.info?.decimals ?? 6;
          console.log('[POLY transfer] Token decimals from chain:', tokenDecimals);
        }
      } catch (err) {
        console.warn('[POLY transfer] Could not fetch decimals, using default 6:', err);
      }

      const divisor = Math.pow(10, tokenDecimals);
      const balance = Number(sourceAccount.amount) / divisor;
      console.log('[POLY transfer] Balance:', balance, 'POLY (decimals:', tokenDecimals, ')');

      if (balance < amount) {
        setError(`Insufficient balance. You have ${balance.toFixed(2)} POLY but need ${amount} POLY.`);
        setStage('error');
        return null;
      }
      
      // Get or create destination token account
      const destinationAta = getAssociatedTokenAddressSync(
        mintPubkey,
        destinationPubkey,
        true, // allowOwnerOffCurve for PDAs
        tokenProgramId,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      console.log('[POLY transfer] Destination ATA:', destinationAta.toBase58());
      
      // Stage 3: Awaiting signature
      setStage('awaiting-signature');
      
      // Create transaction
      const transaction = new Transaction();
      
      // Check if destination ATA exists, if not, add creation instruction
      try {
        const destAccountInfo = await connection.getAccountInfo(destinationAta, 'confirmed');
        if (!destAccountInfo) {
          console.log('[POLY transfer] Destination ATA does not exist, adding creation instruction');
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey, // payer
              destinationAta, // associatedToken
              destinationPubkey, // owner
              mintPubkey, // mint
              tokenProgramId,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        } else {
          console.log('[POLY transfer] Destination ATA already exists');
        }
      } catch (err) {
        console.warn('[POLY transfer] Could not check destination ATA, proceeding without creation:', err);
      }
      
      // Create transfer instruction using correct decimals
      const transferAmount = BigInt(Math.floor(amount * divisor));
      console.log('[POLY transfer] Transfer amount (smallest unit):', transferAmount.toString());
      
      const transferInstruction = createTransferInstruction(
        sourceAta,
        destinationAta,
        publicKey,
        transferAmount,
        [],
        tokenProgramId
      );
      transaction.add(transferInstruction);
      
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      console.log('[POLY transfer] Sending transaction for signature...');
      
      // Send transaction (this will prompt wallet signature)
      const txSignature = await sendTransaction(transaction, connection);
      setSignature(txSignature);
      console.log('[POLY transfer] Transaction sent:', txSignature);
      
      // Stage 4: Confirming
      setStage('confirming');
      
      // Wait for confirmation
      await connection.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      console.log('[POLY transfer] ✓ Transaction confirmed!');
      
      // Stage 5: Verifying credits (handled by caller)
      setStage('verifying-credits');
      
      return txSignature;
      
    } catch (err: any) {
      console.error('[POLY transfer] Transfer error:', err);
      
      // Handle specific error cases
      if (err.message?.includes('User rejected') || err.name === 'WalletSignTransactionError') {
        setError('Transaction cancelled. You can try again when ready.');
      } else if (err.message?.includes('insufficient') || err.message?.includes('Insufficient')) {
        setError('Insufficient SOL for transaction fees. You need a small amount of SOL to pay for the transaction.');
      } else if (err.message?.includes('401') || err.message?.includes('403')) {
        setError('Unable to connect to Solana network. Please try again in a moment.');
      } else if (err.message?.includes('blockhash')) {
        setError('Transaction expired. Please try again.');
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
