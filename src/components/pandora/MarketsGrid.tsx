import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { PandoraMarket, formatVolume, formatTimeRemaining } from '@/lib/pandora-api';
import { cn } from '@/lib/utils';

interface MarketsGridProps {
  markets: PandoraMarket[];
  onMarketClick: (market: PandoraMarket) => void;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export function MarketsGrid({ markets, onMarketClick }: MarketsGridProps) {
  const [displayCount, setDisplayCount] = useState(12);
  const visibleMarkets = markets.slice(0, displayCount);
  const hasMore = displayCount < markets.length;
  const navigate = useNavigate();

  const handleAnalyze = (e: React.MouseEvent, market: PandoraMarket) => {
    e.stopPropagation();
    navigate('/chat', {
      state: {
        autoAnalyze: true,
        marketContext: {
          eventTitle: market.question,
          outcomeQuestion: market.question,
          currentOdds: market.currentOddsYes / 100,
          volume: parseFloat(market.totalVolume),
          url: `https://pandora.sonic.game/market/${market.marketAddress}`,
          slug: market.id,
          eventSlug: market.id,
        }
      }
    });
  };

  if (!markets.length) {
    return (
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-16">
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No markets found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-16">
      {/* Header */}
      <h2 className="text-2xl font-bold text-foreground mb-6">All Markets</h2>
      
      {/* Grid */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {visibleMarkets.map((market) => (
          <motion.div
            key={market.id}
            variants={item}
            onClick={() => onMarketClick(market)}
            className={cn(
              "group p-5 rounded-2xl cursor-pointer",
              "bg-card border border-border/50",
              "hover:border-primary/30 hover:shadow-lg hover:-translate-y-1",
              "transition-all duration-300"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {market.category}
              </span>
              <span className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium",
                market.status === 'active' 
                  ? "bg-success/10 text-success" 
                  : "bg-muted text-muted-foreground"
              )}>
                {market.status === 'active' ? 'Active' : market.status}
              </span>
            </div>
            
            {/* Question */}
            <h3 className="text-base font-semibold text-foreground mb-4 line-clamp-2 min-h-[48px] group-hover:text-primary transition-colors">
              {market.question}
            </h3>
            
            {/* Odds */}
            <div className="mb-4">
              <div className="flex gap-3 mb-3">
                <div className="flex-1 text-center p-3 rounded-xl bg-success/5 border border-success/10">
                  <div className="text-2xl font-bold text-success tabular-nums">
                    {market.currentOddsYes}%
                  </div>
                  <div className="text-xs font-medium text-success/70">YES</div>
                </div>
                <div className="flex-1 text-center p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                  <div className="text-2xl font-bold text-destructive tabular-nums">
                    {market.currentOddsNo}%
                  </div>
                  <div className="text-xs font-medium text-destructive/70">NO</div>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-success to-success/80 transition-all duration-500"
                  style={{ width: `${market.currentOddsYes}%` }}
                />
              </div>
            </div>
            
            {/* Footer stats */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <span className="font-medium text-foreground tabular-nums">
                {formatVolume(market.totalVolume)}
              </span>
              <span className="text-border">•</span>
              <span className="tabular-nums">{market.totalTrades} trades</span>
              <span className="text-border">•</span>
              <span className="tabular-nums">{formatTimeRemaining(market.endDate)}</span>
            </div>

            {/* Analyze Button */}
            <button
              onClick={(e) => handleAnalyze(e, market)}
              className="w-full py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Analyze with AI
            </button>
          </motion.div>
        ))}
      </motion.div>
      
      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => setDisplayCount(prev => prev + 12)}
            className={cn(
              "px-8 py-3 rounded-full font-medium",
              "bg-muted text-foreground",
              "hover:bg-muted/80 transition-colors"
            )}
          >
            Load More Markets
          </button>
        </div>
      )}
    </section>
  );
}
