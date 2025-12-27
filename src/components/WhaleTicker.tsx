import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface WhaleTrade {
  id: string;
  amount: number;
  side: "BUY" | "SELL";
  market: string;
  timestamp: Date;
}

export function WhaleTicker() {
  const [trades, setTrades] = useState<WhaleTrade[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        // Use Dome's WebSocket for real-time trades (same as LiveTrades)
        const ws = new WebSocket("wss://data.dfrn.io/ws/v1/trades");
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("WhaleTicker: WebSocket connected");
          setIsConnected(true);
          // Subscribe to all Polymarket trades
          ws.send(JSON.stringify({
            action: "subscribe",
            data: {
              channel: "trades",
              platform: "polymarket"
            }
          }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            
            // Handle trade messages
            if (msg.type === "trade" || msg.data?.type === "trade") {
              const tradeData = msg.data || msg;
              const amount = parseFloat(tradeData.amount || tradeData.size || "0");
              
              // Only show whale trades ($1,000+)
              if (amount >= 1000) {
                const newTrade: WhaleTrade = {
                  id: `${Date.now()}-${Math.random()}`,
                  amount,
                  side: tradeData.side?.toUpperCase() === "SELL" ? "SELL" : "BUY",
                  market: tradeData.market_title || tradeData.market || tradeData.question?.slice(0, 40) || "Market",
                  timestamp: new Date()
                };

                setTrades(prev => {
                  const updated = [newTrade, ...prev].slice(0, 20);
                  return updated;
                });
              }
            }
          } catch (e) {
            // Silent parse error
          }
        };

        ws.onerror = () => {
          setIsConnected(false);
          ws.close();
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
        };
      } catch (e) {
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const formatAmount = (amount: number) => {
    if (amount >= 10000) return `$${(amount / 1000).toFixed(0)}k`;
    return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  // Duplicate trades for seamless loop
  const displayTrades = trades.length > 0 ? [...trades, ...trades] : [];

  return (
    <div
      className="hidden md:block relative overflow-hidden cursor-pointer group"
      onClick={() => navigate("/live-trades")}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background with glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-950/90 via-orange-950/80 to-red-950/90 border-b border-orange-500/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--destructive)/0.15)_0%,_transparent_70%)]" />
      
      {/* Animated glow effect */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            "linear-gradient(90deg, transparent 0%, hsl(var(--destructive)) 50%, transparent 100%)",
            "linear-gradient(90deg, hsl(var(--destructive)) 0%, transparent 50%, hsl(var(--destructive)) 100%)",
          ]
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative flex items-center h-9">
        {/* Live badge */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 bg-red-900/50 border-r border-orange-500/30 h-full">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-red-400' : 'bg-yellow-400'} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-red-500' : 'bg-yellow-500'}`} />
          </span>
          <span className="text-xs font-bold text-red-300 tracking-wider">🐋 WHALE ALERTS</span>
        </div>

        {/* Scrolling content */}
        <div className="flex-1 overflow-hidden">
          {trades.length > 0 ? (
            <motion.div
              className="flex whitespace-nowrap"
              animate={{
                x: isPaused ? 0 : [0, -50 * trades.length]
              }}
              transition={{
                x: {
                  duration: trades.length * 4,
                  repeat: Infinity,
                  ease: "linear"
                }
              }}
            >
              {displayTrades.map((trade, idx) => (
                <div
                  key={`${trade.id}-${idx}`}
                  className="inline-flex items-center gap-2 px-6 text-sm"
                >
                  <span className="text-lg">🐋</span>
                  <span className={trade.side === "BUY" 
                    ? "font-bold text-emerald-400" 
                    : "font-bold text-red-400"
                  }>
                    {formatAmount(trade.amount)}
                  </span>
                  <span className={trade.side === "BUY" 
                    ? "text-emerald-500 font-medium" 
                    : "text-red-500 font-medium"
                  }>
                    {trade.side}
                  </span>
                  <span className="text-orange-200/70 truncate max-w-[200px]">
                    on {trade.market}
                  </span>
                  <span className="text-orange-400/50 text-xs">
                    • {formatTimeAgo(trade.timestamp)}
                  </span>
                </div>
              ))}
            </motion.div>
          ) : (
            <div className="flex items-center gap-3 px-6 text-sm text-orange-300/70">
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Monitoring for whale trades ($1k+)...
              </motion.span>
              <span className="text-orange-400/50">Live feed from Polymarket</span>
            </div>
          )}
        </div>

        {/* Click hint */}
        <div className="flex-shrink-0 px-4 text-xs text-orange-400/60 group-hover:text-orange-300 transition-colors">
          Click to view →
        </div>
      </div>
    </div>
  );
}