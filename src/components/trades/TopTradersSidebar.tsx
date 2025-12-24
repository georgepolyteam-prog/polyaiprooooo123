import { useState } from 'react';
import { ChevronDown, ChevronUp, Trophy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TraderStats {
  wallet: string;
  volume: number;
  trades: number;
  markets: number;
  buyPercent: number;
}

interface TopTradersSidebarProps {
  traders: TraderStats[];
  onWalletClick?: (wallet: string) => void;
}

function formatVolume(vol: number): string {
  if (vol >= 1000000) return `$${(vol / 1000000).toFixed(2)}M`;
  if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}k`;
  return `$${vol.toFixed(0)}`;
}

function getRankBadge(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export function TopTradersSidebar({ traders, onWalletClick }: TopTradersSidebarProps) {
  const [expanded, setExpanded] = useState(true);

  if (traders.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-warning" />
          <span className="font-semibold text-sm">Top Traders</span>
          <span className="text-xs text-muted-foreground">({traders.length})</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="border-t border-border divide-y divide-border/50 max-h-[400px] overflow-y-auto">
          {traders.map((trader, index) => (
            <div
              key={trader.wallet}
              onClick={() => onWalletClick?.(trader.wallet)}
              className="p-3 hover:bg-muted/30 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium min-w-[28px]">{getRankBadge(index + 1)}</span>
                  <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {trader.wallet.slice(0, 6)}...{trader.wallet.slice(-4)}
                  </span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="font-bold text-sm text-primary">{formatVolume(trader.volume)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{trader.trades} trades • {trader.markets} markets</span>
                <span className={trader.buyPercent > 50 ? 'text-success' : 'text-destructive'}>
                  {trader.buyPercent.toFixed(0)}% buy
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
