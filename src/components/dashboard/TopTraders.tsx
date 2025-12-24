import { GlassCard } from './GlassCard';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Users, Fish, Crown, Medal, Award } from 'lucide-react';

interface TopTrader {
  wallet: string;
  volume: number;
  buyPercent: number;
  trades: number;
  isWhale: boolean;
}

interface TopTradersProps {
  traders: TopTrader[];
  whaleCount: number;
  whaleVolume: number;
  totalVolume: number;
  whaleThreshold: number;
}

export function TopTraders({ traders, whaleCount, whaleVolume, totalVolume, whaleThreshold }: TopTradersProps) {
  const formatUsd = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  const formatWallet = (wallet: string) => {
    if (!wallet || wallet === 'unknown') return 'Unknown';
    if (wallet.length <= 12) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const volumePercent = totalVolume > 0 ? ((whaleVolume / totalVolume) * 100).toFixed(0) : '0';

  const getRankIcon = (idx: number) => {
    if (idx === 0) return <Crown className="w-4 h-4 text-yellow-500" />;
    if (idx === 1) return <Medal className="w-4 h-4 text-gray-400" />;
    if (idx === 2) return <Award className="w-4 h-4 text-amber-600" />;
    return null;
  };

  return (
    <GlassCard className="p-4" cyber>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-warning/10">
            <Fish className="w-4 h-4 text-warning" />
          </div>
          <h3 className="font-semibold text-foreground">Top Traders</h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg">
          <Users className="w-4 h-4" />
          <span className="font-mono">{traders.length}</span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-muted/20 rounded-xl border border-border/30">
        <div className="text-center">
          <div className="text-xl font-bold text-warning flex items-center justify-center gap-1">
            <Fish className="w-4 h-4" />
            {whaleCount}
          </div>
          <div className="text-xs text-muted-foreground">Whales</div>
        </div>
        <div className="text-center border-x border-border/30">
          <div className="text-xl font-bold text-foreground font-mono">{formatUsd(whaleVolume)}</div>
          <div className="text-xs text-muted-foreground">Volume</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-secondary font-mono">{volumePercent}%</div>
          <div className="text-xs text-muted-foreground">of 24h</div>
        </div>
      </div>

      {/* Threshold indicator */}
      <div className="text-xs text-muted-foreground mb-3 px-1 flex items-center gap-1.5">
        <Fish className="w-3 h-3 text-warning" />
        Whale threshold: 
        <span className="font-mono font-medium text-foreground">{formatUsd(whaleThreshold)}+</span>
      </div>

      {/* Trader list */}
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {traders.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No trading activity yet
          </div>
        ) : (
          traders.map((trader, idx) => (
            <div
              key={trader.wallet}
              className={cn(
                "flex items-center justify-between p-2.5 rounded-xl transition-all duration-300 group",
                trader.isWhale 
                  ? "bg-warning/10 border border-warning/20 hover:border-warning/40" 
                  : "bg-muted/10 hover:bg-muted/20 border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
                  idx === 0 && "bg-yellow-500/20 text-yellow-500",
                  idx === 1 && "bg-gray-400/20 text-gray-400",
                  idx === 2 && "bg-amber-600/20 text-amber-600",
                  idx > 2 && "bg-muted/30 text-muted-foreground"
                )}>
                  {getRankIcon(idx) || <span>{idx + 1}</span>}
                </div>
                <div>
                  <div className="font-mono text-sm text-foreground flex items-center gap-1.5">
                    {formatWallet(trader.wallet)}
                    {trader.isWhale && <Fish className="w-3.5 h-3.5 text-warning" />}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {trader.trades} trade{trader.trades !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm font-mono">{formatUsd(trader.volume)}</div>
                <div className={cn(
                  "flex items-center gap-1 text-xs justify-end",
                  trader.buyPercent >= 60 ? "text-success" : 
                  trader.buyPercent <= 40 ? "text-destructive" : "text-muted-foreground"
                )}>
                  {trader.buyPercent >= 50 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {trader.buyPercent}% BUY
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
