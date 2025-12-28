import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, TrendingUp, Sparkles } from 'lucide-react';
import { PandoraMarket, formatVolume } from '@/lib/pandora-api';
import { cn } from '@/lib/utils';

interface TrendingMarketsProps {
  markets: PandoraMarket[];
  onMarketClick: (market: PandoraMarket) => void;
}

export function TrendingMarkets({ markets, onMarketClick }: TrendingMarketsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

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

  if (!markets.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="max-w-6xl mx-auto px-4 sm:px-6 mb-16"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Trending Now</h2>
        </div>
        <button 
          onClick={() => scroll('right')}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          View All
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      {/* Horizontal scroll */}
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 snap-x snap-mandatory"
      >
        {markets.map((market, index) => (
          <motion.div
            key={market.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 * index }}
            onClick={() => onMarketClick(market)}
            className={cn(
              "flex-shrink-0 w-[280px] sm:w-[300px] snap-start",
              "p-5 rounded-2xl cursor-pointer",
              "bg-card border border-border/50",
              "hover:border-primary/30 hover:shadow-lg",
              "transition-all duration-300 group"
            )}
          >
            {/* Category badge */}
            <div className="inline-flex px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground mb-3">
              {market.category}
            </div>
            
            {/* Question */}
            <h3 className="text-base font-semibold text-foreground mb-4 line-clamp-2 group-hover:text-primary transition-colors">
              {market.question}
            </h3>
            
            {/* Odds bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-success">YES {market.currentOddsYes}%</span>
                <span className="font-medium text-destructive">NO {market.currentOddsNo}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-success to-success/80 transition-all duration-500"
                  style={{ width: `${market.currentOddsYes}%` }}
                />
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground tabular-nums">
                  {formatVolume(market.totalVolume)}
                </span>
                <span>vol</span>
                <span className="text-border">•</span>
                <span className="tabular-nums">{market.totalTrades}</span>
                <span>traders</span>
              </div>
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
      </div>
    </motion.section>
  );
}
