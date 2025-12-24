import { useState } from 'react';
import { ChevronDown, ChevronUp, Flame, Activity, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  onAnalyze?: (market: MarketVolume) => void;
  selectedMarket?: string;
}

function formatVolume(vol: number): string {
  if (vol >= 1000000) return `$${(vol / 1000000).toFixed(2)}M`;
  if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}k`;
  return `$${vol.toFixed(0)}`;
}

export function MarketHeatmap({ markets, onMarketClick, onAnalyze, selectedMarket }: MarketHeatmapProps) {
  const [expanded, setExpanded] = useState(true);

  if (markets.length === 0) return null;

  const maxVolume = Math.max(...markets.map(m => m.volume));

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors min-h-[52px] touch-manipulation"
      >
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-destructive" />
          <span className="font-semibold text-sm">Hot Markets</span>
          <span className="text-xs text-muted-foreground">({markets.length})</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 max-h-[400px] overflow-y-auto">
          {markets.map((market) => {
            const intensity = market.volume / maxVolume;
            const isSelected = selectedMarket === market.slug;
            
            return (
              <div
                key={market.slug}
                className={`relative rounded-lg p-3 transition-all overflow-hidden ${
                  isSelected ? 'ring-2 ring-primary' : ''
                }`}
                style={{
                  backgroundColor: `hsl(var(--primary) / ${0.1 + intensity * 0.3})`
                }}
              >
                {/* Market Info - Clickable to filter */}
                <div 
                  onClick={() => onMarketClick?.(isSelected ? 'all' : market.slug)}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
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

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 mt-2">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnalyze?.(market);
                    }}
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1 bg-muted/50 hover:bg-muted min-h-[36px]"
                  >
                    <Sparkles className="w-3 h-3 text-primary" />
                    Analyze
                  </Button>
                  <a
                    href={`https://polymarket.com/event/${market.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 flex items-center justify-center gap-1 h-8 rounded-md text-xs font-medium bg-primary/90 hover:bg-primary text-primary-foreground min-h-[36px] transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Trade
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}