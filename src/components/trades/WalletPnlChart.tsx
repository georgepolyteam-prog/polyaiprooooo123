import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PnlDataPoint {
  timestamp: number;
  pnl_to_date: number;
}

interface WalletPnlChartProps {
  series: PnlDataPoint[];
  totalPnl: number;
  unrealizedPnl?: number;
  combinedPnl?: number;
  className?: string;
  compact?: boolean;
}

type TimeframeOption = '7D' | '30D' | 'ALL';
type PnlType = 'realized' | 'unrealized' | 'combined';

export function WalletPnlChart({ 
  series, 
  totalPnl, 
  unrealizedPnl = 0,
  combinedPnl,
  className, 
  compact = false 
}: WalletPnlChartProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>('ALL');
  const [pnlType, setPnlType] = useState<PnlType>('combined');
  
  const safeTotalPnl = totalPnl ?? 0;
  const safeUnrealizedPnl = unrealizedPnl ?? 0;
  const safeCombinedPnl = combinedPnl ?? (safeTotalPnl + safeUnrealizedPnl);
  
  // Get the PnL value based on selected type
  const displayPnl = pnlType === 'realized' 
    ? safeTotalPnl 
    : pnlType === 'unrealized' 
      ? safeUnrealizedPnl 
      : safeCombinedPnl;

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

  const isPositive = displayPnl >= 0;
  const gradientId = 'pnlGradient';
  
  // Determine color based on PnL
  const chartColor = isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
  const glowColor = isPositive ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)';

  const formatPnlValue = (val: number) => {
    const prefix = val >= 0 ? '+' : '';
    if (Math.abs(val) >= 1000000) return `${prefix}$${(val / 1000000).toFixed(2)}M`;
    if (Math.abs(val) >= 1000) return `${prefix}$${(val / 1000).toFixed(1)}K`;
    return `${prefix}$${val.toFixed(2)}`;
  };

  const pnlTypeLabels: Record<PnlType, { label: string; description: string }> = {
    combined: { label: 'Portfolio', description: 'Realized + unrealized gains from all trades' },
    realized: { label: 'Realized', description: 'Confirmed gains from sells & redeems only' },
    unrealized: { label: 'Unrealized', description: 'Unrealized gains from open positions' },
  };

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
      className={cn("rounded-xl bg-muted/20 border border-border/30", compact ? "p-3" : "p-4", className)}
    >
      {/* Header */}
      <div className={cn("flex items-center justify-between", compact ? "mb-2" : "mb-3")}>
        <div className="flex items-center gap-2">
          {isPositive ? (
            <TrendingUp className={cn(compact ? "w-3.5 h-3.5" : "w-4 h-4", "text-success")} />
          ) : (
            <TrendingDown className={cn(compact ? "w-3.5 h-3.5" : "w-4 h-4", "text-destructive")} />
          )}
          <span className={cn(compact ? "text-xs" : "text-sm", "font-medium")}>PnL History</span>
          
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px]">
                <p className="text-xs"><strong>Chart:</strong> Realized PnL over time (confirmed sells/redeems).</p>
                <p className="text-xs mt-1"><strong>Portfolio:</strong> Total = Realized + Unrealized (open positions).</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
        
        {/* Timeframe Toggle */}
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-muted/30">
          {(['7D', '30D', 'ALL'] as TimeframeOption[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "font-medium rounded-md transition-all",
                compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
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
      <div className={cn(compact ? "h-20" : "h-32", "-mx-2")}>
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
                const safePnl = pnl ?? 0;
                return (
                  <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-xl">
                    <p className="text-xs text-muted-foreground">{data.date}</p>
                    <p className={cn(
                      "text-sm font-bold",
                      isPos ? "text-success" : "text-destructive"
                    )}>
                      {isPos ? '+' : ''}{Math.abs(safePnl) >= 1000 ? `$${(safePnl / 1000).toFixed(1)}K` : `$${safePnl.toFixed(2)}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Realized only</p>
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

      {/* PnL Type Toggle */}
      <div className={cn("border-t border-border/20", compact ? "mt-1.5 pt-1.5" : "mt-2 pt-2")}>
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-muted/30 w-fit mb-2">
          {(['combined', 'realized', 'unrealized'] as PnlType[]).map((type) => (
            <TooltipProvider key={type}>
              <UITooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setPnlType(type)}
                    className={cn(
                      "font-medium rounded-md transition-all",
                      compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
                      pnlType === type
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {pnlTypeLabels[type].label}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{pnlTypeLabels[type].description}</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          ))}
        </div>
        
        {/* Display selected PnL value */}
        <div className="flex items-center justify-between">
          <span className={cn(compact ? "text-[10px]" : "text-xs", "text-muted-foreground")}>
            {pnlTypeLabels[pnlType].label} PnL
          </span>
          <span className={cn(
            "font-bold",
            compact ? "text-sm" : "text-base",
            displayPnl >= 0 ? "text-success" : "text-destructive"
          )}>
            {formatPnlValue(displayPnl)}
          </span>
        </div>

        {/* Show breakdown when combined is selected */}
        {pnlType === 'combined' && (
          <div className={cn("flex items-center justify-between mt-1", compact ? "text-[9px]" : "text-[10px]", "text-muted-foreground")}>
            <span>
              Realized: <span className={safeTotalPnl >= 0 ? "text-success" : "text-destructive"}>{formatPnlValue(safeTotalPnl)}</span>
              {' · '}
              Open: <span className={safeUnrealizedPnl >= 0 ? "text-success" : "text-destructive"}>{formatPnlValue(safeUnrealizedPnl)}</span>
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}