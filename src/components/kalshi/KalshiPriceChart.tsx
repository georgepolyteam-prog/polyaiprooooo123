import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Trade {
  price: number;
  size: number;
  timestamp: string;
  side?: string;
}

interface KalshiPriceChartProps {
  trades: Trade[];
  yesPrice: number;
  noPrice: number;
  compact?: boolean;
}

export function KalshiPriceChart({ trades, yesPrice, compact = false }: KalshiPriceChartProps) {
  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) {
      // Generate mock data if no trades
      const now = Date.now();
      return Array.from({ length: 20 }, (_, i) => ({
        time: new Date(now - (19 - i) * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        price: yesPrice + (Math.random() - 0.5) * 10,
      }));
    }

    return trades
      .slice(-50)
      .map((trade) => ({
        time: new Date(trade.timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        price: trade.price,
        volume: trade.size,
      }))
      .reverse();
  }, [trades, yesPrice]);

  const minPrice = Math.min(...chartData.map(d => d.price)) - 5;
  const maxPrice = Math.max(...chartData.map(d => d.price)) + 5;
  const priceChange = chartData.length > 1 
    ? chartData[chartData.length - 1].price - chartData[0].price 
    : 0;
  const isPositive = priceChange >= 0;

  if (compact) {
    return (
      <div className="h-12 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop 
                  offset="0%" 
                  stopColor={isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"} 
                  stopOpacity={0.3}
                />
                <stop 
                  offset="100%" 
                  stopColor={isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"} 
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="price"
              stroke={isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"}
              strokeWidth={1.5}
              fill="url(#sparklineGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground">Price History</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground">{yesPrice}¢</span>
            <span className={cn(
              "text-sm font-medium",
              isPositive ? "text-emerald-400" : "text-red-400"
            )}>
              {isPositive ? '+' : ''}{priceChange.toFixed(1)}¢
            </span>
          </div>
        </div>
        
        <div className="flex gap-1">
          {['1H', '1D', '1W', '1M'].map((period) => (
            <button
              key={period}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                period === '1D' 
                  ? "bg-primary/20 text-primary" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop 
                  offset="0%" 
                  stopColor={isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"} 
                  stopOpacity={0.4}
                />
                <stop 
                  offset="100%" 
                  stopColor={isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"} 
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="time" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={[minPrice, maxPrice]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `${value}¢`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                padding: '8px 12px',
              }}
              labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => [`${value}¢`, 'Price']}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"}
              strokeWidth={2}
              fill="url(#priceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
