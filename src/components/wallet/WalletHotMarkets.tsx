import { motion } from 'framer-motion';
import { TrendingUp, Flame, ExternalLink } from 'lucide-react';
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

  // Calculate max volume for intensity scaling
  const maxVolume = Math.max(...markets.map(m => m.volume));

  // Determine heat level (0-2) based on relative volume
  const getHeatLevel = (volume: number): number => {
    const ratio = volume / maxVolume;
    if (ratio > 0.7) return 2; // Hot
    if (ratio > 0.3) return 1; // Warm
    return 0; // Normal
  };

  const heatColors = [
    { bg: 'from-muted/30 to-muted/10', border: 'border-border/30', glow: '' },
    { bg: 'from-amber-500/20 to-orange-500/10', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
    { bg: 'from-red-500/20 to-orange-500/15', border: 'border-red-500/40', glow: 'shadow-red-500/30 shadow-lg' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm", className)}
    >
      {/* Header */}
      <div className="p-4 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20">
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Hot Markets</h3>
            <p className="text-xs text-muted-foreground">Most traded by this wallet</p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground px-2 py-1 bg-muted/30 rounded-full">
          {markets.length} markets
        </span>
      </div>

      {/* Markets Grid - Horizontal scroll on mobile */}
      <div className="p-4">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible md:mx-0 md:px-0">
          {markets.slice(0, 6).map((market, i) => {
            const heatLevel = getHeatLevel(market.volume);
            const colors = heatColors[heatLevel];
            
            return (
              <motion.a
                key={market.slug}
                href={`https://polymarket.com/event/${market.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "flex-shrink-0 w-[200px] md:w-auto p-3 rounded-xl border transition-all duration-300",
                  "bg-gradient-to-br hover:scale-[1.02] group cursor-pointer",
                  colors.bg,
                  colors.border,
                  colors.glow
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    {heatLevel === 2 && (
                      <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                    )}
                    {heatLevel === 1 && (
                      <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      heatLevel === 2 && "bg-red-500/20 text-red-400",
                      heatLevel === 1 && "bg-amber-500/20 text-amber-400",
                      heatLevel === 0 && "bg-muted text-muted-foreground"
                    )}>
                      #{i + 1}
                    </span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <p className="text-xs font-medium line-clamp-2 mb-2 min-h-[32px]">
                  {market.title}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Volume</span>
                  <span className={cn(
                    "text-sm font-bold",
                    heatLevel === 2 && "text-red-400",
                    heatLevel === 1 && "text-amber-400",
                    heatLevel === 0 && "text-foreground"
                  )}>
                    {formatVolume(market.volume)}
                  </span>
                </div>

                {/* Heat bar */}
                <div className="mt-2 h-1 bg-muted/30 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(market.volume / maxVolume) * 100}%` }}
                    transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                    className={cn(
                      "h-full rounded-full",
                      heatLevel === 2 && "bg-gradient-to-r from-orange-500 to-red-500",
                      heatLevel === 1 && "bg-gradient-to-r from-amber-400 to-orange-500",
                      heatLevel === 0 && "bg-gradient-to-r from-muted-foreground/50 to-muted-foreground/30"
                    )}
                  />
                </div>
              </motion.a>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
