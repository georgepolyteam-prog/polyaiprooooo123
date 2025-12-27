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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket("wss://ws-subscriptions-clob.polymarket.com/ws/market");
        wsRef.current = ws;

        ws.onopen = () => {
          // Subscribe to all markets
          ws.send(JSON.stringify({
            type: "Market",
            assets_ids: []
          }));
        };

        ws.onmessage = (event) => {
          try {
            const messages = JSON.parse(event.data);
            const msgArray = Array.isArray(messages) ? messages : [messages];

            msgArray.forEach((msg: any) => {
              if (msg.event_type === "trade" || msg.price) {
                const size = parseFloat(msg.size || msg.count || "0");
                const price = parseFloat(msg.price || "0");
                const amount = size * price;

                // Only show whale trades ($1,000+)
                if (amount >= 1000) {
                  const newTrade: WhaleTrade = {
                    id: `${Date.now()}-${Math.random()}`,
                    amount,
                    side: msg.side?.toUpperCase() === "SELL" ? "SELL" : "BUY",
                    market: msg.market || msg.asset_id?.slice(0, 12) || "Unknown Market",
                    timestamp: new Date()
                  };

                  setTrades(prev => {
                    const updated = [newTrade, ...prev].slice(0, 20);
                    return updated;
                  });
                }
              }
            });
          } catch (e) {
            // Silent parse error
          }
        };

        ws.onerror = () => {
          ws.close();
        };

        ws.onclose = () => {
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

  // Don't render if no trades yet
  if (trades.length === 0) {
    return null;
  }

  // Duplicate trades for seamless loop
  const displayTrades = [...trades, ...trades];

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
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-xs font-bold text-red-300 tracking-wider">WHALE ALERTS</span>
        </div>

        {/* Scrolling content */}
        <div className="flex-1 overflow-hidden">
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
        </div>

        {/* Click hint */}
        <div className="flex-shrink-0 px-4 text-xs text-orange-400/60 group-hover:text-orange-300 transition-colors">
          Click to view →
        </div>
      </div>
    </div>
  );
}