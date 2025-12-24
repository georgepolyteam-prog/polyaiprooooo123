import { GlassCard } from './GlassCard';
import { BookOpen, ArrowUpDown } from 'lucide-react';

interface OrderLevel {
  price: number;
  size: number;
}

interface OrderBookProps {
  bids: OrderLevel[];
  asks: OrderLevel[];
  spread: number;
  midPrice: number;
}

export function OrderBook({ bids, asks, spread, midPrice }: OrderBookProps) {
  const formatUsd = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  const maxBidSize = Math.max(...bids.map(b => b.size), 1);
  const maxAskSize = Math.max(...asks.map(a => a.size), 1);

  const totalBidDepth = bids.reduce((sum, b) => sum + b.size, 0);
  const totalAskDepth = asks.reduce((sum, a) => sum + a.size, 0);

  const hasOrderbookData = bids.length > 0 || asks.length > 0;

  return (
    <GlassCard className="p-6" cyber>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold">Live Order Book</h3>
        </div>
        {hasOrderbookData && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/30 text-xs font-mono">
            <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Spread:</span>
            <span className="text-foreground font-medium">{spread.toFixed(2)}%</span>
          </div>
        )}
      </div>

      {!hasOrderbookData ? (
        <div className="text-center py-8">
          <p className="text-sm font-medium text-foreground">Order book data unavailable</p>
          <p className="text-xs text-muted-foreground mt-1">Real-time order book data not available for this market</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {/* Bids (Buy YES) */}
            <div>
              <div className="text-xs text-muted-foreground mb-2 flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-medium">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  BIDS (Buy YES)
                </span>
                <span className="text-success font-mono">{formatUsd(totalBidDepth)}</span>
              </div>
              <div className="space-y-1">
                {bids.slice(0, 6).map((bid, i) => (
                  <div key={i} className="relative group">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-success/30 to-success/10 rounded transition-all duration-300 group-hover:from-success/40"
                      style={{ width: `${(bid.size / maxBidSize) * 100}%` }}
                    />
                    <div className="relative flex justify-between px-2 py-1.5 text-sm">
                      <span className="text-success font-mono font-medium">{bid.price.toFixed(1)}%</span>
                      <span className="text-muted-foreground font-mono">{formatUsd(bid.size)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Asks (Sell YES) */}
            <div>
              <div className="text-xs text-muted-foreground mb-2 flex justify-between items-center">
                <span className="text-destructive font-mono">{formatUsd(totalAskDepth)}</span>
                <span className="flex items-center gap-1.5 font-medium">
                  ASKS (Sell YES)
                  <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                </span>
              </div>
              <div className="space-y-1">
                {asks.slice(0, 6).map((ask, i) => (
                  <div key={i} className="relative group">
                    <div 
                      className="absolute inset-y-0 right-0 bg-gradient-to-l from-destructive/30 to-destructive/10 rounded transition-all duration-300 group-hover:from-destructive/40"
                      style={{ width: `${(ask.size / maxAskSize) * 100}%` }}
                    />
                    <div className="relative flex justify-between px-2 py-1.5 text-sm">
                      <span className="text-muted-foreground font-mono">{formatUsd(ask.size)}</span>
                      <span className="text-destructive font-mono font-medium">{ask.price.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-0.5">Mid Price</div>
              <div className="font-bold text-lg font-mono bg-gradient-to-r from-success to-primary bg-clip-text text-transparent">
                {midPrice.toFixed(1)}%
              </div>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-0.5">Total Depth</div>
              <div className="font-bold text-lg font-mono">{formatUsd(totalBidDepth + totalAskDepth)}</div>
            </div>
          </div>
        </>
      )}
    </GlassCard>
  );
}
