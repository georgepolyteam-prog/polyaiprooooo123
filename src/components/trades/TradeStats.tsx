import { TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';

interface TradeStatsProps {
  totalVolume: number;
  totalTrades: number;
  avgTradeSize: number;
  largestTrade: number;
  buyVolume: number;
  sellVolume: number;
}

function formatVolume(vol: number): string {
  if (vol >= 1000000) return `$${(vol / 1000000).toFixed(2)}M`;
  if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}k`;
  return `$${vol.toFixed(0)}`;
}

export function TradeStats({ 
  totalVolume, 
  totalTrades, 
  avgTradeSize, 
  largestTrade,
  buyVolume,
  sellVolume
}: TradeStatsProps) {
  const totalFlow = buyVolume + sellVolume;
  const imbalance = totalFlow > 0 ? ((buyVolume - sellVolume) / totalFlow) * 100 : 0;
  const buyPressure = totalFlow > 0 ? (buyVolume / totalFlow) * 100 : 50;

  return (
    <div className="mb-6 space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <BarChart3 className="w-4 h-4" />
            Total Volume
          </div>
          <div className="text-xl font-bold text-foreground">{formatVolume(totalVolume)}</div>
        </div>

        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Activity className="w-4 h-4" />
            Total Trades
          </div>
          <div className="text-xl font-bold text-foreground">{totalTrades.toLocaleString()}</div>
        </div>

        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <TrendingUp className="w-4 h-4" />
            Avg Trade
          </div>
          <div className="text-xl font-bold text-foreground">{formatVolume(avgTradeSize)}</div>
        </div>

        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 text-warning text-xs mb-1">
            🐋 Largest
          </div>
          <div className="text-xl font-bold text-warning">{formatVolume(largestTrade)}</div>
        </div>
      </div>

      {/* Order Flow Imbalance */}
      <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground text-xs">Order Flow</span>
          <span className={`text-xs font-bold ${imbalance > 0 ? 'text-success' : imbalance < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {imbalance > 0 ? '+' : ''}{imbalance.toFixed(1)}% {imbalance > 0 ? 'Buy' : imbalance < 0 ? 'Sell' : ''} Pressure
          </span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden flex">
          <div 
            className="h-full bg-success transition-all duration-500"
            style={{ width: `${buyPressure}%` }}
          />
          <div 
            className="h-full bg-destructive transition-all duration-500"
            style={{ width: `${100 - buyPressure}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs">
          <span className="text-success">{formatVolume(buyVolume)} buys</span>
          <span className="text-destructive">{formatVolume(sellVolume)} sells</span>
        </div>
      </div>
    </div>
  );
}
