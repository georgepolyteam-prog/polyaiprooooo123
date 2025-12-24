import { Layers, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ExampleMarket {
  title: string;
  subtitle: string;
  odds: string;
  volume: string;
  url: string;
  gradient: string;
  glowColor: string;
  oddsColor: string;
  icon: React.ReactNode;
  image?: string;
  isMultiMarket?: boolean;
  marketCount?: number;
}

interface PremiumMarketCardsProps {
  markets: ExampleMarket[];
  loadingMarkets: boolean;
  failedImages: Set<number>;
  isAuthenticated: boolean;
  onMarketClick: (url: string) => void;
  onImageError: (index: number) => void;
}

export const PremiumMarketCards = ({
  markets,
  loadingMarkets,
  failedImages,
  isAuthenticated,
  onMarketClick,
  onImageError,
}: PremiumMarketCardsProps) => {
  return (
    <div className="mb-8 sm:mb-10 animate-fade-in" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Trending Markets</h2>
        <span className="text-xs text-muted-foreground">Live data</span>
      </div>
      
      {loadingMarkets ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <Skeleton className="h-12 w-12 rounded-lg mb-3" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2 mb-4" />
              <div className="flex gap-2">
                <Skeleton className="h-8 flex-1 rounded-lg" />
                <Skeleton className="h-8 flex-1 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {markets.map((market, i) => (
            <button
              key={i}
              onClick={() => onMarketClick(market.url)}
              disabled={!isAuthenticated}
              className="group bg-card border border-border rounded-xl p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {/* Market Image or Icon */}
              <div className="flex items-start gap-3 mb-3">
                {market.image && !failedImages.has(i) ? (
                  <img 
                    src={market.image} 
                    alt={market.title}
                    className="w-12 h-12 rounded-lg object-cover"
                    onError={() => onImageError(i)}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                    {market.icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {market.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">{market.subtitle}</p>
                </div>
              </div>
              
              {/* Volume Badge */}
              <div className="flex items-center justify-between mb-3">
                {market.isMultiMarket ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {market.marketCount} outcomes
                  </span>
                ) : (
                  <span className="text-lg font-bold text-foreground">{market.odds}</span>
                )}
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {market.volume}
                </span>
              </div>
              
              {/* Yes/No Buttons - Polymarket style */}
              {isAuthenticated ? (
                <div className="flex gap-2">
                  <div className="flex-1 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                    Yes
                  </div>
                  <div className="flex-1 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center text-xs font-semibold text-rose-600 dark:text-rose-400 group-hover:bg-rose-500/20 transition-colors">
                    No
                  </div>
                </div>
              ) : (
                <div className="py-2 rounded-lg bg-muted text-center text-xs font-medium text-muted-foreground flex items-center justify-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  Connect to analyze
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
