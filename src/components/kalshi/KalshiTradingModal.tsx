import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction, Connection } from '@solana/web3.js';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Loader2, Wallet, Sparkles, ExternalLink, AlertTriangle } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { cn } from '@/lib/utils';
import { useDflowApi, type KalshiMarket } from '@/hooks/useDflowApi';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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

// Supabase edge function URL
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Quick confirmation for the open transaction using proxied RPC (3 attempts max, non-blocking)
async function confirmOpenTransaction(
  signature: string,
  connection: Connection,
  maxAttempts = 3,
  intervalMs = 1500
): Promise<{ confirmed: boolean; error?: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { value: statuses } = await connection.getSignatureStatuses([signature]);
      
      if (statuses && statuses[0]) {
        const status = statuses[0];
        
        if (status.err) {
          return { confirmed: false, error: JSON.stringify(status.err) };
        }
        if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
          console.log(`✅ Open transaction confirmed (attempt ${attempt + 1})`);
          return { confirmed: true };
        }
      }
    } catch (err: any) {
      // On rate limit, stop trying - don't spam the RPC
      if (err?.message?.includes('429') || err?.message?.includes('rate limit')) {
        console.log('⚠️ RPC rate limited, skipping confirmation check');
        return { confirmed: false, error: undefined };
      }
      console.log(`Confirmation attempt ${attempt + 1} failed:`, err);
    }
    
    // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, intervalMs * (attempt + 1)));
  }
  
  // For async orders, don't fail - the tx might still be pending
  console.log('⏳ Open transaction still pending after quick check');
  return { confirmed: false, error: undefined };
}

// For async orders: use DFlow's /order-status endpoint to check fills
// Now handles graceful "not_found_yet" responses from backend (no 404 errors)
async function checkAsyncOrderStatus(
  signature: string,
  maxAttempts = 20,
  pollInterval = 2500
): Promise<{ filled: boolean; status?: string; fills?: any[]; error?: string }> {
  let notFoundCount = 0;
  const maxNotFound = 8; // Stop after 8 consecutive not_found_yet (20 seconds)
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/dflow-api`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'getOrderStatus',
            params: { signature },
          }),
        }
      );

      const data = await response.json();
      const status = data.status || 'unknown';
      
      console.log(`📊 Order status (attempt ${attempt}):`, status);

      if (status === 'closed' || status === 'filled') {
        console.log('✅ Order filled successfully!');
        console.log('Fills:', data.fills);
        return { filled: true, status: status, fills: data.fills };
      }

      if (status === 'failed' || status === 'expired') {
        return { filled: false, status: status, error: `Order ${status}` };
      }

      // Handle "not_found_yet" gracefully (backend now returns 200 with this status)
      if (status === 'not_found_yet') {
        notFoundCount++;
        if (notFoundCount >= maxNotFound) {
          console.log('⏳ Order not indexed after multiple attempts, may still be processing');
          return { filled: false, status: 'pending', error: undefined };
        }
      } else {
        notFoundCount = 0; // Reset if we got a different status
      }

      // Status is 'pending', 'open', 'not_found_yet' - continue polling
    } catch (error) {
      console.log(`Order status check attempt ${attempt} failed:`, error);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  // Timeout - but order might still fill
  return { filled: false, status: 'pending', error: undefined };
}

export function KalshiTradingModal({ market, onClose }: KalshiTradingModalProps) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const { getOrder, getTrades, loading } = useDflowApi();
  
  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [amount, setAmount] = useState('');
  const [executing, setExecuting] = useState(false);
  const [orderStatus, setOrderStatus] = useState('');
  const [trades, setTrades] = useState<any[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [liquidityError, setLiquidityError] = useState<string | null>(null);

  const price = side === 'YES' ? market.yesPrice : market.noPrice;
  const estimatedShares = amount ? (parseFloat(amount) / price * 100).toFixed(2) : '0.00';

  // Check if market has valid token mints for trading
  const hasValidAccounts = (): boolean => {
    const accounts = market.accounts || {};
    const settlementKey = accounts[USDC_MINT] ? USDC_MINT : Object.keys(accounts)[0];
    if (!settlementKey) return false;
    const account = accounts[settlementKey];
    return !!(account?.yesMint && account?.noMint);
  };

  // Load trades for price chart (non-blocking)
  useEffect(() => {
    let mounted = true;
    setTradesLoading(true);
    
    const fetchTrades = async () => {
      try {
        const data = await getTrades(market.ticker, 50);
        if (mounted && data?.trades) {
          setTrades(data.trades);
        }
      } catch (err) {
        // Don't block UI - trades are optional for chart
        console.log('Trades fetch failed (non-critical):', err);
      } finally {
        if (mounted) setTradesLoading(false);
      }
    };
    
    // Fire and forget - don't await
    fetchTrades();
    
    // Check for liquidity issues
    if (!hasValidAccounts()) {
      setLiquidityError('This market may have limited liquidity');
    }
    
    return () => { mounted = false; };
  }, [market.ticker, getTrades]);

  // Get the token mint for the selected side
  // Prefer the USDC-settled account entry when available
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
    setTxSignature(null);
    setSimulationError(null);
    setLiquidityError(null);
    
    try {
      // Convert amount to lamports (USDC has 6 decimals)
      const amountInLamports = Math.floor(parseFloat(amount) * 1_000_000);
      
      // Get order from DFlow
      let orderResponse;
      try {
        orderResponse = await getOrder(
          USDC_MINT,
          outputMint,
          amountInLamports,
          publicKey.toBase58()
        );
      } catch (orderErr: any) {
        // Handle specific DFlow API errors
        const errMsg = orderErr?.message || orderErr?.toString() || '';
        if (errMsg.includes('route_not_found') || errMsg.includes('Route not found')) {
          setLiquidityError('No liquidity available for this market. Try a smaller amount or different side.');
          throw new Error('Route not found - market has insufficient liquidity');
        }
        if (errMsg.includes('not_found') || errMsg.includes('Not found')) {
          throw new Error('Market data unavailable. Please try again.');
        }
        throw orderErr;
      }
      
      // Log transaction details for debugging
      console.log('🔍 DFlow Order Details');
      console.log('Execution Mode:', orderResponse.executionMode);
      console.log('Input:', { mint: USDC_MINT, amount: amountInLamports });
      console.log('Output:', { mint: outputMint, amount: orderResponse.outAmount });
      
      // Deserialize as VersionedTransaction
      const txBuffer = Buffer.from(orderResponse.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(new Uint8Array(txBuffer));
      
      // Pre-flight simulation to catch errors early
      setOrderStatus('Simulating transaction...');
      try {
        const simulation = await connection.simulateTransaction(transaction, {
          commitment: 'confirmed',
        });
        
        if (simulation.value.err) {
          const errStr = JSON.stringify(simulation.value.err);
          console.error('Simulation failed:', errStr, simulation.value.logs);
          
          // Parse specific errors
          if (errStr.includes('15020') || errStr.includes('SkippedLeg')) {
            setSimulationError('Low liquidity - try a smaller amount');
            throw new Error('Routing failed due to low liquidity. Try a smaller amount or different side.');
          } else if (errStr.includes('InsufficientFunds') || errStr.includes('0x1')) {
            setSimulationError('Insufficient USDC balance');
            throw new Error('Insufficient USDC balance. Add more USDC to your wallet.');
          }
          
          throw new Error(`Simulation failed: ${errStr}`);
        }
        console.log('✅ Simulation passed');
      } catch (simErr: any) {
        // Only throw if it's a real error, not just unsupported simulation
        if (simErr.message?.includes('failed') || simErr.message?.includes('Insufficient')) {
          throw simErr;
        }
        console.log('Simulation skipped (may not be supported), proceeding...');
      }
      
      setOrderStatus('Sign the transaction in your wallet...');
      
      // Sign the transaction
      const signedTx = await signTransaction(transaction);
      
      setOrderStatus('Submitting to Solana...');
      
      // Send with proper options
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
      
      setTxSignature(signature);
      console.log('✅ Transaction submitted:', signature);
      console.log('View on Solscan:', `https://solscan.io/tx/${signature}`);
      
      // Confirm open transaction using proxied RPC (3 attempts, non-blocking)
      setOrderStatus('Confirming transaction...');
      toast.loading('Transaction submitted! Confirming...', { id: 'trade' });
      
      const openConfirmation = await confirmOpenTransaction(signature, connection, 3, 1500);
      
      if (openConfirmation.error) {
        // Hard failure during open tx
        console.error('Open transaction failed:', openConfirmation.error);
        if (openConfirmation.error.includes('15020') || openConfirmation.error.includes('SkippedLeg')) {
          throw new Error('Trade failed: Route no longer valid. Market conditions changed.');
        }
        throw new Error(`Transaction failed: ${openConfirmation.error}`);
      }
      
      // For async orders (prediction markets), use DFlow's order-status endpoint
      const isAsyncOrder = orderResponse.executionMode === 'async';
      
      if (isAsyncOrder) {
        setOrderStatus('Waiting for fill (this may take a moment)...');
        console.log('📊 Async order detected, polling DFlow order-status...');
        
        const orderResult = await checkAsyncOrderStatus(signature, 20, 2500);
        
        if (orderResult.filled) {
          toast.success(`Trade filled! You bought ~${estimatedShares} ${side} shares`, { id: 'trade' });
          onClose();
        } else if (orderResult.status === 'pending' || !orderResult.error) {
          // Pending but no error - order likely processing, don't show as error
          toast.success('Order submitted! Check your portfolio in a moment.', { id: 'trade' });
          setOrderStatus('Order processing - refresh portfolio shortly');
          // Auto-close after showing success
          setTimeout(() => onClose(), 2000);
        } else {
          // Actual error
          toast.error(orderResult.error || 'Trade failed', { id: 'trade' });
        }
      } else {
        // Sync order - open tx confirmation is enough
        if (openConfirmation.confirmed) {
          toast.success(`Trade confirmed! You bought ~${estimatedShares} ${side} shares`, { id: 'trade' });
          onClose();
        } else {
          // Pending but no error - likely still processing
          toast.success('Transaction submitted! Check your portfolio shortly.', { id: 'trade' });
          setOrderStatus('Transaction sent - refresh portfolio shortly');
          setTimeout(() => onClose(), 2000);
        }
      }
      
    } catch (error: any) {
      console.error('❌ Trade failed:', error);
      
      let errorMessage = 'Trade failed';
      const errorMsg = error?.message || error?.toString() || '';
      
      // Parse error messages for user-friendly feedback
      if (errorMsg.includes('SkippedLeg') || errorMsg.includes('15020')) {
        errorMessage = 'Routing failed. The market may have low liquidity. Try a smaller amount.';
      } else if (errorMsg.includes('insufficient') || errorMsg.includes('InsufficientFunds') || errorMsg.includes('0x1')) {
        errorMessage = 'Insufficient USDC balance. Add USDC to your Solana wallet.';
      } else if (errorMsg.includes('User rejected') || errorMsg.includes('rejected')) {
        errorMessage = 'Transaction cancelled by user.';
      } else if (errorMsg.includes('Slippage') || errorMsg.includes('slippage')) {
        errorMessage = 'Price moved too much. Try again with higher slippage.';
      } else if (errorMsg.includes('Simulation failed')) {
        errorMessage = errorMsg;
      } else if (error.logs) {
        console.log('Transaction logs:', error.logs.join('\n'));
      } else if (errorMsg.length > 0 && errorMsg.length < 120) {
        errorMessage = `Trade failed: ${errorMsg}`;
      }
      
      toast.error(errorMessage, { id: 'trade' });
    } finally {
      setExecuting(false);
      if (!txSignature) setOrderStatus('');
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
          <DialogDescription className="sr-only">
            Trade YES or NO shares on this prediction market
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Overlay */}
          {(executing || txSignature) && orderStatus && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 rounded-2xl bg-primary/10 border border-primary/30 space-y-2"
            >
              <div className="flex items-center gap-3">
                {executing ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <Sparkles className="w-5 h-5 text-primary" />
                )}
                <span className="text-sm font-medium text-foreground">{orderStatus}</span>
              </div>
              
              {txSignature && (
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on Solscan
                </a>
              )}
            </motion.div>
          )}

          {/* Simulation/Liquidity Error Warning */}
          {(simulationError || liquidityError) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-amber-400">{simulationError || liquidityError}</span>
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
            loading={tradesLoading}
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