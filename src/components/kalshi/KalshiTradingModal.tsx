import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Loader2, Wallet, Sparkles, Share2 } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { cn } from '@/lib/utils';
import { useDflowApi, type KalshiMarket } from '@/hooks/useDflowApi';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KalshiPriceChart } from './KalshiPriceChart';
import { KalshiShareButton } from './KalshiShareButton';

interface KalshiTradingModalProps {
  market: KalshiMarket;
  onClose: () => void;
}

// USDC mint on Solana mainnet
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export function KalshiTradingModal({ market, onClose }: KalshiTradingModalProps) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const { getOrder, getOrderStatus, getTrades, loading } = useDflowApi();
  
  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [amount, setAmount] = useState('');
  const [executing, setExecuting] = useState(false);
  const [orderStatus, setOrderStatus] = useState('');
  const [trades, setTrades] = useState<any[]>([]);

  const price = side === 'YES' ? market.yesPrice : market.noPrice;
  const estimatedShares = amount ? (parseFloat(amount) / price * 100).toFixed(2) : '0.00';

  // Get the token mint for the selected side
  // Prefer the USDC-settled account entry when available (prevents route-plan mismatches).
  const getOutputMint = (): string | null => {
    const accounts = market.accounts || {};
    const settlementKey = accounts[USDC_MINT] ? USDC_MINT : Object.keys(accounts)[0];
    if (!settlementKey) return null;

    const account = accounts[settlementKey];
    return side === 'YES' ? account?.yesMint : account?.noMint;
  };

  const executeTrade = async () => {
    if (!publicKey || !signTransaction || !amount) return;
    
    const outputMint = getOutputMint();
    if (!outputMint) {
      toast.error('Market token not available for trading');
      return;
    }
    
    setExecuting(true);
    setOrderStatus('Getting quote from DFlow...');
    
    try {
      // Convert amount to lamports (USDC has 6 decimals)
      const amountInLamports = Math.floor(parseFloat(amount) * 1_000_000);
      
      // Get order from DFlow
      const orderResponse = await getOrder(
        USDC_MINT,
        outputMint,
        amountInLamports,
        publicKey.toBase58()
      );
      
      // Log transaction details for debugging
      console.log('🔍 DFlow Order Details');
      console.log('Execution Mode:', orderResponse.executionMode);
      console.log('Input:', { mint: USDC_MINT, amount: amountInLamports });
      console.log('Output:', { mint: outputMint, amount: orderResponse.outAmount });
      console.log('View on Solscan after submit');
      
      setOrderStatus('Sign the transaction in your wallet...');
      
      // Deserialize as VersionedTransaction (DFlow returns versioned transactions)
      const txBuffer = Buffer.from(orderResponse.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(new Uint8Array(txBuffer));
      
      // Sign the transaction
      const signedTx = await signTransaction(transaction);
      
      setOrderStatus('Submitting to Solana...');
      
      // CRITICAL: Send with proper options for DFlow async execution
      const txSignature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 2,
      });
      
      console.log('✅ Transaction submitted:', txSignature);
      console.log('View on Solscan:', `https://solscan.io/tx/${txSignature}`);
      
      // Handle based on execution mode
      if (orderResponse.executionMode === 'async') {
        setOrderStatus('Processing... This may take 10-30 seconds');
        toast.loading('Order submitted! Processing...', { id: 'trade' });
        
        // For async orders, poll DFlow's order-status endpoint
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max
        
        const pollForStatus = async () => {
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
            
            try {
              const status = await getOrderStatus(txSignature);
              
              if (status?.status === 'confirmed' || status?.status === 'finalized') {
                toast.success(`Trade confirmed! You bought ~${estimatedShares} ${side} shares`, { id: 'trade' });
                onClose();
                return true;
              } else if (status?.status === 'failed') {
                throw new Error(status.error || 'Transaction failed on-chain');
              }
              
              setOrderStatus(`Processing... ${attempts}s elapsed`);
            } catch (err: any) {
              // If it's a real error (not just "not found"), throw it
              if (err?.message?.includes('failed')) throw err;
              // Otherwise keep polling
              console.log(`Polling attempt ${attempts}...`);
            }
          }
          
          // Timeout - check if it confirmed anyway
          toast.info('Order submitted. Check your wallet for confirmation.', { id: 'trade' });
          onClose();
          return false;
        };
        
        await pollForStatus();
        
      } else {
        // Sync execution - wait for confirmation directly
        setOrderStatus('Confirming transaction...');
        toast.loading('Confirming transaction...', { id: 'trade' });
        
        await connection.confirmTransaction(txSignature, 'confirmed');
        toast.success(`Trade confirmed! You bought ~${estimatedShares} ${side} shares`, { id: 'trade' });
        onClose();
      }
      
    } catch (error: any) {
      console.error('❌ Trade failed:', error);
      
      let errorMessage = 'Trade failed';
      const errorMsg = error?.message || error?.toString() || '';
      
      // Parse error messages for user-friendly feedback
      if (errorMsg.includes('SkippedLeg')) {
        errorMessage = 'Routing failed. The market may have low liquidity. Try a smaller amount.';
      } else if (errorMsg.includes('insufficient') || errorMsg.includes('InsufficientFunds')) {
        errorMessage = 'Insufficient USDC balance. Add USDC to your Solana wallet.';
      } else if (errorMsg.includes('User rejected') || errorMsg.includes('rejected')) {
        errorMessage = 'Transaction cancelled by user.';
      } else if (errorMsg.includes('Slippage') || errorMsg.includes('slippage')) {
        errorMessage = 'Price moved too much. Try again with higher slippage.';
      } else if (error.logs) {
        // Extract meaningful error from logs
        const logs = error.logs.join('\n');
        console.log('Transaction logs:', logs);
        if (logs.includes('permanent delegate')) {
          errorMessage = 'Token account initialization required. This is a one-time setup.';
        }
      } else if (errorMsg.length > 0 && errorMsg.length < 100) {
        errorMessage = `Trade failed: ${errorMsg}`;
      }
      
      toast.error(errorMessage, { id: 'trade' });
    } finally {
      setExecuting(false);
      setOrderStatus('');
    }
  };

  const displayTitle = market.title || market.ticker;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-background/95 backdrop-blur-2xl border-border/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">Trade Market</DialogTitle>
            <KalshiShareButton market={market} />
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Overlay */}
          {executing && orderStatus && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 rounded-2xl bg-primary/10 border border-primary/30 flex items-center gap-3"
            >
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm font-medium text-foreground">{orderStatus}</span>
            </motion.div>
          )}

          {/* Market Title */}
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
            <p className="text-foreground font-medium leading-relaxed">
              {displayTitle}
            </p>
            {market.subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{market.subtitle}</p>
            )}
          </div>

          {/* Price Chart */}
          <KalshiPriceChart 
            trades={trades} 
            yesPrice={market.yesPrice} 
            noPrice={market.noPrice} 
          />

          {/* Wallet Connection */}
          {!connected && (
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-3 mb-3">
                <Wallet className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-foreground">Connect your Solana wallet to trade</span>
              </div>
              <WalletMultiButton className="!w-full !h-12 !rounded-xl !bg-primary !text-primary-foreground hover:!bg-primary/90 !font-medium !justify-center" />
            </div>
          )}

          {/* Side Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSide('YES')}
              disabled={!connected}
              className={cn(
                'p-4 rounded-2xl border-2 transition-all',
                side === 'YES'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_hsl(142,76%,36%,0.2)]'
                  : 'border-border/50 bg-muted/30 hover:bg-muted/50',
                !connected && 'opacity-50 cursor-not-allowed'
              )}
            >
              <TrendingUp className={cn(
                'w-6 h-6 mb-2 mx-auto',
                side === 'YES' ? 'text-emerald-400' : 'text-muted-foreground'
              )} />
              <p className={cn(
                'text-sm font-semibold uppercase tracking-wide',
                side === 'YES' ? 'text-emerald-400' : 'text-muted-foreground'
              )}>
                Yes
              </p>
              <p className={cn(
                'text-2xl font-bold mt-1',
                side === 'YES' ? 'text-emerald-400' : 'text-foreground'
              )}>
                {market.yesPrice}¢
              </p>
            </button>

            <button
              onClick={() => setSide('NO')}
              disabled={!connected}
              className={cn(
                'p-4 rounded-2xl border-2 transition-all',
                side === 'NO'
                  ? 'border-red-500 bg-red-500/10 shadow-[0_0_20px_hsl(0,84%,60%,0.2)]'
                  : 'border-border/50 bg-muted/30 hover:bg-muted/50',
                !connected && 'opacity-50 cursor-not-allowed'
              )}
            >
              <TrendingDown className={cn(
                'w-6 h-6 mb-2 mx-auto',
                side === 'NO' ? 'text-red-400' : 'text-muted-foreground'
              )} />
              <p className={cn(
                'text-sm font-semibold uppercase tracking-wide',
                side === 'NO' ? 'text-red-400' : 'text-muted-foreground'
              )}>
                No
              </p>
              <p className={cn(
                'text-2xl font-bold mt-1',
                side === 'NO' ? 'text-red-400' : 'text-foreground'
              )}>
                {market.noPrice}¢
              </p>
            </button>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Amount (USDC)
            </label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={!connected}
              className="h-12 text-lg bg-muted/30 border-border/50 rounded-xl"
            />
          </div>

          {/* Trade Summary */}
          <AnimatePresence>
            {amount && parseFloat(amount) > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/30 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">You pay</span>
                    <span className="font-medium text-foreground">${amount} USDC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Est. shares</span>
                    <span className={cn(
                      'font-medium',
                      side === 'YES' ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      ~{estimatedShares} {side}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Max payout</span>
                    <span className="font-medium text-foreground">
                      ${(parseFloat(estimatedShares) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trade Button */}
          <Button
            onClick={executeTrade}
            disabled={!connected || !amount || parseFloat(amount) <= 0 || executing}
            className={cn(
              'w-full h-14 text-lg font-semibold rounded-2xl',
              'transition-all duration-300',
              side === 'YES' 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'shadow-lg hover:shadow-xl'
            )}
          >
            {executing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Buy {side}
              </>
            )}
          </Button>

          {/* Disclaimer */}
          <p className="text-xs text-center text-muted-foreground">
            Trading involves risk. Only trade what you can afford to lose.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
