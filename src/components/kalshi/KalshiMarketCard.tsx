import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Clock, DollarSign, Zap, Share2 } from 'lucide-react';
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
      transition={{ delay: index * 0.03, duration: 0.3 }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      className={cn(
        'group cursor-pointer relative',
        'rounded-2xl p-5',
        'bg-card/80 backdrop-blur-sm',
        'border border-border/50',
        'transition-all duration-300 ease-out',
        'hover:border-primary/40 hover:bg-card',
        'hover:shadow-2xl hover:shadow-primary/5',
        'hover:-translate-y-1 active:translate-y-0 active:scale-[0.99]'
      )}
    >
      {/* Glow effect on hover */}
      <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-emerald-500/0 via-primary/0 to-purple-500/0 opacity-0 group-hover:opacity-100 group-hover:from-emerald-500/10 group-hover:via-primary/10 group-hover:to-purple-500/10 transition-opacity duration-500 blur-xl" />
      
      <div className="relative">
        {/* Header row - Live indicator + Share */}
        <div className="flex items-center justify-between mb-4">
          {market.status === 'active' || !market.status ? (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Live</span>
            </div>
          ) : (
            <span className="text-xs font-medium text-muted-foreground capitalize">{market.status}</span>
          )}
          <KalshiShareButton market={market} compact />
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-semibold text-foreground mb-4 line-clamp-2 leading-snug group-hover:text-foreground transition-colors min-h-[2.5rem]">
          {displayTitle}
        </h3>
        
        {/* Premium Price Display - Side by side boxes */}
        <div className="flex items-stretch gap-2 mb-4">
          {/* YES Price */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className={cn(
              'flex-1 p-3 rounded-xl transition-all duration-200',
              'border',
              yesLeading 
                ? 'bg-emerald-500/15 border-emerald-500/40' 
                : 'bg-muted/40 border-transparent hover:border-border/50'
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className={cn(
                'w-3.5 h-3.5',
                yesLeading ? 'text-emerald-400' : 'text-muted-foreground'
              )} />
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-wider',
                yesLeading ? 'text-emerald-400' : 'text-muted-foreground'
              )}>
                Yes
              </span>
            </div>
            <p className={cn(
              'text-2xl font-bold tracking-tight',
              yesLeading ? 'text-emerald-400' : 'text-foreground/70'
            )}>
              {market.yesPrice}<span className="text-sm font-semibold">¢</span>
            </p>
          </motion.div>

          {/* NO Price */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className={cn(
              'flex-1 p-3 rounded-xl transition-all duration-200',
              'border',
              !yesLeading 
                ? 'bg-red-500/15 border-red-500/40' 
                : 'bg-muted/40 border-transparent hover:border-border/50'
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className={cn(
                'w-3.5 h-3.5',
                !yesLeading ? 'text-red-400' : 'text-muted-foreground'
              )} />
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-wider',
                !yesLeading ? 'text-red-400' : 'text-muted-foreground'
              )}>
                No
              </span>
            </div>
            <p className={cn(
              'text-2xl font-bold tracking-tight',
              !yesLeading ? 'text-red-400' : 'text-foreground/70'
            )}>
              {market.noPrice}<span className="text-sm font-semibold">¢</span>
            </p>
          </motion.div>
        </div>
        
        {/* Stats row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 px-0.5">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-primary/70" />
            <span className="font-medium">{formatVolume(market.volume)}</span>
          </div>
          {market.closeTime && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date(market.closeTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
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
