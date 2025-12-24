import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, TrendingUp, TrendingDown, Activity, ExternalLink, RefreshCw } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Footer } from '@/components/Footer';
import { TradeDetailModal } from '@/components/trades/TradeDetailModal';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Trade {
  token_id: string;
  token_label: string;
  side: 'BUY' | 'SELL';
  market_slug: string;
  condition_id: string;
  shares: number;
  shares_normalized: number;
  price: number;
  tx_hash: string;
  title: string;
  timestamp: number;
  order_hash: string;
  user: string;
  taker: string;
}

export default function LiveTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const wsRef = useRef<WebSocket | null>(null);
  const pausedTradesRef = useRef<Trade[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wsUrlRef = useRef<string | null>(null);

  const connectWebSocket = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      // Get the WebSocket URL from edge function if we don't have it
      if (!wsUrlRef.current) {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke('dome-ws-url');
        
        if (error || !data?.wsUrl) {
          console.error('Failed to get WebSocket URL:', error);
          setError('Failed to connect to trade feed');
          setLoading(false);
          return;
        }
        wsUrlRef.current = data.wsUrl;
      }

      setLoading(false);
      setError(null);
      
      const ws = new WebSocket(wsUrlRef.current);

      ws.onopen = () => {
        console.log('WebSocket connected to Dome');
        setConnected(true);
        
        // Subscribe to ALL trades
        ws.send(JSON.stringify({
          action: "subscribe",
          platform: "polymarket",
          version: 1,
          type: "orders",
          filters: {
            users: ["*"]
          }
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'ack') {
          console.log('Subscription confirmed:', data.subscription_id);
        }
        
        if (data.type === 'event') {
          const newTrade = data.data;
          
          if (paused) {
            pausedTradesRef.current.unshift(newTrade);
          } else {
            setTrades(prev => [newTrade, ...prev.slice(0, 99)]);
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Error connecting to WebSocket:', err);
      setError('Failed to connect to trade feed');
      setLoading(false);
    }
  }, [paused]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  const togglePause = () => {
    if (paused) {
      // Resume: add paused trades to feed
      setTrades(prev => [...pausedTradesRef.current, ...prev].slice(0, 100));
      pausedTradesRef.current = [];
    }
    setPaused(!paused);
  };

  const handleMouseEnter = () => {
    if (!paused) setPaused(true);
  };

  const handleMouseLeave = () => {
    if (paused && pausedTradesRef.current.length > 0) {
      setTrades(prev => [...pausedTradesRef.current, ...prev].slice(0, 100));
      pausedTradesRef.current = [];
    }
    setPaused(false);
  };

  const filteredTrades = trades.filter(trade => {
    if (filter === 'all') return true;
    if (filter === 'buy') return trade.side === 'BUY';
    if (filter === 'sell') return trade.side === 'SELL';
    return true;
  });

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  const formatVolume = (price: number, shares: number) => {
    const volume = price * shares;
    if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}k`;
    }
    return `$${volume.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar />
      
      {/* Animated background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-secondary/15 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-accent/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <main className="flex-1 relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              Live Trade Feed
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Real-time Polymarket activity • Powered by Dome
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${
              connected 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'}`} />
              <span className="font-medium">{connected ? 'Live' : 'Disconnected'}</span>
            </div>

            {/* Pause/Resume Button */}
            <Button
              onClick={togglePause}
              variant={paused ? "default" : "secondary"}
              className="gap-2"
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {paused ? 'Resume' : 'Pause'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Button
            onClick={() => setFilter('all')}
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            className="gap-2"
          >
            All Trades
          </Button>
          <Button
            onClick={() => setFilter('buy')}
            variant={filter === 'buy' ? 'default' : 'ghost'}
            size="sm"
            className={`gap-2 ${filter === 'buy' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
          >
            <TrendingUp className="w-4 h-4" />
            Buys
          </Button>
          <Button
            onClick={() => setFilter('sell')}
            variant={filter === 'sell' ? 'default' : 'ghost'}
            size="sm"
            className={`gap-2 ${filter === 'sell' ? 'bg-destructive hover:bg-destructive/90' : ''}`}
          >
            <TrendingDown className="w-4 h-4" />
            Sells
          </Button>
          <div className="ml-auto text-sm text-muted-foreground">
            {filteredTrades.length} trades shown
          </div>
        </div>

        {/* Trades Feed */}
        <div 
          className="space-y-2"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <AnimatePresence mode="popLayout">
            {filteredTrades.map((trade, index) => (
              <motion.div
                key={`${trade.order_hash}-${index}`}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                onClick={() => setSelectedTrade(trade)}
                className="group relative glass-card rounded-xl p-4 sm:p-5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 cursor-pointer"
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/0 to-accent/0 group-hover:from-primary/5 group-hover:to-accent/5 transition-all duration-300" />

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Market Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-foreground font-semibold text-base sm:text-lg mb-1 truncate group-hover:text-primary transition-colors">
                      {trade.title}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="font-mono">{trade.user.slice(0, 6)}...{trade.user.slice(-4)}</span>
                      <span>•</span>
                      <span>{formatTime(trade.timestamp)}</span>
                    </div>
                  </div>

                  {/* Right: Trade Details */}
                  <div className="flex items-center gap-3 sm:gap-6">
                    {/* Side Badge */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm ${
                      trade.side === 'BUY' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-destructive/20 text-destructive border border-destructive/30'
                    }`}>
                      {trade.side === 'BUY' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {trade.side} {trade.token_label}
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      <div className="text-xl sm:text-2xl font-bold text-foreground">
                        ${trade.price.toFixed(3)}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {trade.shares_normalized?.toFixed(2) || trade.shares?.toFixed(2)} shares
                      </div>
                    </div>

                    {/* Volume */}
                    <div className="text-right min-w-[70px] sm:min-w-[90px]">
                      <div className="text-base sm:text-lg font-semibold text-primary">
                        {formatVolume(trade.price, trade.shares_normalized || trade.shares)}
                      </div>
                      <div className="text-xs text-muted-foreground">Volume</div>
                    </div>

                    {/* Arrow indicator */}
                    <div className="hidden sm:block text-primary group-hover:translate-x-1 transition-transform">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Pulse animation for new trades */}
                {index === 0 && !paused && (
                  <motion.div
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 2 }}
                    className="absolute inset-0 rounded-xl border-2 border-primary/50"
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredTrades.length === 0 && (
          <div className="text-center py-20">
            <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground text-lg">Waiting for trades...</p>
            <p className="text-muted-foreground/60 text-sm mt-2">
              {connected ? 'Connected to live feed' : 'Reconnecting...'}
            </p>
            {!connected && (
              <Button 
                onClick={connectWebSocket} 
                variant="outline" 
                className="mt-4 gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reconnect
              </Button>
            )}
          </div>
        )}
      </main>

      <Footer />

      {/* Trade Detail Modal */}
      <AnimatePresence>
        {selectedTrade && (
          <TradeDetailModal
            trade={selectedTrade}
            onClose={() => setSelectedTrade(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
