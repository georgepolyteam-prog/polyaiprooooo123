import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction, Connection } from '@solana/web3.js';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Loader2, Wallet, Sparkles, ExternalLink, AlertTriangle, CheckCircle, DollarSign, Zap, ArrowRight } from 'lucide-react';
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
import { Slider } from '@/components/ui/slider';

interface RecentOrder {
  signature: string;
  ticker: string;
  side: 'YES' | 'NO';
  amountUSDC: number;
  estimatedShares: string;
  timestamp: number;
  status?: 'pending' | 'open' | 'closed' | 'failed' | 'expired' | 'unknown';
}

interface KalshiTradingModalProps {
  market: KalshiMarket;
  onClose: () => void;
  onOrderSubmitted?: (order: RecentOrder) => void;
  // For sell mode
  mode?: 'buy' | 'sell';
  initialSide?: 'YES' | 'NO';
  sellMint?: string;
  sellDecimals?: number;
  maxShares?: number;
}

// Order step types for progress UI
type OrderStep = 'idle' | 'quote' | 'simulate' | 'sign' | 'submit' | 'confirm' | 'done' | 'error';

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

// Step progress helpers
const getStepLabel = (step: OrderStep, isSell: boolean) => {
  switch (step) {
    case 'quote': return isSell ? 'Getting sell quote...' : 'Getting best price...';
    case 'simulate': return 'Simulating transaction...';
    case 'sign': return 'Waiting for wallet signature...';
    case 'submit': return 'Submitting to Solana...';
    case 'confirm': return 'Confirming on-chain...';
    case 'done': return 'Trade complete!';
    case 'error': return 'Trade failed';
    default: return '';
  }
};

const getStepProgress = (step: OrderStep) => {
  switch (step) {
    case 'quote': return 15;
    case 'simulate': return 30;
    case 'sign': return 50;
    case 'submit': return 70;
    case 'confirm': return 85;
    case 'done': return 100;
    case 'error': return 100;
    default: return 0;
  }
};

export function KalshiTradingModal({ 
  market, 
  onClose, 
  onOrderSubmitted,
  mode = 'buy',
  initialSide,
  sellMint,
  sellDecimals = 6,
  maxShares,
}: KalshiTradingModalProps) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const { getOrder, getTrades, loading } = useDflowApi();
  
  const [side, setSide] = useState<'YES' | 'NO'>(initialSide || 'YES');
  const [amount, setAmount] = useState('');
  const [executing, setExecuting] = useState(false);
  const [orderStep, setOrderStep] = useState<OrderStep>('idle');
  const [trades, setTrades] = useState<any[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [liquidityError, setLiquidityError] = useState<string | null>(null);

  const isSellMode = mode === 'sell';
  const price = side === 'YES' ? market.yesPrice : market.noPrice;
  
  // For buy: amount is USDC, estimate shares
  // For sell: amount is shares, estimate USDC out
  const estimatedShares = !isSellMode && amount 
    ? (parseFloat(amount) / price * 100).toFixed(2) 
    : '0.00';
  const estimatedUSDC = isSellMode && amount
    ? (parseFloat(amount) * price / 100).toFixed(2)
    : '0.00';

  // Check if market has valid token mints for trading
  const hasValidAccounts = (): boolean => {
    const accounts = market.accounts || {};
    const settlementKey = accounts[USDC_MINT] ? USDC_MINT : Object.keys(accounts)[0];
    if (!settlementKey) return false;
    const account = accounts[settlementKey];
    return !!(account?.yesMint && account?.noMint);
  };

  // Load trades for price chart (deferred for instant modal open)
  useEffect(() => {
    let mounted = true;
    setTradesLoading(true);
    
    // Delay trade fetch to let modal render first - makes modal feel instant
    const timer = setTimeout(async () => {
      try {
        const fetchStart = performance.now();
        const data = await getTrades(market.ticker, 50);
        console.log(`[Modal] Trades fetched in ${Math.round(performance.now() - fetchStart)}ms`);
        if (mounted && data?.trades) {
          setTrades(data.trades);
        }
      } catch (err) {
        // Don't block UI - trades are optional for chart
        console.log('Trades fetch failed (non-critical):', err);
      } finally {
        if (mounted) setTradesLoading(false);
      }
    }, 300); // 300ms delay - modal appears instantly
    
    // Check for liquidity issues
    if (!hasValidAccounts()) {
      setLiquidityError('This market may have limited liquidity');
    }
    
    return () => { 
      mounted = false; 
      clearTimeout(timer);
    };
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
    
    // For sell mode, we need the sellMint
    // For buy mode, we need the output mint from market accounts
    let inputMint: string;
    let outputMint: string;
    let amountInLamports: number;
    
    if (isSellMode) {
      if (!sellMint) {
        toast.error('Sell mint not available');
        return;
      }
      inputMint = sellMint;
      outputMint = USDC_MINT;
      // Amount is in shares, convert to lamports using decimals
      amountInLamports = Math.floor(parseFloat(amount) * Math.pow(10, sellDecimals));
    } else {
      const outputMintResult = getOutputMint();
      if (!outputMintResult) {
        toast.error('Market token not available for trading');
        return;
      }
      inputMint = USDC_MINT;
      outputMint = outputMintResult;
      // Amount is in USDC (6 decimals)
      amountInLamports = Math.floor(parseFloat(amount) * 1_000_000);
    }
    
    setExecuting(true);
    setOrderStep('quote');
    setTxSignature(null);
    setSimulationError(null);
    setLiquidityError(null);
    
    try {
      // Get order from DFlow
      let orderResponse;
      try {
        orderResponse = await getOrder(
          inputMint,
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
      console.log('Mode:', isSellMode ? 'SELL' : 'BUY');
      console.log('Execution Mode:', orderResponse.executionMode);
      console.log('Input:', { mint: inputMint, amount: amountInLamports });
      console.log('Output:', { mint: outputMint, amount: orderResponse.outAmount });
      
      // Deserialize as VersionedTransaction
      const txBuffer = Buffer.from(orderResponse.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(new Uint8Array(txBuffer));
      
      // Pre-flight simulation to catch errors early
      setOrderStep('simulate');
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
      
      setOrderStep('sign');
      
      // Sign the transaction
      const signedTx = await signTransaction(transaction);
      
      setOrderStep('submit');
      
      // Send with proper options
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
      
      setTxSignature(signature);
      console.log('✅ Transaction submitted:', signature);
      console.log('View on Solscan:', `https://solscan.io/tx/${signature}`);
      
      // Save order to recent orders
      if (onOrderSubmitted) {
        onOrderSubmitted({
          signature,
          ticker: market.ticker,
          side,
          amountUSDC: isSellMode ? parseFloat(estimatedUSDC) : parseFloat(amount),
          estimatedShares: isSellMode ? amount : estimatedShares,
          timestamp: Date.now(),
          status: 'pending',
        });
      }
      
      // Confirm open transaction using proxied RPC (3 attempts, non-blocking)
      setOrderStep('confirm');
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
        console.log('📊 Async order detected, polling DFlow order-status...');
        
        const orderResult = await checkAsyncOrderStatus(signature, 20, 2500);
        
        if (orderResult.filled) {
          setOrderStep('done');
          if (isSellMode) {
            toast.success(`Sold ${amount} ${side} shares for ~$${estimatedUSDC}`, { id: 'trade' });
          } else {
            toast.success(`Trade filled! You bought ~${estimatedShares} ${side} shares`, { id: 'trade' });
          }
          setTimeout(() => onClose(), 1500);
        } else if (orderResult.status === 'pending' || !orderResult.error) {
          // Pending but no error - order likely processing, don't show as error
          setOrderStep('done');
          toast.success('Order submitted! Check your portfolio in a moment.', { id: 'trade' });
          setTimeout(() => onClose(), 2000);
        } else {
          // Actual error
          setOrderStep('error');
          toast.error(orderResult.error || 'Trade failed', { id: 'trade' });
        }
      } else {
        // Sync order - open tx confirmation is enough
        if (openConfirmation.confirmed) {
          setOrderStep('done');
          if (isSellMode) {
            toast.success(`Sold ${amount} ${side} shares for ~$${estimatedUSDC}`, { id: 'trade' });
          } else {
            toast.success(`Trade confirmed! You bought ~${estimatedShares} ${side} shares`, { id: 'trade' });
          }
          setTimeout(() => onClose(), 1500);
        } else {
          // Pending but no error - likely still processing
          setOrderStep('done');
          toast.success('Transaction submitted! Check your portfolio shortly.', { id: 'trade' });
          setTimeout(() => onClose(), 2000);
        }
      }
      
    } catch (error: any) {
      console.error('❌ Trade failed:', error);
      setOrderStep('error');
      
      let errorMessage = 'Trade failed';
      const errorMsg = error?.message || error?.toString() || '';
      
      // Parse error messages for user-friendly feedback
      if (errorMsg.includes('SkippedLeg') || errorMsg.includes('15020') || errorMsg.includes('0x3aac')) {
        errorMessage = 'Not enough liquidity for this trade size. Try a smaller amount or the opposite side.';
        setLiquidityError('Low liquidity detected');
      } else if (errorMsg.includes('insufficient') || errorMsg.includes('InsufficientFunds') || errorMsg.includes('0x1')) {
        errorMessage = 'Insufficient USDC balance. Add USDC to your Solana wallet.';
      } else if (errorMsg.includes('User rejected') || errorMsg.includes('rejected')) {
        errorMessage = 'Transaction cancelled by user.';
      } else if (errorMsg.includes('Slippage') || errorMsg.includes('slippage')) {
        errorMessage = 'Price moved too much. Try again with higher slippage.';
      } else if (errorMsg.includes('Simulation failed')) {
        errorMessage = errorMsg;
      } else if (errorMsg.includes('route_not_found') || errorMsg.includes('Route not found')) {
        errorMessage = 'No liquidity route available. Try a smaller amount.';
        setLiquidityError('No liquidity available');
      } else if (error.logs) {
        console.log('Transaction logs:', error.logs.join('\n'));
      } else if (errorMsg.length > 0 && errorMsg.length < 120) {
        errorMessage = `Trade failed: ${errorMsg}`;
      }
      
      toast.error(errorMessage, { id: 'trade' });
    } finally {
      setExecuting(false);
    }
  };

  const displayTitle = market.title || market.ticker;
  const modalTitle = isSellMode ? 'Sell Position' : 'Trade';
  
  // Quick amount buttons
  const quickAmounts = isSellMode ? [] : [5, 10, 25, 50, 100];
  
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-background border border-border p-0 max-h-[90vh] overflow-y-auto"  onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Header with gradient */}
        <div className={cn(
          "p-6 pb-4 rounded-t-lg",
          side === 'YES' 
            ? "bg-gradient-to-b from-emerald-500/10 to-transparent" 
            : "bg-gradient-to-b from-red-500/10 to-transparent"
        )}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-2 rounded-xl",
                  side === 'YES' ? "bg-emerald-500/20" : "bg-red-500/20"
                )}>
                  <Zap className={cn(
                    "w-5 h-5",
                    side === 'YES' ? "text-emerald-400" : "text-red-400"
                  )} />
                </div>
                <DialogTitle className="text-xl font-bold">{modalTitle}</DialogTitle>
              </div>
              <KalshiShareButton market={market} />
            </div>
            <DialogDescription className="sr-only">
              Trade YES or NO shares on this prediction market
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Step Progress UI - Enhanced */}
          <AnimatePresence>
            {orderStep !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "p-4 rounded-2xl border space-y-3",
                  orderStep === 'error' 
                    ? "bg-red-500/10 border-red-500/30" 
                    : orderStep === 'done'
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-primary/5 border-primary/20"
                )}
              >
                <div className="flex items-center gap-3">
                  {orderStep === 'error' ? (
                    <div className="p-2 rounded-full bg-red-500/20">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                  ) : orderStep === 'done' ? (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="p-2 rounded-full bg-emerald-500/20"
                    >
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    </motion.div>
                  ) : (
                    <div className="p-2 rounded-full bg-primary/20">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {getStepLabel(orderStep, isSellMode)}
                  </span>
                </div>
                
                {/* Progress steps */}
                <div className="flex items-center gap-1">
                  {['Quote', 'Sign', 'Submit', 'Confirm'].map((step, i) => {
                    const stepProgress = getStepProgress(orderStep);
                    const stepThresholds = [15, 50, 70, 85];
                    const isActive = stepProgress >= stepThresholds[i];
                    const isCurrent = stepProgress >= stepThresholds[i] && (i === 3 || stepProgress < stepThresholds[i + 1]);
                    
                    return (
                      <div key={step} className="flex-1 flex items-center gap-1">
                        <div className={cn(
                          "flex-1 h-1.5 rounded-full transition-all duration-300",
                          isActive 
                            ? orderStep === 'error' 
                              ? 'bg-red-500' 
                              : orderStep === 'done' 
                                ? 'bg-emerald-500' 
                                : 'bg-primary'
                            : 'bg-muted'
                        )} />
                        {i < 3 && <ArrowRight className={cn(
                          "w-3 h-3 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground/30"
                        )} />}
                      </div>
                    );
                  })}
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
          </AnimatePresence>

          {/* Error Warning */}
          {(simulationError || liquidityError) && orderStep === 'idle' && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-sm text-amber-400">{simulationError || liquidityError}</span>
            </div>
          )}

          {/* Market Title - Compact */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <p className="text-foreground font-medium text-sm leading-relaxed line-clamp-2">
              {displayTitle}
            </p>
          </div>

          {/* Price Chart - Optional, collapsible */}
          {!tradesLoading && trades.length > 0 && (
            <KalshiPriceChart 
              trades={trades} 
              yesPrice={market.yesPrice} 
              noPrice={market.noPrice}
              loading={tradesLoading}
            />
          )}

          {/* Wallet Connection */}
          {!connected && (
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-3 mb-3">
                <Wallet className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-foreground">Connect wallet to trade</span>
              </div>
              <WalletMultiButton className="!w-full !h-12 !rounded-xl !bg-primary !text-primary-foreground hover:!bg-primary/90 !font-medium !justify-center" />
            </div>
          )}

          {/* Side Selector - Only show in buy mode */}
          {!isSellMode ? (
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setSide('YES')}
                disabled={!connected || executing}
                className={cn(
                  'relative p-4 rounded-xl border-2 transition-all duration-200',
                  side === 'YES'
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                    : 'border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-border',
                  (!connected || executing) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {side === 'YES' && (
                  <motion.div
                    layoutId="sideIndicator"
                    className="absolute inset-0 rounded-xl border-2 border-emerald-500"
                  />
                )}
                <div className="relative">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <TrendingUp className={cn(
                      'w-5 h-5',
                      side === 'YES' ? 'text-emerald-400' : 'text-muted-foreground'
                    )} />
                    <span className={cn(
                      'font-bold text-lg',
                      side === 'YES' ? 'text-emerald-400' : 'text-foreground'
                    )}>
                      YES
                    </span>
                  </div>
                  <p className={cn(
                    'text-2xl font-bold',
                    side === 'YES' ? 'text-emerald-400' : 'text-foreground'
                  )}>
                    {market.yesPrice}¢
                  </p>
                </div>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setSide('NO')}
                disabled={!connected || executing}
                className={cn(
                  'relative p-4 rounded-xl border-2 transition-all duration-200',
                  side === 'NO'
                    ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/10'
                    : 'border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-border',
                  (!connected || executing) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {side === 'NO' && (
                  <motion.div
                    layoutId="sideIndicator"
                    className="absolute inset-0 rounded-xl border-2 border-red-500"
                  />
                )}
                <div className="relative">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <TrendingDown className={cn(
                      'w-5 h-5',
                      side === 'NO' ? 'text-red-400' : 'text-muted-foreground'
                    )} />
                    <span className={cn(
                      'font-bold text-lg',
                      side === 'NO' ? 'text-red-400' : 'text-foreground'
                    )}>
                      NO
                    </span>
                  </div>
                  <p className={cn(
                    'text-2xl font-bold',
                    side === 'NO' ? 'text-red-400' : 'text-foreground'
                  )}>
                    {market.noPrice}¢
                  </p>
                </div>
              </motion.button>
            </div>
          ) : (
            // Sell mode - show position info instead of side selector
            <div className={cn(
              "p-4 rounded-xl border text-center",
              side === 'YES' 
                ? "bg-emerald-500/10 border-emerald-500/30" 
                : "bg-red-500/10 border-red-500/30"
            )}>
              <span className="text-muted-foreground text-sm">Selling your </span>
              <span className={cn(
                "text-lg font-bold",
                side === 'YES' ? "text-emerald-400" : "text-red-400"
              )}>
                {side}
              </span>
              <span className="text-muted-foreground text-sm"> position @ {price}¢</span>
            </div>
          )}

          {/* Amount Input - Enhanced */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                {isSellMode ? 'Shares to Sell' : 'Amount (USDC)'}
              </label>
              {isSellMode && maxShares && (
                <button
                  onClick={() => setAmount(maxShares.toString())}
                  disabled={executing}
                  className="text-xs text-primary hover:underline disabled:opacity-50 font-medium"
                >
                  Max: {maxShares < 1 ? maxShares.toFixed(4) : maxShares.toFixed(2)}
                </button>
              )}
            </div>
            
            <div className="relative">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={!connected || executing}
                className="h-14 text-2xl font-bold bg-muted/30 border-border/50 rounded-xl text-center pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                {isSellMode ? 'shares' : 'USDC'}
              </span>
            </div>

            {/* Quick amount buttons */}
            {!isSellMode && connected && (
              <div className="flex gap-2">
                {quickAmounts.map(amt => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(amt.toString())}
                    disabled={executing}
                    className={cn(
                      "flex-1 rounded-lg h-9 text-xs font-medium",
                      amount === amt.toString() && "border-primary bg-primary/10"
                    )}
                  >
                    ${amt}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Trade Summary - Enhanced */}
          <AnimatePresence>
            {amount && parseFloat(amount) > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className={cn(
                  "p-4 rounded-xl border space-y-2",
                  side === 'YES' 
                    ? "bg-emerald-500/5 border-emerald-500/20" 
                    : "bg-red-500/5 border-red-500/20"
                )}>
                  {isSellMode ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Selling</span>
                        <span className={cn(
                          'font-semibold',
                          side === 'YES' ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {amount} {side}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">You receive</span>
                        <span className="font-bold text-foreground text-lg">~${estimatedUSDC}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">You pay</span>
                        <span className="font-semibold text-foreground">${amount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-sm">You get</span>
                        <span className={cn(
                          'font-bold text-xl',
                          side === 'YES' ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          ~{estimatedShares} {side}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-border/30 flex justify-between text-sm">
                        <span className="text-muted-foreground">Max payout if {side} wins</span>
                        <span className="font-bold text-foreground">
                          ${(parseFloat(estimatedShares) || 0).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trade Button - Enhanced */}
          <motion.div whileTap={{ scale: 0.98 }}>
            <Button
              onClick={executeTrade}
              disabled={!connected || !amount || parseFloat(amount) <= 0 || executing}
              className={cn(
                'w-full h-14 text-lg font-bold rounded-xl',
                'transition-all duration-200',
                isSellMode
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                  : side === 'YES' 
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                    : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
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
                  {isSellMode ? `Sell ${side}` : `Buy ${side} @ ${price}¢`}
                </>
              )}
            </Button>
          </motion.div>

          {/* Disclaimer */}
          <p className="text-xs text-center text-muted-foreground/60">
            Trading involves risk. Only trade what you can afford to lose.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
