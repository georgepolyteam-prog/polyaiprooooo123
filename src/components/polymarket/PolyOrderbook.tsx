import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Orderbook } from '@/hooks/usePolymarketTerminal';

interface PolyOrderbookProps {
  orderbook: Orderbook | null;
  onRefresh?: () => void;
  compact?: boolean;
  loading?: boolean;
}

export function PolyOrderbook({ orderbook, onRefresh, compact = false, loading = false }: PolyOrderbookProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  // Check if we have ANY data at all
  const hasData = useMemo(() => {
    if (!orderbook) return false;
    return (
      orderbook.yesBids.length > 0 ||
      orderbook.yesAsks.length > 0 ||
      orderbook.noBids.length > 0 ||
      orderbook.noAsks.length > 0
    );
  }, [orderbook]);

  const maxSize = useMemo(() => {
    if (!orderbook) return 1;
    const allSizes = [
      ...orderbook.yesBids.map(l => l.size),
      ...orderbook.yesAsks.map(l => l.size),
      ...orderbook.noBids.map(l => l.size),
      ...orderbook.noAsks.map(l => l.size),
    ];
    return Math.max(...allSizes, 1);
  }, [orderbook]);

  const displayLevels = compact ? 5 : 8;

  // Format price - handle both 0-1 and 0-100 ranges
  const formatPrice = (price: number): string => {
    // If price is 0-1 range, convert to cents
    const cents = price <= 1 ? Math.round(price * 100) : Math.round(price);
    return `${cents}¢`;
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
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Order Book</span>
          {hasData && (
            <div className="flex items-center gap-1 ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Live</span>
            </div>
          )}
        </div>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw className={cn(
              'w-4 h-4 text-muted-foreground',
              (refreshing || loading) && 'animate-spin'
            )} />
          </button>
        )}
      </div>

      {loading && !hasData ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Loader2 className="w-8 h-8 text-primary/50 animate-spin mb-2" />
          <p className="text-sm text-muted-foreground">Loading orderbook...</p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No orderbook data available</p>
          <p className="text-xs text-muted-foreground/70 mt-1">This market may not have active orders</p>
          {onRefresh && (
            <button 
              onClick={handleRefresh}
              className="mt-3 text-xs text-primary hover:underline"
            >
              Try refreshing
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {/* YES Side */}
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-1">
                <span>Bid</span>
                <span className="text-emerald-400 font-semibold">YES</span>
                <span>Ask</span>
              </div>
              
              <div className="space-y-1">
                {orderbook!.yesBids.slice(0, displayLevels).map((level, idx) => (
                  <div key={`bid-${idx}`} className="relative h-7 rounded-md overflow-hidden">
                    <div
                      className="absolute inset-y-0 right-0 bg-emerald-500/15 rounded-md"
                      style={{ width: `${Math.min((level.size / maxSize) * 100, 100)}%` }}
                    />
                    <div className="relative flex justify-between items-center h-full px-2.5 text-xs">
                      <span className="font-mono font-medium text-emerald-400">{formatPrice(level.price)}</span>
                      <span className="text-muted-foreground font-mono">{Math.round(level.size).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                
                {orderbook!.yesAsks.slice(0, displayLevels).reverse().map((level, idx) => (
                  <div key={`ask-${idx}`} className="relative h-7 rounded-md overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-red-500/15 rounded-md"
                      style={{ width: `${Math.min((level.size / maxSize) * 100, 100)}%` }}
                    />
                    <div className="relative flex justify-between items-center h-full px-2.5 text-xs">
                      <span className="text-muted-foreground font-mono">{Math.round(level.size).toLocaleString()}</span>
                      <span className="font-mono font-medium text-red-400">{formatPrice(level.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* NO Side */}
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-1">
                <span>Bid</span>
                <span className="text-red-400 font-semibold">NO</span>
                <span>Ask</span>
              </div>
              
              <div className="space-y-1">
                {orderbook!.noBids.slice(0, displayLevels).map((level, idx) => (
                  <div key={`no-bid-${idx}`} className="relative h-7 rounded-md overflow-hidden">
                    <div
                      className="absolute inset-y-0 right-0 bg-red-500/15 rounded-md"
                      style={{ width: `${Math.min((level.size / maxSize) * 100, 100)}%` }}
                    />
                    <div className="relative flex justify-between items-center h-full px-2.5 text-xs">
                      <span className="font-mono font-medium text-red-400">{formatPrice(level.price)}</span>
                      <span className="text-muted-foreground font-mono">{Math.round(level.size).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                
                {orderbook!.noAsks.slice(0, displayLevels).reverse().map((level, idx) => (
                  <div key={`no-ask-${idx}`} className="relative h-7 rounded-md overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-emerald-500/15 rounded-md"
                      style={{ width: `${Math.min((level.size / maxSize) * 100, 100)}%` }}
                    />
                    <div className="relative flex justify-between items-center h-full px-2.5 text-xs">
                      <span className="text-muted-foreground font-mono">{Math.round(level.size).toLocaleString()}</span>
                      <span className="font-mono font-medium text-emerald-400">{formatPrice(level.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Spread indicator */}
          {orderbook!.spread !== undefined && (
            <div className="mt-4 pt-3 border-t border-border/30 flex justify-center gap-6">
              <span className="text-xs text-muted-foreground">
                Spread: <span className="text-foreground font-medium font-mono">{formatPrice(orderbook!.spread)}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                Mid: <span className="text-foreground font-medium font-mono">{formatPrice(orderbook!.midPrice)}</span>
              </span>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
