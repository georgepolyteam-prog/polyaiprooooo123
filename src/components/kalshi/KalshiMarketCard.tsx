import { memo, useCallback } from 'react';
import { TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KalshiShareButton } from './KalshiShareButton';
import { KalshiAIButton } from './KalshiAIButton';
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
        'group cursor-pointer rounded-[28px] p-5',
        'bg-card/60 backdrop-blur-sm',
        'border border-border/40',
        'transition-all duration-300 ease-out',
        'hover:border-border/60 hover:bg-card/80',
        'hover:shadow-2xl hover:shadow-black/10',
        'hover:-translate-y-1'
      )}
    >
      {/* Header with status */}
      <div className="flex items-start justify-between mb-4">
        {market.status && (
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full",
            market.status === 'active' 
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-muted/50 text-muted-foreground'
          )}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              market.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'
            )} />
            {market.status === 'active' ? 'Live' : market.status.charAt(0).toUpperCase() + market.status.slice(1)}
          </span>
        )}
        <KalshiShareButton market={market} compact />
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-foreground mb-1.5 line-clamp-2 leading-snug group-hover:text-foreground/90 transition-colors min-h-[2.75rem]">
        {displayTitle}
      </h3>
      
      {/* Subtitle */}
      {market.subtitle && (
        <p className="text-xs text-muted-foreground mb-4 line-clamp-1">
          {market.subtitle}
        </p>
      )}
      
      {/* Premium Price Display - Large centered prices */}
      <div className="flex items-stretch gap-2 mb-4">
        <div className={cn(
          'flex-1 p-3 rounded-2xl transition-all duration-200',
          'border',
          yesLeading 
            ? 'bg-emerald-500/10 border-emerald-500/25' 
            : 'bg-muted/30 border-transparent'
        )}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <TrendingUp className={cn(
                'w-3.5 h-3.5',
                yesLeading ? 'text-emerald-400' : 'text-muted-foreground'
              )} />
              <span className={cn(
                'text-[10px] font-semibold uppercase tracking-wider',
                yesLeading ? 'text-emerald-400' : 'text-muted-foreground'
              )}>
                Yes
              </span>
            </div>
          </div>
          <p className={cn(
            'text-2xl font-bold tracking-tight',
            yesLeading ? 'text-emerald-400' : 'text-foreground/80'
          )}>
            {market.yesPrice}<span className="text-base">¢</span>
          </p>
        </div>

        <div className={cn(
          'flex-1 p-3 rounded-2xl transition-all duration-200',
          'border',
          !yesLeading 
            ? 'bg-red-500/10 border-red-500/25' 
            : 'bg-muted/30 border-transparent'
        )}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <TrendingDown className={cn(
                'w-3.5 h-3.5',
                !yesLeading ? 'text-red-400' : 'text-muted-foreground'
              )} />
              <span className={cn(
                'text-[10px] font-semibold uppercase tracking-wider',
                !yesLeading ? 'text-red-400' : 'text-muted-foreground'
              )}>
                No
              </span>
            </div>
          </div>
          <p className={cn(
            'text-2xl font-bold tracking-tight',
            !yesLeading ? 'text-red-400' : 'text-foreground/80'
          )}>
            {market.noPrice}<span className="text-base">¢</span>
          </p>
        </div>
      </div>
      
      {/* Stats row - cleaner */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 px-0.5">
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5" />
          <span className="font-medium">{((market.volume || 0) / 1000).toFixed(0)}k vol</span>
        </div>
        {market.closeTime && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{new Date(market.closeTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
        )}
      </div>
      
      {/* Premium AI Button */}
      {onAIAnalysis && (
        <KalshiAIButton onClick={handleAIClick} />
      )}
    </div>
  );
}

export const KalshiMarketCard = memo(KalshiMarketCardComponent);
