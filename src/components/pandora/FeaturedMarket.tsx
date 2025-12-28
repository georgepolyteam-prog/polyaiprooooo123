import { motion } from 'framer-motion';
import { TrendingUp, Users, Clock, Sparkles, ArrowRight } from 'lucide-react';
import { PandoraMarket, formatVolume, formatTimeRemaining } from '@/lib/pandora-api';
import { cn } from '@/lib/utils';

interface FeaturedMarketProps {
  market: PandoraMarket;
  onAnalyze: (market: PandoraMarket) => void;
}

export function FeaturedMarket({ market, onAnalyze }: FeaturedMarketProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="max-w-6xl mx-auto px-4 sm:px-6 mb-16"
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-muted/30 border border-border/50 shadow-large">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
        
        {/* Content */}
        <div className="relative p-6 sm:p-8 md:p-12">
          {/* Header badges */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Featured Market</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-sm font-medium text-success">Active</span>
            </div>
          </div>
          
          {/* Question */}
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-8 max-w-3xl leading-tight">
            {market.question}
          </h2>
          
          {/* Odds visualization */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* YES side */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-success/5 border border-success/10">
              <div className="text-5xl sm:text-6xl font-bold text-success tabular-nums mb-2">
                {market.currentOddsYes}%
              </div>
              <div className="text-lg font-semibold text-success/80">YES</div>
            </div>
            
            {/* Progress bar (center on desktop) */}
            <div className="hidden md:flex flex-col items-center justify-center">
              <div className="w-full h-4 rounded-full bg-muted overflow-hidden mb-4">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-success to-success/80 transition-all duration-500"
                  style={{ width: `${market.currentOddsYes}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground">Market Probability</span>
            </div>
            
            {/* NO side */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-destructive/5 border border-destructive/10">
              <div className="text-5xl sm:text-6xl font-bold text-destructive tabular-nums mb-2">
                {market.currentOddsNo}%
              </div>
              <div className="text-lg font-semibold text-destructive/80">NO</div>
            </div>
          </div>
          
          {/* Mobile progress bar */}
          <div className="md:hidden mb-8">
            <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-success to-success/80"
                style={{ width: `${market.currentOddsYes}%` }}
              />
            </div>
          </div>
          
          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 mb-8 text-center">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {formatVolume(market.totalVolume)}
                </div>
                <div className="text-sm text-muted-foreground">Volume</div>
              </div>
            </div>
            <div className="w-px h-10 bg-border hidden sm:block" />
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {market.totalTrades.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Traders</div>
              </div>
            </div>
            <div className="w-px h-10 bg-border hidden sm:block" />
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {formatTimeRemaining(market.endDate)}
                </div>
                <div className="text-sm text-muted-foreground">Remaining</div>
              </div>
            </div>
          </div>
          
          {/* CTA */}
          <div className="flex justify-center">
            <button
              onClick={() => onAnalyze(market)}
              className={cn(
                "group inline-flex items-center gap-2 px-8 py-4 rounded-full",
                "bg-foreground text-background font-semibold text-lg",
                "shadow-lg hover:shadow-xl transition-all duration-300",
                "hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              Analyze with AI
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
