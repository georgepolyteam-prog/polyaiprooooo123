import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDflowApi } from '@/hooks/useDflowApi';
import { useDflowWebSocket, type TradeUpdate } from '@/hooks/useDflowWebSocket';

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
  const { getTrades, loading } = useDflowApi();
  const [trades, setTrades] = useState<Trade[]>([]);

  // WebSocket for real-time trade updates
  useDflowWebSocket({
    tickers: [ticker],
    channels: ['trades'],
    onTradeUpdate: (update: TradeUpdate) => {
      if (update.ticker === ticker) {
        const newTrade: Trade = {
          id: `${update.timestamp}-${Math.random()}`,
          side: update.side,
          price: update.price,
          size: update.size,
          timestamp: update.timestamp,
        };
        
        setTrades(prev => [newTrade, ...prev].slice(0, maxTrades));
      }
    },
  });

  // Initial fetch
  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const data = await getTrades(ticker, maxTrades);
        if (data?.trades) {
          const parsedTrades: Trade[] = data.trades.map((t: any, idx: number) => ({
            id: `${t.timestamp || idx}-${idx}`,
            side: (t.side || t.taker_side || 'yes').toLowerCase() as 'yes' | 'no',
            price: Math.round((parseFloat(t.price) || 0.5) * 100),
            size: parseFloat(t.size || t.amount || t.count || 1),
            timestamp: t.timestamp || Date.now() - idx * 60000,
          }));
          setTrades(parsedTrades);
        }
      } catch (err) {
        console.error('Failed to fetch trades:', err);
      }
    };

    fetchTrades();
  }, [ticker, maxTrades, getTrades]);

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

  if (loading && trades.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-sm font-medium text-foreground">Loading trades...</span>
        </div>
      </div>
    );
  }

  if (trades.length === 0) {
    return null;
  }

  return (
    <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Recent Trades</span>
        <div className="ml-auto flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {trades.map((trade, idx) => (
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