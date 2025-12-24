import { useState } from 'react';
import { GlassCard } from './GlassCard';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Filter, Fish, Zap, ArrowUpCircle, ArrowDownCircle, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Trade {
  id: string;
  side: string;
  outcome?: string;
  size: number;
  price: number;
  timeAgo: string;
  wallet: string;
  isNew?: boolean;
  isWhale?: boolean;
}

interface TradeFeedProps {
  trades: Trade[];
  buyPressure: number;
}

export function TradeFeed({ trades, buyPressure }: TradeFeedProps) {
  const [filter, setFilter] = useState<'all' | 'whales' | 'buy' | 'sell'>('all');
  const [expanded, setExpanded] = useState(false);

  const formatUsd = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  const formatWallet = (wallet: string) => {
    if (!wallet || wallet.length < 10) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const filteredTrades = trades.filter(trade => {
    if (filter === 'whales') return trade.isWhale;
    if (filter === 'buy') return trade.side === 'BUY';
    if (filter === 'sell') return trade.side === 'SELL';
    return true;
  });

  const displayTrades = expanded ? filteredTrades : filteredTrades.slice(0, 8);

  return (
    <GlassCard className="p-6" cyber>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-accent/10">
            <Radio className="w-4 h-4 text-accent" />
          </div>
          <h3 className="font-semibold">Live Trade Feed</h3>
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground hidden md:block" />
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'whales', 'buy', 'sell'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1",
                  filter === f 
                    ? "bg-primary/20 text-primary border border-primary/30" 
                    : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {f === 'whales' ? (
                  <>
                    <Fish className="w-3 h-3" />
                    Whales
                  </>
                ) : (
                  f.charAt(0).toUpperCase() + f.slice(1)
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trade List */}
      <div className="space-y-1.5 mb-4">
        {displayTrades.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No trades match the filter
          </div>
        ) : (
          displayTrades.map((trade, index) => (
            <div 
              key={trade.id}
              className={cn(
                "flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-300",
                trade.isNew && "bg-accent/10 border border-accent/20",
                trade.isWhale && !trade.isNew && "bg-warning/5 border border-warning/20",
                !trade.isNew && !trade.isWhale && "hover:bg-muted/20"
              )}
              style={{ 
                animationDelay: `${index * 50}ms`,
                animation: trade.isNew ? 'fade-in 0.3s ease-out' : undefined
              }}
            >
              <div className="flex items-center gap-3">
                {trade.isNew && (
                  <span className="text-[10px] text-accent font-bold flex items-center gap-0.5 bg-accent/10 px-1.5 py-0.5 rounded">
                    <Zap className="w-3 h-3" />
                    NEW
                  </span>
                )}
                {(() => {
                  // Determine effective position: BUY YES = YES, SELL YES = NO, BUY NO = NO, SELL NO = YES
                  const effectivePosition = 
                    (trade.side === 'BUY' && trade.outcome === 'YES') || (trade.side === 'SELL' && trade.outcome === 'NO') 
                      ? 'YES' 
                      : (trade.side === 'SELL' && trade.outcome === 'YES') || (trade.side === 'BUY' && trade.outcome === 'NO')
                        ? 'NO'
                        : trade.side; // Fallback to BUY/SELL if outcome unknown
                  const isYes = effectivePosition === 'YES';
                  return (
                    <div className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold",
                      isYes ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                    )}>
                      {isYes ? (
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownCircle className="w-3.5 h-3.5" />
                      )}
                      {effectivePosition}
                    </div>
                  );
                })()}
                <span className="font-mono font-bold">{formatUsd(trade.size)}</span>
                <span className="text-muted-foreground">@</span>
                <span className="font-mono text-foreground">{trade.price.toFixed(1)}%</span>
                {trade.isWhale && (
                  <div className="flex items-center gap-1 text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                    <Fish className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-mono text-xs bg-muted/30 px-2 py-0.5 rounded">{formatWallet(trade.wallet)}</span>
                <span className="text-xs">{trade.timeAgo}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Expand/Collapse */}
      {filteredTrades.length > 8 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full hover:bg-muted/20"
        >
          {expanded ? (
            <>Show Less <ChevronUp className="w-4 h-4 ml-1" /></>
          ) : (
            <>Show {filteredTrades.length - 8} More <ChevronDown className="w-4 h-4 ml-1" /></>
          )}
        </Button>
      )}

      {/* Buy/Sell Pressure Bar */}
      <div className="mt-4 pt-4 border-t border-border/30">
        <div className="flex items-center justify-between text-sm mb-2">
          <div className="flex items-center gap-1.5">
            <ArrowUpCircle className="w-4 h-4 text-success" />
            <span className="text-success font-medium">Buy: {buyPressure.toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-destructive font-medium">Sell: {(100 - buyPressure).toFixed(0)}%</span>
            <ArrowDownCircle className="w-4 h-4 text-destructive" />
          </div>
        </div>
        <div className="h-3 rounded-full overflow-hidden bg-destructive/20 flex relative">
          <div 
            className="h-full transition-all duration-500 relative"
            style={{ 
              width: `${buyPressure}%`,
              background: 'linear-gradient(90deg, hsl(var(--success)), hsl(var(--success) / 0.7))'
            }}
          >
            <div className="absolute inset-0 shimmer" />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
