import { memo, useCallback } from 'react';
import { TrendingUp, TrendingDown, Clock, Users, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { KalshiShareButton } from './KalshiShareButton';
import type { KalshiMarket } from '@/hooks/useDflowApi';

interface KalshiMarketCardProps {
  market: KalshiMarket;
  eventTitle?: string;
  onClick: () => void;
  onAIAnalysis?: () => void;
  onPrefetch?: (ticker: string) => void;
  index?: number;
}

function KalshiMarketCardComponent({ market, eventTitle, onClick, onAIAnalysis, onPrefetch }: KalshiMarketCardProps) {
  const yesLeading = market.yesPrice > market.noPrice;
  const displayTitle = market.title || eventTitle || 'Market';
  
  const handleAIClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAIAnalysis?.();
  };
  
  // Prefetch trades data on hover for faster modal open
  const handleMouseEnter = useCallback(() => {
    onPrefetch?.(market.ticker);
  }, [market.ticker, onPrefetch]);
  
  return (
    <div
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      className={cn(
        'group cursor-pointer rounded-3xl p-6',
        'bg-card/80 border border-border/50',
        'hover:border-primary/30 transition-colors duration-200',
        'hover:shadow-lg hover:-translate-y-0.5'
      )}
    >
      {/* Status Badge */}
      {market.status && (
        <span className={cn(
          "inline-block px-3 py-1 mb-4 text-xs font-medium rounded-full border",
          market.status === 'active' 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-muted/50 text-muted-foreground border-border/50'
        )}>
          {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
        </span>
      )}

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
        {displayTitle}
      </h3>
      
      {/* Subtitle if available */}
      {market.subtitle && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-1">
          {market.subtitle}
        </p>
      )}
      
      {/* Price Display */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className={cn(
          'p-4 rounded-2xl border transition-colors',
          yesLeading 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-muted/50 border-border/50'
        )}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className={cn(
              'w-4 h-4',
              yesLeading ? 'text-emerald-400' : 'text-muted-foreground'
            )} />
            <span className={cn(
              'text-xs font-medium uppercase tracking-wide',
              yesLeading ? 'text-emerald-400' : 'text-muted-foreground'
            )}>
              Yes
            </span>
          </div>
          <p className={cn(
            'text-2xl font-bold',
            yesLeading ? 'text-emerald-400' : 'text-foreground'
          )}>
            {market.yesPrice}¢
          </p>
        </div>

        <div className={cn(
          'p-4 rounded-2xl border transition-colors',
          !yesLeading 
            ? 'bg-red-500/10 border-red-500/30' 
            : 'bg-muted/50 border-border/50'
        )}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className={cn(
              'w-4 h-4',
              !yesLeading ? 'text-red-400' : 'text-muted-foreground'
            )} />
            <span className={cn(
              'text-xs font-medium uppercase tracking-wide',
              !yesLeading ? 'text-red-400' : 'text-muted-foreground'
            )}>
              No
            </span>
          </div>
          <p className={cn(
            'text-2xl font-bold',
            !yesLeading ? 'text-red-400' : 'text-foreground'
          )}>
            {market.noPrice}¢
          </p>
        </div>
      </div>
      
      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          <span>${(market.volume || 0).toLocaleString()}</span>
        </div>
        {market.closeTime && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{new Date(market.closeTime).toLocaleDateString()}</span>
          </div>
        )}
      </div>
      
      {/* Action Buttons - Apple/Kalshi style */}
      <div className="flex items-center gap-2">
        {onAIAnalysis && (
          <button
            onClick={handleAIClick}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 h-10 px-4",
              "rounded-full text-sm font-medium",
              "bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10",
              "border border-primary/20 hover:border-primary/40",
              "text-primary",
              "transition-all duration-300",
              "hover:shadow-lg hover:shadow-primary/20",
              "hover:scale-[1.02] active:scale-[0.98]"
            )}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI</span>
          </button>
        )}
        <KalshiShareButton market={market} compact />
      </div>
    </div>
  );
}

export const KalshiMarketCard = memo(KalshiMarketCardComponent);
