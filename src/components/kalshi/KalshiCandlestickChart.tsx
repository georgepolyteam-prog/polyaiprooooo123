import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, Time } from 'lightweight-charts';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDflowApi, type Candlestick } from '@/hooks/useDflowApi';
import { useDflowWebSocket, type PriceUpdate } from '@/hooks/useDflowWebSocket';

interface KalshiCandlestickChartProps {
  ticker: string;
  title?: string;
  compact?: boolean;
  onPriceUpdate?: (price: number) => void;
}

type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

const INTERVALS: { label: string; value: TimeInterval; apiInterval: 1 | 60 | 1440; hours: number }[] = [
  { label: '1m', value: '1m', apiInterval: 1, hours: 4 },
  { label: '5m', value: '5m', apiInterval: 1, hours: 12 },
  { label: '15m', value: '15m', apiInterval: 1, hours: 24 },
  { label: '1H', value: '1h', apiInterval: 60, hours: 72 },
  { label: '4H', value: '4h', apiInterval: 60, hours: 168 },
  { label: '1D', value: '1d', apiInterval: 1440, hours: 720 },
];

export function KalshiCandlestickChart({ 
  ticker, 
  title,
  compact = false,
  onPriceUpdate,
}: KalshiCandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  
  const { getCandlesticks } = useDflowApi();
  const [interval, setInterval] = useState<TimeInterval>('1h');
  const [candles, setCandles] = useState<Candlestick[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);

  // Get current interval config
  const intervalConfig = useMemo(() => 
    INTERVALS.find(i => i.value === interval) || INTERVALS[3], 
    [interval]
  );

  // WebSocket for real-time price updates
  useDflowWebSocket({
    tickers: [ticker],
    channels: ['prices'],
    onPriceUpdate: (update: PriceUpdate) => {
      if (update.ticker === ticker && candlestickSeriesRef.current) {
        setLastPrice(update.yesBid);
        onPriceUpdate?.(update.yesBid);
        
        // Update last candle in real-time
        if (candles.length > 0) {
          const lastCandle = { ...candles[candles.length - 1] };
          lastCandle.close = update.yesBid;
          if (update.yesBid > lastCandle.high) lastCandle.high = update.yesBid;
          if (update.yesBid < lastCandle.low) lastCandle.low = update.yesBid;
          
          candlestickSeriesRef.current.update({
            time: lastCandle.timestamp as Time,
            open: lastCandle.open / 100,
            high: lastCandle.high / 100,
            low: lastCandle.low / 100,
            close: lastCandle.close / 100,
          });
        }
      }
    },
  });

  // Fetch candlestick data
  useEffect(() => {
    const fetchCandles = async () => {
      setIsLoading(true);
      try {
        const now = Math.floor(Date.now() / 1000);
        const start = now - (intervalConfig.hours * 3600);
        
        const data = await getCandlesticks(
          ticker, 
          start, 
          now, 
          intervalConfig.apiInterval
        );
        
        if (data && data.length > 0) {
          // Aggregate candles if needed (5m, 15m, 4h from 1m or 1h data)
          let aggregated = data;
          
          if (interval === '5m' || interval === '15m') {
            const factor = interval === '5m' ? 5 : 15;
            aggregated = aggregateCandles(data, factor);
          } else if (interval === '4h') {
            aggregated = aggregateCandles(data, 4);
          }
          
          setCandles(aggregated);
          
          // Calculate price change
          if (aggregated.length >= 2) {
            const first = aggregated[0].close;
            const last = aggregated[aggregated.length - 1].close;
            const change = ((last - first) / first) * 100;
            setPriceChange(change);
            setLastPrice(last);
          }
        }
      } catch (err) {
        console.error('Failed to fetch candlesticks:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCandles();
  }, [ticker, interval, intervalConfig, getCandlesticks]);

  // Initialize and update chart
  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    try {
      // Create chart
      if (!chartRef.current) {
        chartRef.current = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: '#94a3b8',
            fontFamily: 'JetBrains Mono, monospace',
          },
          grid: {
            vertLines: { color: 'rgba(100, 100, 100, 0.1)' },
            horzLines: { color: 'rgba(100, 100, 100, 0.1)' },
          },
          crosshair: {
            mode: 1,
            vertLine: {
              color: 'rgba(100, 200, 200, 0.5)',
              labelBackgroundColor: '#06b6d4',
            },
            horzLine: {
              color: 'rgba(100, 200, 200, 0.5)',
              labelBackgroundColor: '#06b6d4',
            },
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: 'rgba(100, 100, 100, 0.2)',
          },
          rightPriceScale: {
            borderColor: 'rgba(100, 100, 100, 0.2)',
            scaleMargins: { top: 0.1, bottom: 0.2 },
          },
          handleScroll: { mouseWheel: true, pressedMouseMove: true },
          handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
        });

        // Add candlestick series
        candlestickSeriesRef.current = chartRef.current.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        });

        // Add volume series
        volumeSeriesRef.current = chartRef.current.addHistogramSeries({
          color: 'rgba(100, 200, 200, 0.3)',
          priceFormat: { type: 'volume' },
          priceScaleId: '',
        });
        
        volumeSeriesRef.current.priceScale().applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
        });
      }

      // Filter out invalid candles and validate timestamps
      const validCandles = candles.filter(c => 
        c && 
        typeof c.timestamp === 'number' && 
        c.timestamp > 0 &&
        !isNaN(c.open) && 
        !isNaN(c.high) && 
        !isNaN(c.low) && 
        !isNaN(c.close)
      );

      if (validCandles.length === 0) {
        console.warn('[Chart] No valid candles to display');
        return;
      }

      // Update chart data
      const chartData = validCandles.map(c => ({
        time: c.timestamp as Time,
        open: c.open / 100,
        high: c.high / 100,
        low: c.low / 100,
        close: c.close / 100,
      }));

      const volumeData = validCandles.map(c => ({
        time: c.timestamp as Time,
        value: c.volume || 0,
        color: c.close >= c.open 
          ? 'rgba(34, 197, 94, 0.4)' 
          : 'rgba(239, 68, 68, 0.4)',
      }));

      candlestickSeriesRef.current?.setData(chartData);
      volumeSeriesRef.current?.setData(volumeData);
      chartRef.current?.timeScale().fitContent();
    } catch (err) {
      console.error('[Chart] Failed to initialize or update chart:', err);
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        try {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
        } catch (e) {
          // Ignore resize errors
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [candles]);

  // Cleanup chart on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // Aggregate candles helper
  function aggregateCandles(data: Candlestick[], factor: number): Candlestick[] {
    const result: Candlestick[] = [];
    for (let i = 0; i < data.length; i += factor) {
      const chunk = data.slice(i, i + factor);
      if (chunk.length === 0) continue;
      
      result.push({
        timestamp: chunk[0].timestamp,
        open: chunk[0].open,
        high: Math.max(...chunk.map(c => c.high)),
        low: Math.min(...chunk.map(c => c.low)),
        close: chunk[chunk.length - 1].close,
        volume: chunk.reduce((sum, c) => sum + (c.volume || 0), 0),
      });
    }
    return result;
  }

  const chartHeight = compact ? 'h-[200px]' : 'h-[300px] sm:h-[400px]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          {title && (
            <h3 className="text-sm font-medium text-foreground line-clamp-1">
              {title}
            </h3>
          )}
          
          {lastPrice !== null && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono text-foreground">
                {lastPrice}¢
              </span>
              <span className={cn(
                'flex items-center gap-0.5 text-sm font-medium',
                priceChange >= 0 ? 'text-emerald-500' : 'text-red-500'
              )}>
                {priceChange >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Interval buttons */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/40 border border-border/30">
          {INTERVALS.map(int => (
            <button
              key={int.value}
              onClick={() => setInterval(int.value)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                interval === int.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              {int.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className={cn('relative w-full', chartHeight)}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading chart...</span>
            </div>
          </div>
        )}
        
        {candles.length === 0 && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No chart data available</p>
            </div>
          </div>
        )}
        
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </motion.div>
  );
}
