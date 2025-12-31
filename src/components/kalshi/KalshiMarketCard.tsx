import { motion } from 'framer-motion';
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
  index?: number;
}

export function KalshiMarketCard({ market, eventTitle, onClick, onAIAnalysis, index = 0 }: KalshiMarketCardProps) {
  const yesLeading = market.yesPrice > market.noPrice;
  const displayTitle = market.title || eventTitle || 'Market';
  
  const handleAIClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAIAnalysis?.();
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-3xl p-6',
        'bg-card/50 backdrop-blur-xl',
        'border border-border/50 hover:border-primary/30',
        'transition-all duration-300',
        'hover:shadow-[0_8px_40px_hsl(var(--primary)/0.15)]',
        'hover:-translate-y-1'
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
          'p-4 rounded-2xl border transition-all',
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
          'p-4 rounded-2xl border transition-all',
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
      
      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {onAIAnalysis && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAIClick}
            className="flex-1 rounded-xl border-border/50 hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            AI Analysis
          </Button>
        )}
        <KalshiShareButton market={market} compact />
      </div>
    </motion.div>
  );
}
