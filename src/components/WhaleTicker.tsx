import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WhaleTrade {
  id: string;
  amount: number;
  side: "BUY" | "SELL";
  market: string;
  timestamp: Date;
}

const DISMISS_KEY = "whaleTickerDismissed";
const DISMISS_DURATION = 3600000; // 1 hour
const WHALE_THRESHOLD = 1000; // $1k+

export function WhaleTicker() {
  const [trades, setTrades] = useState<WhaleTrade[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
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
  const wsRef = useRef<WebSocket | null>(null);
  const wsUrlRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  const connectWebSocket = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      // Get authenticated Dome WebSocket URL
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
        
        // Subscribe to Polymarket orders (same as LiveTrades)
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
            
            // Calculate volume same as LiveTrades whale filter
            const volume = rawTrade.price * (rawTrade.shares_normalized || rawTrade.shares);
            
            // Only show whale trades ($1k+)
            if (volume >= WHALE_THRESHOLD) {
              const newTrade: WhaleTrade = {
                id: `${Date.now()}-${Math.random()}`,
                amount: volume,
                side: rawTrade.side?.toUpperCase() === "SELL" ? "SELL" : "BUY",
                market: rawTrade.title?.slice(0, 50) || rawTrade.market_slug || "Market",
                timestamp: new Date()
              };

              setTrades(prev => [newTrade, ...prev].slice(0, 20));
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
        
        // Reconnect unless intentionally closed
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
    return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h`;
  };

  // Triple trades for seamless marquee loop
  const displayTrades = trades.length > 0 ? [...trades, ...trades, ...trades] : [];

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-16 left-0 right-0 z-40 cursor-pointer group"
          onClick={() => navigate("/live-trades")}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Professional dark background with subtle glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background border-b border-border/50" />
          
          {/* Subtle animated accent line */}
          <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          <div className="relative flex items-center h-9 md:h-8">
            {/* Live badge - Clean professional style */}
            <div className="flex-shrink-0 flex items-center gap-2 px-3 md:px-4 h-full bg-primary/5 border-r border-border/30">
              {/* Live indicator */}
              <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-primary animate-ping' : 'bg-muted-foreground'}`} />
                <span className={`relative inline-flex rounded-full h-full w-full ${isConnected ? 'bg-primary' : 'bg-muted-foreground'}`} />
              </span>
              <Zap className="w-3 h-3 text-primary hidden md:block" />
              <span className="text-[10px] font-semibold tracking-wide text-primary uppercase">
                Whales
              </span>
            </div>

            {/* Scrolling content area */}
            <div className="flex-1 overflow-hidden mx-2 md:mx-0">
              {trades.length > 0 ? (
                <div 
                  className={`flex whitespace-nowrap ${isPaused ? '' : 'animate-marquee'}`}
                  style={{ 
                    animationDuration: `${Math.max(25, trades.length * 10)}s`,
                    animationPlayState: isPaused ? 'paused' : 'running'
                  }}
                >
                  {displayTrades.map((trade, idx) => (
                    <div
                      key={`${trade.id}-${idx}`}
                      className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-5 text-xs"
                    >
                      {/* Whale emoji */}
                      <span className="text-sm md:text-base opacity-80">🐋</span>
                      
                      {/* Amount with subtle color */}
                      <span className={`font-semibold tabular-nums ${
                        trade.side === "BUY" 
                          ? "text-emerald-400" 
                          : "text-red-400"
                      }`}>
                        {formatAmount(trade.amount)}
                      </span>
                      
                      {/* Side badge - minimal */}
                      <span className={`text-[9px] md:text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        trade.side === "BUY" 
                          ? "bg-emerald-500/10 text-emerald-400" 
                          : "bg-red-500/10 text-red-400"
                      }`}>
                        {trade.side}
                      </span>
                      
                      {/* Market name */}
                      <span className="text-muted-foreground truncate max-w-[100px] md:max-w-[180px]">
                        {trade.market}
                      </span>
                      
                      {/* Time ago */}
                      <span className="text-muted-foreground/50 text-[10px] tabular-nums">
                        {formatTimeAgo(trade.timestamp)}
                      </span>
                      
                      {/* Separator */}
                      <span className="text-border mx-1 md:mx-2">•</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2 md:px-4 text-xs">
                  <motion.div
                    className="flex items-center gap-2"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <span className="text-sm">🔍</span>
                    <span className="text-muted-foreground">
                      Scanning for whale trades ($1k+)
                    </span>
                  </motion.div>
                  <span className="hidden md:inline text-muted-foreground/50 text-[10px]">
                    Powered by Dome API
                  </span>
                </div>
              )}
            </div>

            {/* View all hint - desktop only */}
            <div className="hidden md:flex flex-shrink-0 items-center px-3 text-[10px] text-muted-foreground/60 group-hover:text-primary transition-colors font-medium">
              VIEW ALL →
            </div>

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 flex items-center justify-center w-8 h-full md:w-9 hover:bg-muted/50 transition-colors border-l border-border/30"
              aria-label="Dismiss whale alerts"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
