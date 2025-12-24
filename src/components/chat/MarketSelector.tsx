import { ExternalLink, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Market {
  id: number;
  market_slug: string;
  question: string;
  yes_price: number;
  volume: number;
  hot?: boolean;
}

interface MarketSelectorProps {
  eventTitle: string;
  eventUrl?: string;
  markets: Market[];
  onSelect: (marketId: number) => void;
}

const formatVolume = (vol: number): string => {
  if (vol >= 1000000) {
    return `${(vol / 1000000).toFixed(1)}M`.replace('.0M', 'M');
  } else if (vol >= 1000) {
    return `${(vol / 1000).toFixed(1)}K`.replace('.0K', 'K');
  }
  return vol.toString();
};

export function MarketSelector({ 
  eventTitle, 
  eventUrl,
  markets, 
  onSelect 
}: MarketSelectorProps) {
  const sortedMarkets = [...markets]
    .sort((a, b) => b.volume - a.volume)
    .map((m, idx) => ({
      ...m,
      hot: m.volume >= 100000 || idx < 3
    }));

  return (
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-soft">
        <p className="text-sm text-muted-foreground mb-1">
          Multiple markets found
        </p>
        <h3 className="font-semibold text-foreground">
          {eventTitle}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {markets.length} markets available. Select one to analyze:
        </p>
      </div>
      
      {/* Market Cards */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {sortedMarkets.map((market) => (
          <button
            key={market.id}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(market.id);
            }}
            className="w-full text-left p-4 rounded-xl bg-card border border-border 
                       hover:border-secondary hover:bg-secondary/10 hover:shadow-medium
                       transition-all group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-secondary transition-colors">
                  {market.question}
                </p>
                
                {/* Stats */}
                <div className="flex items-center gap-3 mt-2 text-sm">
                  <span className="font-semibold text-success">
                    {(market.yes_price * 100).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">
                    ${formatVolume(market.volume)}
                  </span>
                </div>
              </div>
              
              {/* Hot badge */}
              {market.hot && market.volume >= 100000 && (
                <span className="px-2 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Hot
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      
      
      {eventUrl && (
        <a 
          href={eventUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground 
                     hover:text-primary transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          View on Polymarket
        </a>
      )}
    </div>
  );
}
