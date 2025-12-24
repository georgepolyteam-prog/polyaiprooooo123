import { TrendingUp, TrendingDown, BarChart3, Users, Activity, Fish, Target, Zap } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { AnimatedNumber } from './AnimatedNumber';
import { cn } from '@/lib/utils';

interface StatsGridProps {
  volume24h: number;
  uniqueTraders: number;
  avgTradeSize: number;
  whaleCount: number;
  whaleVolume: number;
  priceChange1h: number;
  priceChange24h: number;
  priceChange7d: number;
  buyPressure: number;
  recentWhaleActivity: boolean;
}

export function StatsGrid({
  volume24h,
  uniqueTraders,
  avgTradeSize,
  whaleCount,
  whaleVolume,
  priceChange1h,
  priceChange24h,
  priceChange7d,
  buyPressure,
  recentWhaleActivity,
}: StatsGridProps) {
  const formatUsd = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const getSignal = () => {
    if (buyPressure >= 70 && priceChange1h > 0) return { label: 'Bullish', color: 'text-success', icon: <TrendingUp className="w-5 h-5" /> };
    if (buyPressure <= 30 && priceChange1h < 0) return { label: 'Bearish', color: 'text-destructive', icon: <TrendingDown className="w-5 h-5" /> };
    return { label: 'Neutral', color: 'text-muted-foreground', icon: <Activity className="w-5 h-5" /> };
  };

  const signal = getSignal();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Volume Stats */}
      <GlassCard className="p-4 group hover:border-border transition-all duration-300 overflow-hidden" cyber>
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <div className="p-1.5 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors flex-shrink-0">
            <BarChart3 className="w-4 h-4 text-foreground" />
          </div>
          <span className="text-sm font-medium truncate">24h Volume</span>
        </div>
        <div className="text-xl md:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text truncate">
          <AnimatedNumber value={volume24h} format={formatUsd} />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Users className="w-3 h-3 text-secondary flex-shrink-0" />
          <span className="text-sm text-muted-foreground truncate">{uniqueTraders} traders</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 font-mono truncate">
          Avg: {formatUsd(avgTradeSize)}
        </div>
      </GlassCard>

      {/* Top Traders Summary */}
      <GlassCard className={cn("p-4 group hover:border-warning/30 transition-all duration-300 overflow-hidden", recentWhaleActivity && "border-warning/50")} cyber>
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <div className={cn("p-1.5 rounded-lg transition-colors flex-shrink-0", recentWhaleActivity ? "bg-warning/20" : "bg-warning/10 group-hover:bg-warning/20")}>
            <Fish className="w-4 h-4 text-warning" />
          </div>
          <span className="text-sm font-medium truncate">Top Traders</span>
        </div>
        <div className="text-xl md:text-2xl font-bold text-warning truncate">
          {whaleCount} whale{whaleCount !== 1 ? 's' : ''}
        </div>
        <div className="text-sm text-muted-foreground mt-2 font-mono truncate">
          {formatUsd(whaleVolume)} volume
        </div>
        {recentWhaleActivity && (
          <div className="text-xs text-warning mt-2 flex items-center gap-1.5 bg-warning/10 px-2 py-1 rounded-md w-fit">
            <Zap className="w-3 h-3 flex-shrink-0" />
            <span className="font-medium">Active now</span>
          </div>
        )}
      </GlassCard>

      {/* Momentum */}
      <GlassCard className="p-4 group hover:border-border transition-all duration-300 overflow-hidden" cyber>
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <div className="p-1.5 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
            <Activity className="w-4 h-4 text-foreground" />
          </div>
          <span className="text-sm font-medium">Momentum</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-muted/20">
            <span className="text-xs text-muted-foreground font-medium">1h</span>
            <span className={cn(
              "font-medium flex items-center gap-1 text-sm",
              priceChange1h >= 0 ? "text-success" : "text-destructive"
            )}>
              {priceChange1h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {priceChange1h >= 0 ? '+' : ''}{Math.min(999, Math.max(-999, priceChange1h)).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-muted/20 transition-colors">
            <span className="text-xs text-muted-foreground font-medium">24h</span>
            <span className={cn(
              "font-medium text-sm",
              priceChange24h >= 0 ? "text-success" : "text-destructive"
            )}>
              {priceChange24h >= 0 ? '+' : ''}{Math.min(999, Math.max(-999, priceChange24h)).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-muted/20 transition-colors">
            <span className="text-xs text-muted-foreground font-medium">7d</span>
            <span className={cn(
              "font-medium text-sm",
              priceChange7d >= 0 ? "text-success" : "text-destructive"
            )}>
              {priceChange7d >= 0 ? '+' : ''}{Math.min(999, Math.max(-999, priceChange7d)).toFixed(1)}%
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Signals */}
      <GlassCard className="p-4 group hover:border-border transition-all duration-300 overflow-hidden" cyber>
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <div className="p-1.5 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors flex-shrink-0">
            <Target className="w-4 h-4 text-foreground" />
          </div>
          <span className="text-sm font-medium truncate">Signals</span>
        </div>
        <div className={cn("text-xl md:text-2xl font-bold flex items-center gap-2", signal.color)}>
          {signal.icon}
          {signal.label}
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground text-xs font-medium">Buy Pressure</span>
            <span className="font-bold font-mono">{buyPressure.toFixed(0)}%</span>
          </div>
          <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden relative">
            <div 
              className="h-full rounded-full transition-all duration-500 relative"
              style={{ 
                width: `${buyPressure}%`,
                background: 'linear-gradient(90deg, hsl(var(--success)), hsl(var(--success) / 0.7))'
              }}
            >
              <div className="absolute inset-0 shimmer" />
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
