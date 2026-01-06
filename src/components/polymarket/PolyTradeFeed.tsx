import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertCircle, Radio, Loader2, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Trade } from '@/hooks/usePolymarketTerminal';
import { Skeleton } from '@/components/ui/skeleton';

interface PolyTradeFeedProps {
  trades: Trade[];
  maxTrades?: number;
  connected?: boolean;
  loading?: boolean;
  onTradeClick?: (trade: Trade) => void;
}

export function PolyTradeFeed({ trades, maxTrades = 15, connected = false, loading = false, onTradeClick }: PolyTradeFeedProps) {
  const displayTrades = useMemo(() => {
    return trades.slice(0, maxTrades);
  }, [trades, maxTrades]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const formatVolume = (price: number, shares: number) => {
    const vol = price * shares;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}k`;
    return `$${vol.toFixed(0)}`;
  };

  const shortenWallet = (wallet: string) => {
    if (!wallet || wallet.length < 10) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl bg-gradient-to-b from-card/80 to-card/60 border border-border/50 backdrop-blur-xl shadow-xl shadow-black/5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Waves className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Recent Trades</span>
        </div>
        {loading && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/30">
            <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Loading</span>
          </div>
        )}
        {!loading && connected && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">Live</span>
          </div>
        )}
      </div>

      {loading && displayTrades.length === 0 ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/30">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          ))}
        </div>
      ) : displayTrades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No trades yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {connected ? 'Waiting for new trades...' : 'Connecting to live feed...'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {displayTrades.map((trade, idx) => {
              const volume = trade.price * (trade.shares_normalized || trade.shares);
              const isWhale = volume >= 1000;
              
              return (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => onTradeClick?.(trade)}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-xl',
                    'bg-background/50 border border-border/30 hover:border-border/50 transition-colors',
                    idx === 0 && 'ring-1 ring-primary/20 bg-primary/5',
                    isWhale && 'ring-1 ring-amber-500/30 bg-amber-500/5',
                    onTradeClick && 'cursor-pointer hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-lg',
                      trade.side === 'BUY' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                    )}>
                      {trade.side === 'BUY' ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className={cn(
                        'text-sm font-semibold uppercase',
                        trade.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {trade.side} {trade.token_label || 'YES'}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {shortenWallet(trade.user || trade.taker)}
                      </span>
                    </div>
                    {isWhale && (
                      <span className="text-sm">🐋</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold font-mono text-foreground">
                        {(trade.price * 100).toFixed(0)}¢
                      </span>
                      <span className={cn(
                        'text-xs font-medium font-mono',
                        isWhale ? 'text-amber-400' : 'text-muted-foreground'
                      )}>
                        {formatVolume(trade.price, trade.shares_normalized || trade.shares)}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 w-14 text-right">
                      {formatTime(trade.timestamp)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
