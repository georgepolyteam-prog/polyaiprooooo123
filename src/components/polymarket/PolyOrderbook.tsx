import { useMemo, useState } from 'react';
import { RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
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

  const displayLevels = compact ? 5 : 10;

  const formatPrice = (price: number): string => {
    const cents = price <= 1 ? Math.round(price * 100) : Math.round(price);
    return `${cents}¢`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Order Book</span>
          {hasData && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Live</span>
            </div>
          )}
        </div>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-1.5 rounded hover:bg-muted transition-colors"
          >
            <RefreshCw className={cn(
              'w-3 h-3 text-muted-foreground',
              (refreshing || loading) && 'animate-spin'
            )} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto p-2">
        {loading && !hasData ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Loader2 className="w-6 h-6 text-primary/50 animate-spin mb-2" />
            <p className="text-xs text-muted-foreground">Loading orderbook...</p>
          </div>
        ) : !hasData ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-6 h-6 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">No orderbook data</p>
            {onRefresh && (
              <button 
                onClick={handleRefresh}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Refresh
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Column Headers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                <span>Bid</span>
                <span className="text-emerald-400 font-semibold">YES</span>
                <span>Ask</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                <span>Bid</span>
                <span className="text-red-400 font-semibold">NO</span>
                <span>Ask</span>
              </div>
            </div>

            {/* Orderbook Levels */}
            <div className="grid grid-cols-2 gap-3">
              {/* YES Side */}
              <div className="space-y-0.5">
                {orderbook!.yesBids.slice(0, displayLevels).map((level, idx) => (
                  <div key={`bid-${idx}`} className="relative h-6 rounded overflow-hidden">
                    <div
                      className="absolute inset-y-0 right-0 bg-emerald-500/15"
                      style={{ width: `${Math.min((level.size / maxSize) * 100, 100)}%` }}
                    />
                    <div className="relative flex justify-between items-center h-full px-2 text-[11px]">
                      <span className="font-mono font-medium text-emerald-400">{formatPrice(level.price)}</span>
                      <span className="text-muted-foreground font-mono">{Math.round(level.size).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                
                {orderbook!.yesAsks.slice(0, displayLevels).reverse().map((level, idx) => (
                  <div key={`ask-${idx}`} className="relative h-6 rounded overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-red-500/15"
                      style={{ width: `${Math.min((level.size / maxSize) * 100, 100)}%` }}
                    />
                    <div className="relative flex justify-between items-center h-full px-2 text-[11px]">
                      <span className="text-muted-foreground font-mono">{Math.round(level.size).toLocaleString()}</span>
                      <span className="font-mono font-medium text-red-400">{formatPrice(level.price)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* NO Side */}
              <div className="space-y-0.5">
                {orderbook!.noBids.slice(0, displayLevels).map((level, idx) => (
                  <div key={`no-bid-${idx}`} className="relative h-6 rounded overflow-hidden">
                    <div
                      className="absolute inset-y-0 right-0 bg-red-500/15"
                      style={{ width: `${Math.min((level.size / maxSize) * 100, 100)}%` }}
                    />
                    <div className="relative flex justify-between items-center h-full px-2 text-[11px]">
                      <span className="font-mono font-medium text-red-400">{formatPrice(level.price)}</span>
                      <span className="text-muted-foreground font-mono">{Math.round(level.size).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                
                {orderbook!.noAsks.slice(0, displayLevels).reverse().map((level, idx) => (
                  <div key={`no-ask-${idx}`} className="relative h-6 rounded overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-emerald-500/15"
                      style={{ width: `${Math.min((level.size / maxSize) * 100, 100)}%` }}
                    />
                    <div className="relative flex justify-between items-center h-full px-2 text-[11px]">
                      <span className="text-muted-foreground font-mono">{Math.round(level.size).toLocaleString()}</span>
                      <span className="font-mono font-medium text-emerald-400">{formatPrice(level.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Spread */}
            {orderbook!.spread !== undefined && (
              <div className="pt-2 border-t border-border/30 flex justify-center gap-4">
                <span className="text-[10px] text-muted-foreground">
                  Spread: <span className="text-foreground font-medium font-mono">{formatPrice(orderbook!.spread)}</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Mid: <span className="text-foreground font-medium font-mono">{formatPrice(orderbook!.midPrice)}</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
