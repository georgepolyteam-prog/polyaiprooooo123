import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLiveKalshiData } from '@/hooks/useLiveKalshiData';

interface OrderbookLevel {
  price: number;
  size: number;
}

interface KalshiOrderbookProps {
  ticker: string;
  compact?: boolean;
}

export function KalshiOrderbook({ ticker, compact = false }: KalshiOrderbookProps) {
  const { orderbook, isPolling, refetch } = useLiveKalshiData(ticker, true);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Calculate max size for bar widths
  const maxSize = useMemo(() => {
    if (!orderbook) return 1;
    const allSizes = [
      ...orderbook.yesBids.map(l => l.size),
      ...orderbook.yesAsks.map(l => l.size),
    ];
    return Math.max(...allSizes, 1);
  }, [orderbook]);

  const displayLevels = compact ? 5 : 8;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl bg-muted/30 border border-border/50"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Order Book</span>
          {isPolling && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground">LIVE</span>
            </div>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn(
            'w-4 h-4 text-muted-foreground',
            refreshing && 'animate-spin'
          )} />
        </button>
      </div>

      {/* No data state */}
      {(!orderbook || (orderbook.yesBids.length === 0 && orderbook.noBids.length === 0)) ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No orderbook data available</p>
          <p className="text-xs text-muted-foreground/70 mt-1">This market may not have active orders</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {/* YES Side */}
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-1">
                <span>Bid</span>
                <span className="text-emerald-400 font-medium">YES</span>
                <span>Ask</span>
              </div>
              
              <div className="space-y-1">
                {/* Bids */}
                {orderbook.yesBids.slice(0, displayLevels).map((level, idx) => (
                  <div key={`bid-${idx}`} className="relative h-6">
                    <div
                      className="absolute inset-y-0 right-0 bg-emerald-500/20 rounded-sm"
                      style={{ width: `${(level.size / maxSize) * 100}%` }}
                    />
                    <div className="relative flex justify-between items-center h-full px-2 text-xs">
                      <span className="font-mono text-emerald-400">{level.price}¢</span>
                      <span className="text-muted-foreground">{level.size.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
                
                {/* Asks (reversed) */}
                {orderbook.yesAsks.slice(0, displayLevels).reverse().map((level, idx) => (
                  <div key={`ask-${idx}`} className="relative h-6">
                    <div
                      className="absolute inset-y-0 left-0 bg-red-500/20 rounded-sm"
                      style={{ width: `${(level.size / maxSize) * 100}%` }}
                    />
                    <div className="relative flex justify-between items-center h-full px-2 text-xs">
                      <span className="text-muted-foreground">{level.size.toFixed(0)}</span>
                      <span className="font-mono text-red-400">{level.price}¢</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* NO Side */}
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-1">
                <span>Bid</span>
                <span className="text-red-400 font-medium">NO</span>
                <span>Ask</span>
              </div>
              
              <div className="space-y-1">
                {orderbook.noBids.slice(0, displayLevels).map((level, idx) => (
                  <div key={`no-bid-${idx}`} className="relative h-6">
                    <div
                      className="absolute inset-y-0 right-0 bg-red-500/20 rounded-sm"
                      style={{ width: `${(level.size / maxSize) * 100}%` }}
                    />
                    <div className="relative flex justify-between items-center h-full px-2 text-xs">
                      <span className="font-mono text-red-400">{level.price}¢</span>
                      <span className="text-muted-foreground">{level.size.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
                
                {orderbook.noAsks.slice(0, displayLevels).reverse().map((level, idx) => (
                  <div key={`no-ask-${idx}`} className="relative h-6">
                    <div
                      className="absolute inset-y-0 left-0 bg-emerald-500/20 rounded-sm"
                      style={{ width: `${(level.size / maxSize) * 100}%` }}
                    />
                    <div className="relative flex justify-between items-center h-full px-2 text-xs">
                      <span className="text-muted-foreground">{level.size.toFixed(0)}</span>
                      <span className="font-mono text-emerald-400">{level.price}¢</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Spread indicator */}
          {orderbook.yesBids[0] && orderbook.yesAsks[0] && (
            <div className="mt-3 pt-3 border-t border-border/30 flex justify-center">
              <span className="text-xs text-muted-foreground">
                Spread: <span className="text-foreground font-medium">
                  {Math.abs(orderbook.yesAsks[0].price - orderbook.yesBids[0].price)}¢
                </span>
              </span>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}