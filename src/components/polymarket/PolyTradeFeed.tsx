import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertCircle, Radio, Loader2, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Trade } from '@/hooks/usePolymarketTerminal';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Recent Trades</span>
        </div>
        {loading && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/50 border border-border/30">
            <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
            <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Loading</span>
          </div>
        )}
        {!loading && connected && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
            <span className="text-[9px] font-medium text-emerald-500 uppercase tracking-wider">Live</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading && displayTrades.length === 0 ? (
          <div className="p-2 space-y-1">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-6 h-6 rounded" />
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-2.5 w-12" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-2.5 w-8" />
                </div>
              </div>
            ))}
          </div>
        ) : displayTrades.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-6 h-6 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">No trades yet</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              {connected ? 'Waiting for new trades...' : 'Connecting...'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-2 space-y-0.5">
              <AnimatePresence mode="popLayout">
                {displayTrades.map((trade, idx) => {
                  const volume = trade.price * (trade.shares_normalized || trade.shares);
                  const isWhale = volume >= 1000;
                  
                  return (
                    <motion.div
                      key={trade.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => onTradeClick?.(trade)}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-lg',
                        'bg-muted/20 hover:bg-muted/40 transition-colors',
                        idx === 0 && 'ring-1 ring-primary/20 bg-primary/5',
                        isWhale && 'ring-1 ring-amber-500/30 bg-amber-500/5',
                        onTradeClick && 'cursor-pointer'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn(
                          'p-1.5 rounded',
                          trade.side === 'BUY' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                        )}>
                          {trade.side === 'BUY' ? (
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-400" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={cn(
                            'text-[11px] font-semibold uppercase',
                            trade.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                          )}>
                            {trade.side} {trade.token_label || 'YES'}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-mono truncate">
                            {shortenWallet(trade.user || trade.taker)}
                          </span>
                        </div>
                        {isWhale && <span className="text-xs">🐋</span>}
                      </div>
                      
                      <div className="flex items-center gap-2 text-right shrink-0">
                        <div className="flex flex-col items-end">
                          <span className="text-[11px] font-bold font-mono text-foreground">
                            {(trade.price * 100).toFixed(0)}¢
                          </span>
                          <span className={cn(
                            'text-[10px] font-mono',
                            isWhale ? 'text-amber-400' : 'text-muted-foreground'
                          )}>
                            {formatVolume(trade.price, trade.shares_normalized || trade.shares)}
                          </span>
                        </div>
                        <span className="text-[9px] text-muted-foreground/60 w-10 text-right">
                          {formatTime(trade.timestamp)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
