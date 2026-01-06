import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Clock, Zap } from 'lucide-react';
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

function KalshiMarketCardComponent({ market, eventTitle, onClick, onAIAnalysis, onPrefetch, index = 0 }: KalshiMarketCardProps) {
  const yesLeading = market.yesPrice > market.noPrice;
  const displayTitle = market.title || eventTitle || 'Market';
  
  const handleAIClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAIAnalysis?.();
  };
  
  const handleMouseEnter = useCallback(() => {
    onPrefetch?.(market.ticker);
  }, [market.ticker, onPrefetch]);

  const formatVolume = (vol?: number) => {
    if (!vol) return '$0';
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${Math.round(vol / 1000)}K`;
    return `$${vol}`;
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.3 }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      className={cn(
        'group cursor-pointer relative',
        'rounded-2xl p-5',
        'bg-card/60 backdrop-blur-sm',
        'border border-border/40',
        'transition-all duration-300 ease-out',
        'hover:border-primary/30 hover:bg-card/80',
        'hover:shadow-lg hover:shadow-primary/5',
        'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995]'
      )}
    >
      <div className="relative">
        {/* Header row - Live indicator + Share */}
        <div className="flex items-center justify-between mb-3">
          {market.status === 'active' || !market.status ? (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-mono font-medium text-emerald-500 uppercase tracking-wider">Live</span>
            </div>
          ) : (
            <span className="text-[10px] font-mono font-medium text-muted-foreground capitalize tracking-wider">{market.status}</span>
          )}
          <div className="flex items-center gap-1.5">
            <KalshiShareButton market={market} compact />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-foreground mb-4 line-clamp-2 leading-snug group-hover:text-foreground transition-colors min-h-[2.25rem]">
          {displayTitle}
        </h3>
        
        {/* Price Display - Side by side boxes */}
        <div className="flex items-stretch gap-2 mb-3">
          {/* YES Price */}
          <div 
            className={cn(
              'flex-1 p-2.5 rounded-xl transition-all duration-200',
              'border',
              yesLeading 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : 'bg-muted/30 border-border/30'
            )}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className={cn(
                'w-3 h-3',
                yesLeading ? 'text-emerald-500' : 'text-muted-foreground'
              )} />
              <span className={cn(
                'text-[9px] font-mono font-semibold uppercase tracking-wider',
                yesLeading ? 'text-emerald-500' : 'text-muted-foreground'
              )}>
                Yes
              </span>
            </div>
            <p className={cn(
              'text-xl font-bold tracking-tight font-mono',
              yesLeading ? 'text-emerald-500' : 'text-foreground/60'
            )}>
              {market.yesPrice}<span className="text-xs font-medium">¢</span>
            </p>
          </div>

          {/* NO Price */}
          <div 
            className={cn(
              'flex-1 p-2.5 rounded-xl transition-all duration-200',
              'border',
              !yesLeading 
                ? 'bg-red-500/10 border-red-500/30' 
                : 'bg-muted/30 border-border/30'
            )}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingDown className={cn(
                'w-3 h-3',
                !yesLeading ? 'text-red-500' : 'text-muted-foreground'
              )} />
              <span className={cn(
                'text-[9px] font-mono font-semibold uppercase tracking-wider',
                !yesLeading ? 'text-red-500' : 'text-muted-foreground'
              )}>
                No
              </span>
            </div>
            <p className={cn(
              'text-xl font-bold tracking-tight font-mono',
              !yesLeading ? 'text-red-500' : 'text-foreground/60'
            )}>
              {market.noPrice}<span className="text-xs font-medium">¢</span>
            </p>
          </div>
        </div>
        
        {/* Stats row */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-3 px-0.5">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary/60" />
            <span className="font-mono">{formatVolume(market.volume)}</span>
          </div>
          {market.closeTime && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span className="font-mono">{new Date(market.closeTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
        </div>
        
        {/* AI Analysis Button */}
        {onAIAnalysis && (
          <KalshiAIButton onClick={handleAIClick} />
        )}
      </div>
    </motion.div>
  );
}

export const KalshiMarketCard = memo(KalshiMarketCardComponent);