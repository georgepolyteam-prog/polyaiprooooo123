import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, X, TrendingUp, TrendingDown, Sparkles, Loader2, BarChart3, Activity, Droplet, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { createChart, IChartApi, Time, ColorType } from 'lightweight-charts';

interface CandlestickData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface MarketChartViewProps {
  conditionId: string;
  marketUrl: string;
  title: string;
  image?: string | null;
  onBack: () => void;
  onClose: () => void;
  onTrade: (side: 'YES' | 'NO') => void;
  onAnalyze: () => void;
  isMobile?: boolean;
}

export function MarketChartView({
  conditionId,
  marketUrl,
  title,
  image,
  onBack,
  onClose,
  onTrade,
  onAnalyze,
  isMobile = false
}: MarketChartViewProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  const [candlesticks, setCandlesticks] = useState<CandlestickData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'1H' | '1D' | '7D' | '30D' | 'ALL'>('1D');
  const [loadingSide, setLoadingSide] = useState<'YES' | 'NO' | null>(null);
  
  const [stats, setStats] = useState<{
    currentPrice: number | null;
    volume24h: number | null;
    liquidity: number | null;
    spread: number | null;
  }>({ currentPrice: null, volume24h: null, liquidity: null, spread: null });

  const fetchCandlesticks = useCallback(async () => {
    if (!conditionId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const now = Math.floor(Date.now() / 1000);
      let startTime: number;
      let interval: number;
      
      switch (timeframe) {
        case '1H':
          startTime = now - 60 * 60;
          interval = 1; // 1min candles
          break;
        case '1D':
          startTime = now - 24 * 60 * 60;
          interval = 1; // 1min candles
          break;
        case '7D':
          startTime = now - 7 * 24 * 60 * 60;
          interval = 60; // 1h candles
          break;
        case '30D':
          startTime = now - 30 * 24 * 60 * 60;
          interval = 1440; // 1d candles
          break;
        case 'ALL':
          startTime = now - 365 * 24 * 60 * 60;
          interval = 1440; // 1d candles
          break;
        default:
          startTime = now - 24 * 60 * 60;
          interval = 1;
      }
      
      // Use backend function to proxy the request (avoids 403)
      const { data, error: fetchError } = await supabase.functions.invoke('market-candlesticks', {
        body: { 
          conditionId, 
          startTime, 
          endTime: now, 
          interval 
        }
      });
      
      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to fetch candlesticks');
      }
      
      const formattedCandles: CandlestickData[] = (data?.candlesticks || [])
        .map((c: any) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
        .filter((c: CandlestickData) => c.open > 0 || c.close > 0);
      
      setCandlesticks(formattedCandles);
      
      // Update current price from latest candle
      if (formattedCandles.length > 0) {
        const latest = formattedCandles[formattedCandles.length - 1];
        setStats(prev => ({ ...prev, currentPrice: latest.close }));
      }
    } catch (err) {
      console.error('Error fetching candlesticks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chart');
    } finally {
      setLoading(false);
    }
  }, [conditionId, timeframe]);

  // Fetch additional market stats
  const fetchMarketStats = useCallback(async () => {
    if (!marketUrl) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('market-dashboard', {
        body: { marketUrl } // Fixed: use marketUrl not url
      });
      
      if (!error && data) {
        const orderbook = data.orderbook || {};
        const tradeStats = data.tradeStats || {};
        const market = data.market || {};
        
        // Calculate spread from orderbook
        const bestAsk = orderbook.asks?.[0]?.price;
        const bestBid = orderbook.bids?.[0]?.price;
        const spread = bestAsk && bestBid ? ((bestAsk - bestBid) * 100) : null;
        
        // Calculate liquidity from orderbook totals if not in market data
        const liquidity = market.liquidity || 
          ((orderbook.bidTotal || 0) + (orderbook.askTotal || 0)) || null;
        
        setStats(prev => ({
          ...prev,
          volume24h: tradeStats.totalVolume24h || tradeStats.volume24h || market.volume24h || null,
          liquidity: liquidity,
          spread: spread
        }));
      }
    } catch (err) {
      console.error('Error fetching market stats:', err);
    }
  }, [marketUrl]);

  useEffect(() => {
    fetchCandlesticks();
    fetchMarketStats();
  }, [fetchCandlesticks, fetchMarketStats]);

  // Create chart
  useEffect(() => {
    if (!chartContainerRef.current || candlesticks.length === 0) return;
    
    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#a1a1aa',
        fontFamily: 'inherit',
      },
      grid: {
        vertLines: { color: '#27272a' },
        horzLines: { color: '#27272a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 280,
      rightPriceScale: {
        borderColor: '#3f3f46',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#3f3f46',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: '#71717a', width: 1, style: 2, labelBackgroundColor: '#18181b' },
        horzLine: { color: '#71717a', width: 1, style: 2, labelBackgroundColor: '#18181b' },
      },
    });
    
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    
    candlestickSeries.setData(candlesticks);
    chart.timeScale().fitContent();
    
    chartRef.current = chart;
    
    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candlesticks]);

  const handleTrade = (side: 'YES' | 'NO') => {
    setLoadingSide(side);
    setTimeout(() => {
      onTrade(side);
      setLoadingSide(null);
    }, 150);
  };

  const formatVolume = (vol: number | null) => {
    if (vol === null || vol === undefined) return '—';
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const formatPercent = (val: number | null) => {
    if (val === null || val === undefined) return '—';
    return `${val.toFixed(1)}%`;
  };

  const formatSpread = (val: number | null) => {
    if (val === null || val === undefined) return '—';
    return `${val.toFixed(2)}%`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col h-full max-h-[85vh] sm:max-h-[80vh]"
    >
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-xl border-b border-border p-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        {image ? (
          <img 
            src={image} 
            alt={title}
            className="w-10 h-10 rounded-xl object-cover shrink-0"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-foreground line-clamp-2 leading-tight">
            {title}
          </h2>
          {stats.currentPrice !== null && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                "text-lg font-bold",
                stats.currentPrice >= 50 ? "text-success" : "text-destructive"
              )}>
                {formatPercent(stats.currentPrice)}
              </span>
              <span className="text-xs text-muted-foreground">YES</span>
            </div>
          )}
        </div>
        
        {!isMobile && (
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {/* Timeframe Tabs */}
        <div className="flex items-center justify-center gap-1 p-1 bg-muted/30 rounded-xl w-fit mx-auto">
          {(['1H', '1D', '7D', '30D', 'ALL'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                timeframe === tf 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Chart Container */}
        <div className="rounded-2xl border border-border/50 bg-muted/10 overflow-hidden">
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="h-[280px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <BarChart3 className="w-8 h-8" />
              <span className="text-sm">{error}</span>
              <Button variant="outline" size="sm" onClick={fetchCandlesticks}>
                Retry
              </Button>
            </div>
          ) : candlesticks.length === 0 ? (
            <div className="h-[280px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <BarChart3 className="w-8 h-8" />
              <span className="text-sm">No chart data available</span>
            </div>
          ) : (
            <div ref={chartContainerRef} className="w-full" />
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl p-3 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 text-center">
            <div className="flex items-center justify-center gap-1 text-primary mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs text-muted-foreground mb-0.5">Price</div>
            <div className="font-bold text-sm">{formatPercent(stats.currentPrice)}</div>
          </div>
          
          <div className="rounded-xl p-3 bg-muted/20 border border-border/30 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs text-muted-foreground mb-0.5">24h Vol</div>
            <div className="font-bold text-sm">{formatVolume(stats.volume24h)}</div>
          </div>
          
          <div className="rounded-xl p-3 bg-muted/20 border border-border/30 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Droplet className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs text-muted-foreground mb-0.5">Liquidity</div>
            <div className="font-bold text-sm">{formatVolume(stats.liquidity)}</div>
          </div>
          
          <div className="rounded-xl p-3 bg-muted/20 border border-border/30 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs text-muted-foreground mb-0.5">Spread</div>
            <div className="font-bold text-sm">{formatSpread(stats.spread)}</div>
          </div>
        </div>

        {/* Quick Info Card */}
        <div className="rounded-xl p-4 bg-gradient-to-br from-muted/30 to-muted/10 border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Market Chart</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Real-time candlestick data showing price movements. Green candles indicate price increases, red candles indicate decreases.
          </p>
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-card via-card to-card/95 border-t border-border/50 backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Button
            className={cn(
              "h-14 gap-2 font-bold rounded-xl transition-all",
              "bg-success/20 border border-success/40 text-success hover:bg-success/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            )}
            onClick={() => handleTrade('YES')}
            disabled={loadingSide !== null}
          >
            {loadingSide === 'YES' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <TrendingUp className="w-5 h-5" />
                BUY YES
              </>
            )}
          </Button>
          
          <Button
            className={cn(
              "h-14 gap-2 font-bold rounded-xl transition-all",
              "bg-destructive/20 border border-destructive/40 text-destructive hover:bg-destructive/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]"
            )}
            onClick={() => handleTrade('NO')}
            disabled={loadingSide !== null}
          >
            {loadingSide === 'NO' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <TrendingDown className="w-5 h-5" />
                BUY NO
              </>
            )}
          </Button>
        </div>
        
        <Button
          variant="outline"
          className="w-full h-11 gap-2 font-semibold rounded-xl border-border/50 hover:border-secondary/50 hover:bg-secondary/10"
          onClick={onAnalyze}
        >
          <Sparkles className="w-4 h-4" />
          Analyze Market
        </Button>
      </div>
    </motion.div>
  );
}
