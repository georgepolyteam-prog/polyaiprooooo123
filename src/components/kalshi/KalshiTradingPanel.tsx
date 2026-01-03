import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Wallet, Loader2, ArrowRight } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { cn } from '@/lib/utils';
import { useDflowApi, type KalshiMarket } from '@/hooks/useDflowApi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface KalshiTradingPanelProps {
  market: KalshiMarket;
  onOrderSubmitted?: (order: any) => void;
  compact?: boolean;
}

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const QUICK_AMOUNTS = [5, 10, 25, 50, 100];

export function KalshiTradingPanel({ 
  market, 
  onOrderSubmitted,
  compact = false,
}: KalshiTradingPanelProps) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const { getOrder } = useDflowApi();
  
  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [amount, setAmount] = useState('');
  const [executing, setExecuting] = useState(false);

  const price = side === 'YES' ? market.yesPrice : market.noPrice;
  const estimatedShares = amount ? (parseFloat(amount) / price * 100).toFixed(2) : '0.00';

  // Get the token mint for the selected side
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
      toast.error('Market token not available');
      return;
    }
    
    setExecuting(true);
    const toastId = toast.loading('Preparing trade...');
    
    try {
      const amountInLamports = Math.floor(parseFloat(amount) * 1_000_000);
      
      const orderResponse = await getOrder(
        USDC_MINT,
        outputMint,
        amountInLamports,
        publicKey.toBase58()
      );
      
      toast.loading('Sign in your wallet...', { id: toastId });
      
      const txBuffer = Buffer.from(orderResponse.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(new Uint8Array(txBuffer));
      const signedTx = await signTransaction(transaction);
      
      toast.loading('Submitting transaction...', { id: toastId });
      
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
      
      console.log('✅ Transaction submitted:', signature);
      
      if (onOrderSubmitted) {
        onOrderSubmitted({
          signature,
          ticker: market.ticker,
          side,
          amountUSDC: parseFloat(amount),
          estimatedShares,
          timestamp: Date.now(),
        });
      }
      
      toast.success(`Bought ~${estimatedShares} ${side} shares!`, { id: toastId });
      setAmount('');
      
    } catch (error: any) {
      console.error('Trade failed:', error);
      
      if (error?.message?.includes('User rejected')) {
        toast.error('Trade cancelled', { id: toastId });
      } else if (error?.message?.includes('route_not_found')) {
        toast.error('No liquidity available', { id: toastId });
      } else {
        toast.error('Trade failed', { id: toastId });
      }
    } finally {
      setExecuting(false);
    }
  };

  if (compact) {
    return (
      <div className="p-3 rounded-xl bg-card/50 border border-border/50">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSide('YES')}
            className={cn(
              'flex-1 py-2 rounded-lg font-medium text-sm transition-all',
              side === 'YES'
                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
            )}
          >
            <TrendingUp className="w-3.5 h-3.5 inline mr-1" />
            YES {market.yesPrice}¢
          </button>
          <button
            onClick={() => setSide('NO')}
            className={cn(
              'flex-1 py-2 rounded-lg font-medium text-sm transition-all',
              side === 'NO'
                ? 'bg-red-500/20 text-red-500 border border-red-500/40'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
            )}
          >
            <TrendingDown className="w-3.5 h-3.5 inline mr-1" />
            NO {market.noPrice}¢
          </button>
        </div>
        
        {connected ? (
          <>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount in USDC"
              className="mb-2 h-9 text-sm"
            />
            <Button
              onClick={executeTrade}
              disabled={!amount || executing}
              className={cn(
                'w-full h-9',
                side === 'YES' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'
              )}
            >
              {executing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Buy {side}</>
              )}
            </Button>
          </>
        ) : (
          <WalletMultiButton className="!w-full !h-9 !text-sm !rounded-lg" />
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-card/50 border border-border/50 overflow-hidden"
    >
      {/* Side selector */}
      <div className="grid grid-cols-2 p-1 m-3 rounded-lg bg-muted/40">
        <button
          onClick={() => setSide('YES')}
          className={cn(
            'py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2',
            side === 'YES'
              ? 'bg-emerald-500 text-white shadow-lg'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <TrendingUp className="w-4 h-4" />
          YES
          <span className="font-mono">{market.yesPrice}¢</span>
        </button>
        <button
          onClick={() => setSide('NO')}
          className={cn(
            'py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2',
            side === 'NO'
              ? 'bg-red-500 text-white shadow-lg'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <TrendingDown className="w-4 h-4" />
          NO
          <span className="font-mono">{market.noPrice}¢</span>
        </button>
      </div>

      {/* Trade form */}
      <div className="p-3 pt-0">
        {connected ? (
          <>
            {/* Quick amounts */}
            <div className="flex gap-1.5 mb-3">
              {QUICK_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-medium rounded-lg transition-all',
                    amount === amt.toString()
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  )}
                >
                  ${amt}
                </button>
              ))}
            </div>

            {/* Amount input */}
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="pl-7 h-12 text-lg font-mono bg-muted/30 border-border/30"
              />
            </div>

            {/* Estimate */}
            {amount && (
              <div className="flex items-center justify-between p-3 mb-3 rounded-lg bg-muted/30 border border-border/30">
                <span className="text-sm text-muted-foreground">You'll receive</span>
                <span className="font-semibold font-mono text-foreground">
                  ~{estimatedShares} <span className={side === 'YES' ? 'text-emerald-500' : 'text-red-500'}>{side}</span> shares
                </span>
              </div>
            )}

            {/* Execute button */}
            <Button
              onClick={executeTrade}
              disabled={!amount || parseFloat(amount) <= 0 || executing}
              className={cn(
                'w-full h-12 text-base font-semibold transition-all',
                side === 'YES' 
                  ? 'bg-emerald-500 hover:bg-emerald-600' 
                  : 'bg-red-500 hover:bg-red-600'
              )}
            >
              {executing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  Buy {side}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <Wallet className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">Connect wallet to trade</p>
            <WalletMultiButton className="!mx-auto !rounded-xl" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
