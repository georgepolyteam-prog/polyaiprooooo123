import { BarChart3, DollarSign, Target, TrendingUp, Layers, Lock, ArrowRight } from "lucide-react";
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
    <div className="mb-8 sm:mb-12 animate-fade-in" style={{ animationDelay: '400ms' }}>
      <div className="flex items-center justify-center gap-2 mb-4 sm:mb-8">
        <div className="h-px flex-1 max-w-12 sm:max-w-20 bg-gradient-to-r from-transparent to-border" />
        <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Trending Markets</p>
        <div className="h-px flex-1 max-w-12 sm:max-w-20 bg-gradient-to-l from-transparent to-border" />
      </div>
      
      {loadingMarkets ? (
        <div className="flex gap-3 sm:gap-5 overflow-x-auto pb-4 px-1 -mx-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible scrollbar-hide snap-x snap-mandatory">
          {[...Array(4)].map((_, i) => (
            <div 
              key={i} 
              className="rounded-xl sm:rounded-2xl overflow-hidden glass-card flex-shrink-0 w-[260px] sm:w-auto snap-start first:ml-4 sm:first:ml-0"
            >
              <Skeleton className="h-24 sm:h-32 w-full bg-muted/30" />
              <div className="p-3 sm:p-5 space-y-2 sm:space-y-3">
                <Skeleton className="h-4 sm:h-5 w-3/4 bg-muted/30" />
                <Skeleton className="h-3 sm:h-4 w-1/2 bg-muted/30" />
                <div className="flex justify-between items-center pt-1 sm:pt-2">
                  <Skeleton className="h-5 sm:h-6 w-14 sm:w-16 bg-muted/30" />
                  <Skeleton className="h-3 sm:h-4 w-12 sm:w-14 bg-muted/30" />
                </div>
                <Skeleton className="h-8 sm:h-10 w-full rounded-lg sm:rounded-xl bg-muted/30" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 sm:gap-5 overflow-x-auto pb-4 px-1 -mx-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible scrollbar-hide snap-x snap-mandatory">
          {markets.map((market, i) => (
            <button
              key={i}
              onClick={() => onMarketClick(market.url)}
              className="group relative rounded-xl sm:rounded-2xl overflow-hidden text-left transition-all duration-500 glass-card-hover flex-shrink-0 w-[260px] sm:w-auto snap-start first:ml-4 sm:first:ml-0 active:scale-[0.98]"
            >
              {/* Animated gradient border */}
              <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Inner content */}
              <div className="relative bg-card/80 rounded-xl sm:rounded-2xl overflow-hidden">
                {/* Market Image */}
                {market.image && !failedImages.has(i) ? (
                  <div className="h-24 sm:h-32 w-full overflow-hidden relative">
                    <img 
                      key={market.image}
                      src={market.image} 
                      alt={market.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      onError={() => onImageError(i)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                    
                    {/* Live indicator */}
                    <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-success/20 border border-success/30 backdrop-blur-sm">
                      <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-success rounded-full animate-pulse" />
                      <span className="text-[8px] sm:text-[10px] font-medium text-success">LIVE</span>
                    </div>
                  </div>
                ) : (
                  <div className={`h-24 sm:h-32 w-full bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center`}>
                    <div className="text-muted-foreground/50 group-hover:text-primary/50 transition-colors">
                      {market.icon}
                    </div>
                  </div>
                )}
                
                <div className="p-3 sm:p-5">
                  <h3 className="font-bold text-foreground mb-0.5 sm:mb-1 text-sm sm:text-base line-clamp-1 group-hover:text-primary transition-colors">
                    {market.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-1">{market.subtitle}</p>
                  
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    {market.isMultiMarket ? (
                      <>
                        <span className="text-primary font-semibold flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
                          <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          {market.marketCount} outcomes
                        </span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium bg-muted/50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                          {market.volume}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl sm:text-2xl font-bold text-primary">
                          {market.odds}
                        </span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium bg-muted/50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                          {market.volume}
                        </span>
                      </>
                    )}
                  </div>
                  
                  {/* CTA Button */}
                  <div className={`w-full py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-center text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 ${
                    isAuthenticated 
                      ? 'bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg shadow-primary/25 group-hover:shadow-primary/40 group-hover:scale-[1.02]' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {!isAuthenticated && <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    <span>Analyze</span>
                    {isAuthenticated && <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
