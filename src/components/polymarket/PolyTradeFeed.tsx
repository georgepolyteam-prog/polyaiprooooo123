import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, TrendingDown, AlertCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Trade } from '@/hooks/usePolymarketTerminal';

interface PolyTradeFeedProps {
  trades: Trade[];
  maxTrades?: number;
  connected?: boolean;
}

export function PolyTradeFeed({ trades, maxTrades = 15, connected = false }: PolyTradeFeedProps) {
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
    <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Live Trades</span>
        {connected && (
          <div className="ml-auto flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground">LIVE</span>
          </div>
        )}
      </div>

      {displayTrades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No trades found</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {connected ? 'Waiting for new trades...' : 'Connecting to live feed...'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
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
                  className={cn(
                    'flex items-center justify-between p-2 rounded-lg',
                    'bg-background/50 border border-border/30',
                    idx === 0 && 'ring-1 ring-primary/30',
                    isWhale && 'ring-1 ring-amber-500/50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {trade.side === 'BUY' ? (
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                    <div className="flex flex-col">
                      <span className={cn(
                        'text-sm font-medium uppercase',
                        trade.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {trade.side} {trade.token_label || 'YES'}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {shortenWallet(trade.user || trade.taker)}
                      </span>
                    </div>
                    {isWhale && (
                      <span className="text-xs">🐋</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-mono text-foreground">
                        {(trade.price * 100).toFixed(0)}¢
                      </span>
                      <span className={cn(
                        'text-xs font-medium',
                        isWhale ? 'text-amber-400' : 'text-muted-foreground'
                      )}>
                        {formatVolume(trade.price, trade.shares_normalized || trade.shares)}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 w-12 text-right">
                      {formatTime(trade.timestamp)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
