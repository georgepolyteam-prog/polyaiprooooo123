import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PnlDataPoint {
  timestamp: number;
  pnl_to_date: number;
}

interface WalletPnlChartProps {
  series: PnlDataPoint[];
  totalPnl: number;
  className?: string;
}

type TimeframeOption = '7D' | '30D' | 'ALL';

export function WalletPnlChart({ series, totalPnl, className }: WalletPnlChartProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>('ALL');

  const filteredData = useMemo(() => {
    if (!series || series.length === 0) return [];
    
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    
    let cutoff = 0;
    if (timeframe === '7D') {
      cutoff = now - 7 * msPerDay;
    } else if (timeframe === '30D') {
      cutoff = now - 30 * msPerDay;
    }
    
    const filtered = timeframe === 'ALL' 
      ? series 
      : series.filter(p => p.timestamp * 1000 >= cutoff);
    
    return filtered.map(p => ({
      date: new Date(p.timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pnl: p.pnl_to_date,
      timestamp: p.timestamp
    }));
  }, [series, timeframe]);

  const isPositive = totalPnl >= 0;
  const gradientId = 'pnlGradient';
  
  // Determine color based on PnL
  const chartColor = isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
  const glowColor = isPositive ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)';

  if (!series || series.length === 0) {
    return (
      <div className={cn("rounded-xl p-4 bg-muted/20 border border-border/30", className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">PnL History</span>
          </div>
        </div>
        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
          No PnL data available
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl p-4 bg-muted/20 border border-border/30", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isPositive ? (
            <TrendingUp className="w-4 h-4 text-success" />
          ) : (
            <TrendingDown className="w-4 h-4 text-destructive" />
          )}
          <span className="text-sm font-medium">PnL History</span>
        </div>
        
        {/* Timeframe Toggle */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-muted/30">
          {(['7D', '30D', 'ALL'] as TimeframeOption[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-2 py-1 text-xs font-medium rounded-md transition-all",
                timeframe === tf
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-32 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0.05} />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis 
              hide
              domain={['dataMin - 10', 'dataMax + 10']}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                const pnl = data.pnl;
                const isPos = pnl >= 0;
                return (
                  <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-xl">
                    <p className="text-xs text-muted-foreground">{data.date}</p>
                    <p className={cn(
                      "text-sm font-bold",
                      isPos ? "text-success" : "text-destructive"
                    )}>
                      {isPos ? '+' : ''}{pnl >= 1000 ? `$${(pnl / 1000).toFixed(1)}K` : `$${pnl.toFixed(2)}`}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke={chartColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              filter="url(#glow)"
              style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Total PnL Display */}
      <div className="mt-2 pt-2 border-t border-border/20 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Total PnL</span>
        <span className={cn(
          "font-bold",
          isPositive ? "text-success" : "text-destructive"
        )}>
          {isPositive ? '+' : ''}{totalPnl >= 1000000 ? `$${(totalPnl / 1000000).toFixed(2)}M` : totalPnl >= 1000 ? `$${(totalPnl / 1000).toFixed(1)}K` : `$${totalPnl.toFixed(2)}`}
        </span>
      </div>
    </motion.div>
  );
}