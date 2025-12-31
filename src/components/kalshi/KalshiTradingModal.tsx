import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
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
  const [trades, setTrades] = useState<any[]>([]);

  const price = side === 'YES' ? market.yesPrice : market.noPrice;
  const estimatedShares = amount ? (parseFloat(amount) / price * 100).toFixed(2) : '0.00';

  // Get the token mint for the selected side
  const getOutputMint = (): string | null => {
    const accountKeys = Object.keys(market.accounts || {});
    if (accountKeys.length === 0) return null;
    
    const account = market.accounts[accountKeys[0]];
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
      
      console.log('Order received:', orderResponse);
      
      // Deserialize the transaction
      const txBuffer = Buffer.from(orderResponse.transaction, 'base64');
      const transaction = Transaction.from(txBuffer);
      
      // Sign the transaction
      const signedTx = await signTransaction(transaction);
      
      // Send the transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      toast.loading('Confirming transaction...', { id: 'trade' });
      
      // Confirm the transaction
      await connection.confirmTransaction(signature, 'confirmed');
      
      toast.success(`Trade confirmed! You bought ~${estimatedShares} ${side} shares`, { id: 'trade' });
      onClose();
    } catch (error) {
      console.error('Trade failed:', error);
      toast.error('Trade failed. Please try again.', { id: 'trade' });
    } finally {
      setExecuting(false);
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
