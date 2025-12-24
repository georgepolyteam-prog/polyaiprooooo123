import { GlassCard } from './GlassCard';
import { cn } from '@/lib/utils';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, LineChart } from 'lucide-react';

interface PricePoint {
  timestamp: number;
  price: number;
  volume?: number;
}

interface PriceChartProps {
  history: PricePoint[];
  currentPrice: number;
  priceChange7d: number;
}

export function PriceChart({ history, currentPrice, priceChange7d }: PriceChartProps) {
  // Format data for chart - prices already come in as 0-100 from the API
  const chartData = history.map(point => ({
    time: point.timestamp 
      ? new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'Unknown',
    price: point.price, // Already 0-100 from edge function
    volume: point.volume || 0,
  }));

  // Actual min/max for display (clamped to 0-100)
  const actualMin = chartData.length > 0 ? Math.max(0, Math.min(100, Math.min(...chartData.map(d => d.price)))) : 50;
  const actualMax = chartData.length > 0 ? Math.max(0, Math.min(100, Math.max(...chartData.map(d => d.price)))) : 50;
  
  // Padded values for chart axis only
  const minPriceAxis = Math.max(0, actualMin - 5);
  const maxPriceAxis = Math.min(100, actualMax + 5);

  const isPositive = priceChange7d >= 0;

  return (
    <GlassCard className="p-6" cyber>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-secondary/10">
            <LineChart className="w-4 h-4 text-secondary" />
          </div>
          <h3 className="font-semibold">Price History (7d)</h3>
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-lg text-sm font-medium",
            isPositive ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
          )}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {Math.abs(priceChange7d).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradientCyber" x1="0" y1="0" x2="0" y2="1">
                  <stop 
                    offset="5%" 
                    stopColor={isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"} 
                    stopOpacity={0.4}
                  />
                  <stop 
                    offset="50%" 
                    stopColor={isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"} 
                    stopOpacity={0.1}
                  />
                  <stop 
                    offset="95%" 
                    stopColor={isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"} 
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis 
                domain={[minPriceAxis, maxPriceAxis]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickFormatter={(value) => `${value.toFixed(0)}%`}
                width={40}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Price']}
              />
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke={isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"} 
                strokeWidth={2.5}
                fill="url(#priceGradientCyber)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <LineChart className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No price history available</p>
            </div>
          </div>
        )}
      </div>

      {/* Current Price */}
      <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Current Price</div>
          <div className="text-2xl font-bold font-mono bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {currentPrice.toFixed(1)}%
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground mb-0.5">7d Range</div>
          <div className="font-mono flex items-center gap-2">
            <span className="text-success">{actualMax.toFixed(1)}%</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-destructive">{actualMin.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
