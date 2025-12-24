import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, TrendingUp, TrendingDown, Activity, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
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
  image?: string;
}

export default function LiveTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [queuedCount, setQueuedCount] = useState(0);
  const [newTradeIds, setNewTradeIds] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const pausedTradesRef = useRef<Trade[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wsUrlRef = useRef<string | null>(null);

  const connectWebSocket = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
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
        
        // Log all incoming data for debugging
        if (data.type === 'event') {
          const rawTrade = data.data;
          // Log first trade to see available fields including image
          console.log('Trade received:', Object.keys(rawTrade), rawTrade.image ? 'has image' : 'no image');
          
          // Map the trade data, including image if available
          const newTrade: Trade = {
            ...rawTrade,
            image: rawTrade.image || rawTrade.market_image || rawTrade.icon || null
          };
          const tradeId = newTrade.order_hash || `${newTrade.tx_hash}-${newTrade.timestamp}`;
          
          if (paused) {
            pausedTradesRef.current.unshift(newTrade);
            setQueuedCount(pausedTradesRef.current.length);
          } else {
            // Track new trade for highlight animation
            setNewTradeIds(prev => new Set([...prev, tradeId]));
            setTrades(prev => [newTrade, ...prev.slice(0, 99)]);
            
            // Remove highlight after 3 seconds
            setTimeout(() => {
              setNewTradeIds(prev => {
                const next = new Set(prev);
                next.delete(tradeId);
                return next;
              });
            }, 3000);
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected, code:', event.code, 'reason:', event.reason);
        setConnected(false);
        wsRef.current = null;
        // Reconnect after 2 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }, 2000);
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
      setTrades(prev => [...pausedTradesRef.current, ...prev].slice(0, 100));
      pausedTradesRef.current = [];
      setQueuedCount(0);
    }
    setPaused(!paused);
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
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}k`;
    return `$${volume.toFixed(2)}`;
  };

  const isWhale = (price: number, shares: number) => {
    return (price * shares) >= 1000;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar />
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-secondary/15 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <main className="flex-1 relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-1 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              Live Trade Feed
            </h1>
            <p className="text-muted-foreground text-sm">
              Real-time Polymarket activity • Powered by Dome
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${
              connected 
                ? 'bg-success/10 border-success/30 text-success' 
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
              <span className="font-medium">{connected ? 'Live' : 'Disconnected'}</span>
            </div>

            <Button
              onClick={togglePause}
              variant={paused ? "default" : "secondary"}
              className="gap-2 relative"
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {paused ? 'Resume' : 'Pause'}
              {paused && queuedCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {queuedCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Button
            onClick={() => setFilter('all')}
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
          >
            All Trades
          </Button>
          <Button
            onClick={() => setFilter('buy')}
            variant={filter === 'buy' ? 'default' : 'ghost'}
            size="sm"
            className={filter === 'buy' ? 'bg-success hover:bg-success/90' : ''}
          >
            <TrendingUp className="w-4 h-4 mr-1" />
            Buys
          </Button>
          <Button
            onClick={() => setFilter('sell')}
            variant={filter === 'sell' ? 'default' : 'ghost'}
            size="sm"
            className={filter === 'sell' ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            <TrendingDown className="w-4 h-4 mr-1" />
            Sells
          </Button>
          <div className="ml-auto text-sm text-muted-foreground">
            {filteredTrades.length} trades
          </div>
        </div>

        {/* Paused Banner */}
        {paused && queuedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-primary">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{queuedCount} new trades waiting</span>
            </div>
            <Button size="sm" onClick={togglePause} className="gap-1">
              <Play className="w-3 h-3" />
              Resume
            </Button>
          </motion.div>
        )}

        {/* Trades Feed - Table-like layout */}
        <div className="rounded-xl border border-border overflow-hidden bg-card/50 backdrop-blur-sm">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-5">Market</div>
            <div className="col-span-2">Side</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Volume</div>
            <div className="col-span-1 text-right">Time</div>
          </div>

          {/* Trades List */}
          <div className="divide-y divide-border/50">
            <AnimatePresence initial={false}>
              {filteredTrades.map((trade, index) => {
                const tradeId = trade.order_hash || `${trade.tx_hash}-${trade.timestamp}`;
                const isNew = newTradeIds.has(tradeId);
                const whale = isWhale(trade.price, trade.shares_normalized || trade.shares);
                
                return (
                  <motion.div
                    key={tradeId}
                    initial={{ opacity: 0, backgroundColor: 'hsl(var(--primary) / 0.2)' }}
                    animate={{ 
                      opacity: 1, 
                      backgroundColor: isNew ? 'hsl(var(--primary) / 0.1)' : 'transparent'
                    }}
                    transition={{ duration: 0.5 }}
                    onClick={() => setSelectedTrade(trade)}
                    className={`group grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer ${
                      whale ? 'bg-warning/5' : ''
                    }`}
                  >
                    {/* Market Info */}
                    <div className="sm:col-span-5 flex items-center gap-3 min-w-0">
                      {trade.image ? (
                        <img 
                          src={trade.image} 
                          alt="" 
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Activity className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-foreground font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {trade.title}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {trade.user.slice(0, 6)}...{trade.user.slice(-4)}
                        </div>
                      </div>
                      {whale && (
                        <span className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-bold bg-warning/20 text-warning rounded">
                          🐋 WHALE
                        </span>
                      )}
                    </div>

                    {/* Side */}
                    <div className="sm:col-span-2 flex items-center">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                        trade.side === 'BUY' 
                          ? 'bg-success/20 text-success' 
                          : 'bg-destructive/20 text-destructive'
                      }`}>
                        {trade.side === 'BUY' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {trade.side} {trade.token_label}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="sm:col-span-2 flex items-center sm:justify-end">
                      <span className="text-foreground font-mono font-semibold">
                        ${trade.price.toFixed(3)}
                      </span>
                    </div>

                    {/* Volume */}
                    <div className="sm:col-span-2 flex items-center sm:justify-end">
                      <span className={`font-mono font-bold ${whale ? 'text-warning' : 'text-primary'}`}>
                        {formatVolume(trade.price, trade.shares_normalized || trade.shares)}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="sm:col-span-1 flex items-center sm:justify-end">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(trade.timestamp)}
                      </span>
                    </div>

                    {/* Mobile: Show whale badge and external link */}
                    <div className="sm:hidden flex items-center justify-between">
                      {whale && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-warning/20 text-warning rounded">
                          🐋 WHALE
                        </span>
                      )}
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Empty State */}
        {filteredTrades.length === 0 && !loading && (
          <div className="text-center py-20">
            <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground text-lg">Waiting for trades...</p>
            <p className="text-muted-foreground/60 text-sm mt-2">
              {connected ? 'Connected to live feed' : 'Reconnecting...'}
            </p>
            {!connected && (
              <Button onClick={connectWebSocket} variant="outline" className="mt-4 gap-2">
                <RefreshCw className="w-4 h-4" />
                Reconnect
              </Button>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted-foreground">Connecting to live feed...</p>
          </div>
        )}
      </main>

      <Footer />

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
