import { motion } from 'framer-motion';
import { TrendingUp, Flame, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopMarket {
  slug: string;
  title: string;
  volume: number;
}

interface WalletHotMarketsProps {
  markets: TopMarket[];
  className?: string;
}

export function WalletHotMarkets({ markets, className }: WalletHotMarketsProps) {
  if (!markets || markets.length === 0) {
    return null;
  }

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const maxVolume = Math.max(...markets.map(m => m.volume));

  const getHeatLevel = (volume: number): number => {
    const ratio = volume / maxVolume;
    if (ratio > 0.7) return 2;
    if (ratio > 0.3) return 1;
    return 0;
  };

  const getHeatColor = (level: number): string => {
    switch (level) {
      case 2: return 'from-orange-500 to-red-500';
      case 1: return 'from-yellow-500 to-orange-500';
      default: return 'from-cyan-500 to-blue-500';
    }
  };

  const getHeatGlow = (level: number): string => {
    switch (level) {
      case 2: return 'shadow-orange-500/30';
      case 1: return 'shadow-yellow-500/20';
      default: return 'shadow-cyan-500/20';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn("", className)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 blur-lg opacity-50" />
          <div className="relative p-2 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30">
            <Flame className="w-5 h-5 text-orange-400" />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">Hot Markets</h3>
          <p className="text-xs text-muted-foreground">Top {markets.length} traded markets by volume</p>
        </div>
      </div>

      {/* Markets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {markets.slice(0, 8).map((market, index) => {
          const heatLevel = getHeatLevel(market.volume);
          const heatColor = getHeatColor(heatLevel);
          const heatGlow = getHeatGlow(heatLevel);
          const volumePercent = (market.volume / maxVolume) * 100;

          return (
            <motion.div
              key={market.slug}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className={cn(
                "relative group p-4 rounded-xl",
                "bg-card/50 backdrop-blur-sm",
                "border border-border/50",
                "hover:border-primary/30",
                "transition-all duration-300",
                "shadow-lg",
                heatGlow
              )}
            >
              {/* Rank Badge */}
              <div className={cn(
                "absolute -top-2 -left-2 w-7 h-7 rounded-full",
                "bg-gradient-to-r flex items-center justify-center",
                "text-xs font-bold text-white shadow-lg",
                heatColor
              )}>
                {index + 1}
              </div>

              {/* Heat Indicator */}
              <div className="absolute top-3 right-3">
                {heatLevel === 2 && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Flame className="w-4 h-4 text-orange-400" />
                  </motion.div>
                )}
                {heatLevel === 1 && <TrendingUp className="w-4 h-4 text-yellow-400" />}
                {heatLevel === 0 && <BarChart3 className="w-4 h-4 text-cyan-400" />}
              </div>

              {/* Content */}
              <div className="mt-2">
                <h4 className="text-sm font-medium text-foreground line-clamp-2 pr-6 min-h-[2.5rem]">
                  {market.title}
                </h4>
                
                <div className="mt-3 space-y-2">
                  {/* Volume */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Volume</span>
                    <span className={cn(
                      "text-sm font-bold bg-gradient-to-r bg-clip-text text-transparent",
                      heatColor
                    )}>
                      {formatVolume(market.volume)}
                    </span>
                  </div>

                  {/* Heat Bar */}
                  <div className="relative h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${volumePercent}%` }}
                      transition={{ duration: 0.8, delay: index * 0.1 }}
                      className={cn("absolute inset-y-0 left-0 bg-gradient-to-r rounded-full", heatColor)}
                    />
                  </div>
                </div>
              </div>

              {/* Subtle Glow Effect on Hover */}
              <div 
                className={cn(
                  "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-10",
                  "bg-gradient-to-r blur-xl transition-opacity duration-300 -z-10",
                  heatColor
                )} 
              />
            </motion.div>
          );
        })}
      </div>

      {/* Show More Indicator */}
      {markets.length > 8 && (
        <div className="mt-3 text-center">
          <span className="text-xs text-muted-foreground">
            +{markets.length - 8} more markets traded
          </span>
        </div>
      )}
    </motion.div>
  );
}
