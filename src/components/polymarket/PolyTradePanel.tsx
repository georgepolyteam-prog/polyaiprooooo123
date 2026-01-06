import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, ExternalLink, Loader2, Zap, 
  Wallet, Link2, Shield, CheckCircle2, RotateCcw, AlertCircle,
  Sparkles, DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type PolyMarket } from '@/hooks/usePolymarketTerminal';
import { useDomeRouter } from '@/hooks/useDomeRouter';
import { useUSDCBalance } from '@/hooks/useUSDCBalance';
import { toast } from 'sonner';

interface PolyTradePanelProps {
  market: PolyMarket;
  compact?: boolean;
}

const POLYGON_CHAIN_ID = 137;

export function PolyTradePanel({ market, compact = false }: PolyTradePanelProps) {
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();

  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [amount, setAmount] = useState('10');
  const [limitPrice, setLimitPrice] = useState('');

  // Dome Router - handles linking, credentials, and trading
  const {
    isLinked,
    isLinking,
    linkUser,
    isPlacingOrder,
    placeOrder,
    tradeStage,
    tradeStageMessage,
    clearSession,
    isDomeReady,
    dismissOverlay,
  } = useDomeRouter();

  // USDC balance
  const { balance, hasSufficientBalance, refetch, isFullyApproved, approveUSDC, isApproving } = useUSDCBalance();

  // Check network
  const isWrongNetwork = isConnected && chainId !== POLYGON_CHAIN_ID;

  // Trading readiness
  const isFunded = balance > 0;
  const hasYesToken = !!market.yesTokenId;
  const hasNoToken = !!market.noTokenId;
  const canTrade = isConnected && !isWrongNetwork && isLinked && isFullyApproved && isFunded;

  const marketPrice = side === 'YES' ? market.yesPrice : market.noPrice;
  const effectivePrice = orderType === 'limit' && limitPrice ? Number(limitPrice) : marketPrice;
  const shares = amount && effectivePrice > 0 ? (Number(amount) / (effectivePrice / 100)).toFixed(2) : '--';
  const potentialWin = amount && effectivePrice > 0 ? ((Number(amount) / (effectivePrice / 100)) - Number(amount)).toFixed(2) : '--';

  const handleSwitchNetwork = async () => {
    try {
      await switchChainAsync({ chainId: POLYGON_CHAIN_ID });
      toast.success('Switched to Polygon');
      refetch();
    } catch (error) {
      toast.error('Failed to switch network');
    }
  };

  const handleLinkWallet = async () => {
    try {
      await linkUser();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleTrade = async () => {
    const tokenId = side === 'YES' ? market.yesTokenId : market.noTokenId;
    
    if (!tokenId) {
      toast.error(`${side} token not available`);
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    if (!hasSufficientBalance(amountNum)) {
      toast.error(`Insufficient balance. You have $${balance.toFixed(2)}`);
      return;
    }

    const priceDecimal = effectivePrice / 100;
    
    // For market orders, use aggressive price to ensure fill
    const orderPrice = orderType === 'market'
      ? Math.round(Math.min(priceDecimal * 1.15, 0.99) * 100) / 100
      : Math.round(priceDecimal * 100) / 100;

    const result = await placeOrder({
      tokenId,
      side: 'BUY',
      amount: amountNum,
      price: orderPrice,
      isMarketOrder: orderType === 'market',
    });

    if (result.success) {
      toast.success(`Order placed! ${shares} ${side} shares @ ${effectivePrice}¢`, {
        description: result.orderId ? `Order: ${result.orderId.slice(0, 12)}...` : 'Submitted',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      });
      setAmount('10');
      setLimitPrice('');
      refetch();
    }
  };

  // Trade Progress Overlay
  const showOverlay = tradeStage !== 'idle';

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('relative bg-card/50 p-3 h-full overflow-auto', compact && 'p-2')}
    >
      {/* Trade Progress Overlay */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
          >
            <div className="text-center">
              {tradeStage === 'completed' ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 10 }}
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-400">Order Placed!</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={dismissOverlay}
                    className="mt-3"
                  >
                    Continue Trading
                  </Button>
                </motion.div>
              ) : tradeStage === 'error' ? (
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-sm font-semibold text-red-400">{tradeStageMessage || 'Order Failed'}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={dismissOverlay}
                    className="mt-3"
                  >
                    Try Again
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="relative w-16 h-16 mx-auto mb-4">
                    <div className={cn(
                      "absolute inset-0 rounded-full animate-ping opacity-30",
                      side === 'YES' ? "bg-emerald-500" : "bg-red-500"
                    )} />
                    <div className={cn(
                      "absolute inset-0 rounded-full flex items-center justify-center",
                      side === 'YES' ? "bg-emerald-500/20" : "bg-red-500/20"
                    )}>
                      <Loader2 className={cn(
                        "w-8 h-8 animate-spin",
                        side === 'YES' ? "text-emerald-400" : "text-red-400"
                      )} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground animate-pulse">{tradeStageMessage}</p>
                  {tradeStage === 'signing-order' && (
                    <p className="text-[10px] text-muted-foreground/70 mt-2">Check your wallet</p>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-primary" />
          <h3 className="text-[11px] font-semibold text-foreground">Trade</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {isConnected && !isWrongNetwork && isLinked && (
            <button
              onClick={() => { if (window.confirm('Re-link wallet?')) clearSession(); }}
              className="text-[8px] text-orange-400 hover:text-orange-300 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-orange-500/10 border border-orange-500/30"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          )}
          {isConnected && !isWrongNetwork && (
            <span className="text-[9px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted/50">
              ${balance.toFixed(2)}
            </span>
          )}
          <a
            href={market.marketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-muted-foreground hover:text-primary flex items-center gap-0.5"
          >
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>

      {/* Not Connected */}
      {!isConnected && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Wallet className="w-8 h-8 text-muted-foreground/50 mb-2" />
          <p className="text-[10px] text-muted-foreground mb-2">Connect wallet to trade</p>
          <Button size="sm" onClick={() => open()} className="h-7 text-[10px]">
            Connect Wallet
          </Button>
        </div>
      )}

      {/* Wrong Network */}
      {isWrongNetwork && (
        <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30 mb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
            <p className="text-[10px] text-orange-200 flex-1">Switch to Polygon</p>
            <Button size="sm" variant="outline" onClick={handleSwitchNetwork} disabled={isSwitching} className="h-6 text-[9px]">
              {isSwitching ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Switch'}
            </Button>
          </div>
        </div>
      )}

      {/* Link Wallet */}
      {isConnected && !isWrongNetwork && !isLinked && (
        <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/40 mb-2">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-4 h-4 text-primary" />
            <div>
              <p className="text-[10px] font-semibold text-primary">Link Wallet</p>
              <p className="text-[9px] text-primary/70">One-time setup</p>
            </div>
          </div>
          <Button size="sm" onClick={handleLinkWallet} disabled={isLinking || !isDomeReady} className="w-full h-7 text-[10px]">
            {isLinking ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Link2 className="w-3 h-3 mr-1" />}
            {isLinking ? 'Linking...' : 'Link Wallet'}
          </Button>
        </div>
      )}

      {/* Approve Contracts */}
      {isConnected && !isWrongNetwork && isLinked && !isFullyApproved && (
        <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/40 mb-2">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <div>
              <p className="text-[10px] font-semibold text-blue-200">Approve Contracts</p>
              <p className="text-[9px] text-blue-300/70">One-time approval</p>
            </div>
          </div>
          <Button size="sm" onClick={approveUSDC} disabled={isApproving} className="w-full h-7 text-[10px] bg-blue-500 hover:bg-blue-600">
            {isApproving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Shield className="w-3 h-3 mr-1" />}
            {isApproving ? 'Approving...' : 'Approve'}
          </Button>
        </div>
      )}

      {/* Fund Wallet */}
      {isConnected && !isWrongNetwork && isLinked && isFullyApproved && !isFunded && (
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/40 mb-2">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <p className="text-[10px] font-semibold text-emerald-200">Fund Your Wallet</p>
          </div>
          <p className="text-[9px] text-emerald-300/70 mb-1">Send USDC (Polygon) to trade</p>
          <p className="text-[8px] text-muted-foreground font-mono break-all">{address}</p>
        </div>
      )}

      {/* Trading UI - only show if connected */}
      {isConnected && !isWrongNetwork && (
        <>
          {/* Side selector */}
          <div className="grid grid-cols-2 gap-1 mb-2">
            <button
              type="button"
              onClick={() => setSide('YES')}
              className={cn(
                'flex items-center justify-center gap-1 h-8 rounded-lg text-[10px] font-semibold transition-all border',
                side === 'YES'
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400 shadow-sm shadow-emerald-500/20'
                  : 'bg-muted/30 border-border/30 text-muted-foreground hover:border-emerald-500/40'
              )}
            >
              <TrendingUp className="w-3 h-3" />
              YES {market.yesPrice}¢
            </button>
            <button
              type="button"
              onClick={() => setSide('NO')}
              className={cn(
                'flex items-center justify-center gap-1 h-8 rounded-lg text-[10px] font-semibold transition-all border',
                side === 'NO'
                  ? 'bg-red-500/20 border-red-500/60 text-red-400 shadow-sm shadow-red-500/20'
                  : 'bg-muted/30 border-border/30 text-muted-foreground hover:border-red-500/40'
              )}
            >
              <TrendingDown className="w-3 h-3" />
              NO {market.noPrice}¢
            </button>
          </div>

          {/* Order Type Toggle */}
          <div className="flex items-center gap-0.5 mb-2 p-0.5 rounded-md bg-muted/40 border border-border/40">
            <button
              type="button"
              onClick={() => setOrderType('market')}
              className={cn(
                'flex-1 py-1 text-[9px] font-medium rounded transition-all',
                orderType === 'market'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Market
            </button>
            <button
              type="button"
              onClick={() => setOrderType('limit')}
              className={cn(
                'flex-1 py-1 text-[9px] font-medium rounded transition-all',
                orderType === 'limit'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Limit
            </button>
          </div>

          {/* Amount & Limit Price */}
          <div className={cn('grid gap-1.5 mb-2', orderType === 'limit' ? 'grid-cols-2' : 'grid-cols-1')}>
            <div>
              <label className="block text-[8px] text-muted-foreground mb-0.5">Amount (USD)</label>
              <Input
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-7 text-[11px] bg-muted/40 border-border/30"
                placeholder="10"
              />
            </div>
            {orderType === 'limit' && (
              <div>
                <label className="block text-[8px] text-muted-foreground mb-0.5">Limit Price (¢)</label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="h-7 text-[11px] bg-muted/40 border-border/30"
                  placeholder={String(marketPrice)}
                />
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-1 text-center text-[9px] mb-2">
            <div className="p-1.5 rounded-lg bg-background/30 border border-border/20">
              <p className="text-muted-foreground text-[8px]">Est. Shares</p>
              <p className="font-semibold text-foreground">{shares}</p>
            </div>
            <div className="p-1.5 rounded-lg bg-background/30 border border-border/20">
              <p className="text-muted-foreground text-[8px]">Potential Win</p>
              <p className={cn('font-semibold', potentialWin !== '--' ? 'text-emerald-400' : 'text-foreground')}>
                {potentialWin !== '--' ? `+$${potentialWin}` : '--'}
              </p>
            </div>
          </div>

          {/* Trade button */}
          <Button
            className={cn(
              'w-full h-9 font-bold rounded-lg transition-all text-[11px]',
              side === 'YES'
                ? 'bg-gradient-to-r from-emerald-500/80 to-emerald-600/80 hover:from-emerald-500 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-gradient-to-r from-red-500/80 to-red-600/80 hover:from-red-500 hover:to-red-600 text-white shadow-lg shadow-red-500/30'
            )}
            onClick={handleTrade}
            disabled={isPlacingOrder || !canTrade || !amount || Number(amount) <= 0 || (orderType === 'limit' && (!limitPrice || Number(limitPrice) <= 0))}
          >
            {isPlacingOrder ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : !canTrade ? (
              'Complete Setup Above'
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {orderType === 'limit' ? 'LIMIT' : 'BUY'} {side} @ {effectivePrice}¢
              </>
            )}
          </Button>
        </>
      )}
    </motion.section>
  );
}