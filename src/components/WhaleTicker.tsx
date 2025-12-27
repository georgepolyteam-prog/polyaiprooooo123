import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Activity, Zap, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WhaleTrade {
  id: string;
  amount: number;
  side: "BUY" | "SELL";
  market: string;
  timestamp: Date;
}

type FilterType = 'ALL' | 'BUYS' | 'SELLS';

const DISMISS_KEY = "liveTickerDismissed";
const DISMISS_DURATION = 3600000; // 1 hour
const WHALE_THRESHOLD = 1000; // $1k+ shows whale emoji
const FILTER_KEY = "liveTickerFilter";
const TRADE_CAP = 50;
const FLUSH_INTERVAL = 500;

export function WhaleTicker() {
  const [trades, setTrades] = useState<WhaleTrade[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [filter, setFilter] = useState<FilterType>(() => {
    try {
      return (localStorage.getItem(FILTER_KEY) as FilterType) || 'ALL';
    } catch {
      return 'ALL';
    }
  });
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      const saved = localStorage.getItem(DISMISS_KEY);
      if (saved) {
        const { timestamp } = JSON.parse(saved);
        return Date.now() - timestamp < DISMISS_DURATION;
      }
    } catch {
      // Ignore localStorage errors
    }
    return false;
  });
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [, setTick] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const wsUrlRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tradeQueueRef = useRef<WhaleTrade[]>([]);
  const flushIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  // Force re-render every 30 seconds to update timestamps
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Persist filter to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, filter);
    } catch {
      // Ignore localStorage errors
    }
  }, [filter]);

  // Batch flush trades from queue into state
  useEffect(() => {
    flushIntervalRef.current = setInterval(() => {
      if (tradeQueueRef.current.length > 0) {
        setTrades(prev => {
          const newTrades = [...tradeQueueRef.current, ...prev];
          tradeQueueRef.current = [];
          const seen = new Set<string>();
          const unique = newTrades.filter(t => {
            if (seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
          });
          return unique.slice(0, TRADE_CAP);
        });
      }
    }, FLUSH_INTERVAL);

    return () => {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
      }
    };
  }, []);

  const connectWebSocket = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      if (!wsUrlRef.current) {
        const { data, error } = await supabase.functions.invoke('dome-ws-url');
        if (error || !data?.wsUrl) {
          console.error('WhaleTicker: Failed to get WebSocket URL:', error);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
          return;
        }
        wsUrlRef.current = data.wsUrl;
      }

      const ws = new WebSocket(wsUrlRef.current);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WhaleTicker: Connected to Dome WebSocket");
        setIsConnected(true);
        
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
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'event') {
            const rawTrade = msg.data;
            const volume = rawTrade.price * (rawTrade.shares_normalized || rawTrade.shares);
            
            if (volume >= 100) {
              const newTrade: WhaleTrade = {
                id: `${Date.now()}-${Math.random()}`,
                amount: volume,
                side: rawTrade.side?.toUpperCase() === "SELL" ? "SELL" : "BUY",
                market: rawTrade.title?.slice(0, 50) || rawTrade.market_slug || "Market",
                timestamp: new Date()
              };

              tradeQueueRef.current.push(newTrade);
            }
          }
        } catch {
          // Silent parse error
        }
      };

      ws.onerror = () => {
        console.error("WhaleTicker: WebSocket error");
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log("WhaleTicker: WebSocket closed, code:", event.code);
        setIsConnected(false);
        wsRef.current = null;
        
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        }
      };
    } catch (err) {
      console.error("WhaleTicker: Connection error:", err);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
    }
  }, []);

  useEffect(() => {
    if (isDismissed) return;

    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close(1000);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [isDismissed, connectWebSocket]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify({ timestamp: Date.now() }));
    } catch {
      // Ignore localStorage errors
    }
  };

  const formatAmount = (amount: number) => {
    if (amount >= 10000) return `$${(amount / 1000).toFixed(1)}k`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
    return `$${amount.toFixed(0)}`;
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h`;
  };

  // Filter trades based on selection
  const filteredTrades = trades.filter(trade => {
    if (filter === 'BUYS') return trade.side === 'BUY';
    if (filter === 'SELLS') return trade.side === 'SELL';
    return true;
  });

  // Triple trades for seamless marquee loop
  const displayTrades = filteredTrades.length > 0 
    ? [...filteredTrades, ...filteredTrades, ...filteredTrades] 
    : [];

  const marqueeDuration = Math.max(25, Math.min(60, filteredTrades.length * 3));
  
  // Calculate trades per minute
  const recentTrades = trades.filter(t => Date.now() - t.timestamp.getTime() < 60000);
  const tradesPerMin = recentTrades.length;

  if (isDismissed) return null;

  return (
    <>
      {/* Desktop: Full premium ticker */}
      <AnimatePresence>
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="hidden md:block fixed top-16 left-0 right-0 z-40"
        >
          {/* Premium glassmorphism background */}
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/90 to-background/95 backdrop-blur-xl border-b border-primary/10" />
          
          {/* Animated accent glow */}
          <div className="absolute inset-x-0 bottom-0 h-px">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-pulse" />
          </div>
          
          {/* Subtle scan line effect */}
          <div className="absolute inset-0 opacity-[0.02] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.03)_2px,rgba(255,255,255,0.03)_4px)] pointer-events-none" />

          <div className="relative flex items-center h-10">
            {/* Premium live badge */}
            <div className="flex-shrink-0 flex items-center gap-2 px-4 h-full bg-gradient-to-r from-primary/10 to-transparent border-r border-primary/20">
              {/* Animated live dot */}
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-red-500 animate-ping' : 'bg-muted-foreground'}`} />
                <span className={`relative inline-flex rounded-full h-full w-full ${isConnected ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-muted-foreground'}`} />
              </span>
              
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-bold tracking-wider text-foreground">
                  LIVE
                </span>
              </div>
              
              {/* Filter pills */}
              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-primary/20">
                {(['ALL', 'BUYS', 'SELLS'] as FilterType[]).map((f) => (
                  <button
                    key={f}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilter(f);
                    }}
                    className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all duration-200 ${
                      filter === f 
                        ? f === 'BUYS' 
                          ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                          : f === 'SELLS'
                            ? 'bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                            : 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(139,92,246,0.2)]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrolling trades area */}
            <div 
              className="flex-1 overflow-hidden cursor-pointer"
              onClick={() => navigate("/live-trades")}
            >
              {filteredTrades.length > 0 ? (
                <div 
                  className="flex whitespace-nowrap animate-marquee-continuous"
                  style={{ 
                    '--marquee-duration': `${marqueeDuration}s`
                  } as React.CSSProperties}
                >
                  {displayTrades.map((trade, idx) => (
                    <div
                      key={`${trade.id}-${idx}`}
                      className={`inline-flex items-center gap-2 px-4 py-1 mx-1 rounded-lg transition-all ${
                        trade.amount >= WHALE_THRESHOLD 
                          ? 'bg-gradient-to-r from-primary/10 to-transparent border border-primary/20' 
                          : ''
                      }`}
                    >
                      {/* Whale emoji with glow for big trades */}
                      {trade.amount >= WHALE_THRESHOLD && (
                        <span className="text-base drop-shadow-[0_0_4px_rgba(139,92,246,0.5)]">🐋</span>
                      )}
                      
                      {/* Amount with gradient text for big trades */}
                      <span className={`font-bold tabular-nums text-sm ${
                        trade.amount >= WHALE_THRESHOLD
                          ? trade.side === "BUY" 
                            ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]" 
                            : "text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.4)]"
                          : trade.side === "BUY" 
                            ? "text-emerald-400" 
                            : "text-red-400"
                      }`}>
                        {formatAmount(trade.amount)}
                      </span>
                      
                      {/* Side badge with glow */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        trade.side === "BUY" 
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                          : "bg-red-500/15 text-red-400 border border-red-500/30"
                      }`}>
                        {trade.side}
                      </span>
                      
                      {/* Market name */}
                      <span className="text-muted-foreground text-xs truncate max-w-[200px]">
                        {trade.market}
                      </span>
                      
                      {/* Time */}
                      <span className="text-muted-foreground/40 text-[10px] tabular-nums">
                        {formatTimeAgo(trade.timestamp)}
                      </span>
                      
                      {/* Separator dot */}
                      <span className="text-primary/30 mx-2">•</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 text-sm">
                  <motion.div
                    className="flex items-center gap-2"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Activity className="w-4 h-4 text-primary/60" />
                    <span className="text-muted-foreground">
                      Waiting for live trades...
                    </span>
                  </motion.div>
                </div>
              )}
            </div>

            {/* Stats & actions */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 border-l border-primary/20">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="w-3.5 h-3.5 text-primary/60" />
                <span className="tabular-nums font-medium">{tradesPerMin}/min</span>
              </div>
              
              <button
                onClick={handleDismiss}
                className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-muted/50 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Mobile: Compact floating pill */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.2 }}
          className="md:hidden fixed bottom-20 right-3 z-40"
        >
          <motion.div
            layout
            className={`bg-background/95 backdrop-blur-xl border border-primary/20 shadow-[0_0_20px_rgba(0,0,0,0.3),0_0_40px_rgba(139,92,246,0.1)] rounded-2xl overflow-hidden ${
              mobileExpanded ? 'w-72' : 'w-auto'
            }`}
          >
            {/* Collapsed: Simple pill */}
            <button
              onClick={() => setMobileExpanded(!mobileExpanded)}
              className="flex items-center gap-2 px-3 py-2 w-full"
            >
              {/* Live dot */}
              <span className="relative flex h-1.5 w-1.5">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-red-500 animate-ping' : 'bg-muted-foreground'}`} />
                <span className={`relative inline-flex rounded-full h-full w-full ${isConnected ? 'bg-red-500' : 'bg-muted-foreground'}`} />
              </span>
              
              <span className="text-xs font-bold text-foreground">🐋</span>
              <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                {tradesPerMin}/min
              </span>
              
              <ChevronUp className={`w-3 h-3 text-muted-foreground transition-transform ${mobileExpanded ? '' : 'rotate-180'}`} />
            </button>

            {/* Expanded: Show recent trades */}
            <AnimatePresence>
              {mobileExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-primary/10"
                >
                  {/* Quick filters */}
                  <div className="flex items-center gap-1 p-2 border-b border-primary/10">
                    {(['ALL', 'BUYS', 'SELLS'] as FilterType[]).map((f) => (
                      <button
                        key={f}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilter(f);
                        }}
                        className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${
                          filter === f 
                            ? f === 'BUYS' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : f === 'SELLS'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-primary/20 text-primary'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  
                  {/* Recent trades list */}
                  <div className="max-h-40 overflow-y-auto">
                    {filteredTrades.slice(0, 5).map((trade) => (
                      <div
                        key={trade.id}
                        className="flex items-center gap-2 px-3 py-2 border-b border-primary/5 last:border-0"
                        onClick={() => navigate("/live-trades")}
                      >
                        {trade.amount >= WHALE_THRESHOLD && (
                          <span className="text-sm">🐋</span>
                        )}
                        <span className={`font-bold text-xs tabular-nums ${
                          trade.side === "BUY" ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {formatAmount(trade.amount)}
                        </span>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                          trade.side === "BUY" 
                            ? "bg-emerald-500/10 text-emerald-400" 
                            : "bg-red-500/10 text-red-400"
                        }`}>
                          {trade.side}
                        </span>
                        <span className="text-muted-foreground text-[10px] truncate flex-1">
                          {trade.market}
                        </span>
                        <span className="text-muted-foreground/40 text-[9px]">
                          {formatTimeAgo(trade.timestamp)}
                        </span>
                      </div>
                    ))}
                    
                    {filteredTrades.length === 0 && (
                      <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                        <Activity className="w-4 h-4" />
                        <span>Waiting for trades...</span>
                      </div>
                    )}
                  </div>
                  
                  {/* View all button */}
                  <button
                    onClick={() => navigate("/live-trades")}
                    className="w-full px-3 py-2 text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors border-t border-primary/10"
                  >
                    View All Trades →
                  </button>
                  
                  {/* Dismiss */}
                  <button
                    onClick={handleDismiss}
                    className="w-full px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Dismiss for 1 hour
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
