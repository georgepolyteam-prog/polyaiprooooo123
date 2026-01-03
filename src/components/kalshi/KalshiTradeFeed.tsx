import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLiveKalshiData } from '@/hooks/useLiveKalshiData';

interface Trade {
  id: string;
  side: 'yes' | 'no';
  price: number;
  size: number;
  timestamp: number;
}

interface KalshiTradeFeedProps {
  ticker: string;
  maxTrades?: number;
}

export function KalshiTradeFeed({ ticker, maxTrades = 10 }: KalshiTradeFeedProps) {
  const { trades, isPolling } = useLiveKalshiData(ticker, true);
  const displayTrades = trades.slice(0, maxTrades);

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

  if (displayTrades.length === 0) {
    return null;
  }

  return (
    <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Recent Trades</span>
        {isPolling && (
          <div className="ml-auto flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground">LIVE</span>
          </div>
        )}
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {displayTrades.map((trade, idx) => (
            <motion.div
              key={trade.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex items-center justify-between p-2 rounded-lg',
                'bg-background/50 border border-border/30',
                idx === 0 && 'ring-1 ring-primary/30'
              )}
            >
              <div className="flex items-center gap-2">
                {trade.side === 'yes' ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <span className={cn(
                  'text-sm font-medium uppercase',
                  trade.side === 'yes' ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {trade.side}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-foreground">
                  {trade.price}¢
                </span>
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {trade.size.toFixed(0)} shares
                </span>
                <span className="text-xs text-muted-foreground/60 w-14 text-right">
                  {formatTime(trade.timestamp)}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}