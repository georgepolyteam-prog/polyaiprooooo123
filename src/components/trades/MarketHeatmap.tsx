import { useState } from 'react';
import { ChevronDown, ChevronUp, Flame, Activity } from 'lucide-react';

interface MarketVolume {
  slug: string;
  title: string;
  image?: string;
  volume: number;
  trades: number;
}

interface MarketHeatmapProps {
  markets: MarketVolume[];
  onMarketClick?: (slug: string) => void;
  selectedMarket?: string;
}

function formatVolume(vol: number): string {
  if (vol >= 1000000) return `$${(vol / 1000000).toFixed(2)}M`;
  if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}k`;
  return `$${vol.toFixed(0)}`;
}

export function MarketHeatmap({ markets, onMarketClick, selectedMarket }: MarketHeatmapProps) {
  const [expanded, setExpanded] = useState(true);

  if (markets.length === 0) return null;

  const maxVolume = Math.max(...markets.map(m => m.volume));

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-destructive" />
          <span className="font-semibold text-sm">Hot Markets</span>
          <span className="text-xs text-muted-foreground">({markets.length})</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="border-t border-border grid grid-cols-2 gap-2 p-3 max-h-[400px] overflow-y-auto">
          {markets.map((market) => {
            const intensity = market.volume / maxVolume;
            const isSelected = selectedMarket === market.slug;
            
            return (
              <div
                key={market.slug}
                onClick={() => onMarketClick?.(isSelected ? 'all' : market.slug)}
                className={`relative rounded-lg p-3 cursor-pointer transition-all hover:scale-[1.02] overflow-hidden ${
                  isSelected ? 'ring-2 ring-primary' : ''
                }`}
                style={{
                  backgroundColor: `hsl(var(--primary) / ${0.1 + intensity * 0.3})`
                }}
              >
                <div className="flex items-start gap-2">
                  {market.image ? (
                    <img 
                      src={market.image} 
                      alt="" 
                      className="w-8 h-8 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground truncate">
                      {market.title || market.slug.replace(/-/g, ' ')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {market.trades} trades
                    </div>
                  </div>
                </div>
                <div className="mt-2 font-bold text-sm text-primary">
                  {formatVolume(market.volume)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
