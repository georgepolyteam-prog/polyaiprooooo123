import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface WhaleTrade {
  id: string;
  amount: number;
  side: "BUY" | "SELL";
  market: string;
  timestamp: Date;
}

const DISMISS_KEY = "whaleTickerDismissed";
const DISMISS_DURATION = 3600000; // 1 hour

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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isDismissed) return;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket("wss://data.dfrn.io/ws/v1/trades");
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("WhaleTicker: WebSocket connected");
          setIsConnected(true);
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
            
            if (msg.type === "trade" || msg.data?.type === "trade") {
              const tradeData = msg.data || msg;
              const amount = parseFloat(tradeData.amount || tradeData.size || "0");
              
              if (amount >= 1000) {
                const newTrade: WhaleTrade = {
                  id: `${Date.now()}-${Math.random()}`,
                  amount,
                  side: tradeData.side?.toUpperCase() === "SELL" ? "SELL" : "BUY",
                  market: tradeData.market_title || tradeData.market || tradeData.question?.slice(0, 40) || "Market",
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
          setIsConnected(false);
          ws.close();
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
        };
      } catch {
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [isDismissed]);

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
    if (amount >= 10000) return `$${(amount / 1000).toFixed(0)}k`;
    return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h`;
  };

  const displayTrades = trades.length > 0 ? [...trades, ...trades, ...trades] : [];

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative overflow-hidden cursor-pointer group"
          onClick={() => navigate("/live-trades")}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Animated gradient background */}
          <div className="absolute inset-0 whale-ticker-bg" />
          
          {/* Animated border glow */}
          <div className="absolute inset-x-0 bottom-0 h-[1px] whale-ticker-border" />
          
          {/* Scan line effect */}
          <div className="absolute inset-0 whale-ticker-scanline pointer-events-none" />

          <div className="relative flex items-center h-10 md:h-9">
            {/* Live badge - Premium glassmorphism */}
            <div className="flex-shrink-0 flex items-center gap-2 px-3 md:px-4 h-full whale-ticker-badge border-r border-red-500/30">
              {/* Pulsing live indicator */}
              <span className="relative flex h-2 w-2 md:h-2.5 md:w-2.5">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-red-500 animate-ping' : 'bg-yellow-500'}`} />
                <span className={`relative inline-flex rounded-full h-full w-full ${isConnected ? 'bg-red-500 whale-ticker-dot-glow' : 'bg-yellow-500'}`} />
              </span>
              <span className="hidden md:inline text-[10px] font-black tracking-[0.2em] text-red-400 uppercase">
                Breaking
              </span>
              <span className="md:hidden text-[10px] font-black tracking-wider text-red-400">
                LIVE
              </span>
            </div>

            {/* Scrolling content area */}
            <div className="flex-1 overflow-hidden mx-2 md:mx-0">
              {trades.length > 0 ? (
                <div 
                  className={`flex whitespace-nowrap ${isPaused ? '' : 'animate-marquee'}`}
                  style={{ 
                    animationDuration: `${Math.max(20, trades.length * 8)}s`,
                    animationPlayState: isPaused ? 'paused' : 'running'
                  }}
                >
                  {displayTrades.map((trade, idx) => (
                    <div
                      key={`${trade.id}-${idx}`}
                      className="inline-flex items-center gap-1.5 md:gap-2 px-4 md:px-6 text-xs md:text-sm"
                    >
                      {/* Whale emoji with glow */}
                      <span className="text-base md:text-lg whale-emoji">🐋</span>
                      
                      {/* Amount with color-coded glow */}
                      <span className={`font-black tracking-tight ${
                        trade.side === "BUY" 
                          ? "text-emerald-400 whale-amount-buy" 
                          : "text-red-400 whale-amount-sell"
                      }`}>
                        {formatAmount(trade.amount)}
                      </span>
                      
                      {/* Side badge */}
                      <span className={`text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded ${
                        trade.side === "BUY" 
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}>
                        {trade.side}
                      </span>
                      
                      {/* Market name */}
                      <span className="text-orange-200/80 truncate max-w-[120px] md:max-w-[200px] font-medium">
                        {trade.market}
                      </span>
                      
                      {/* Time ago */}
                      <span className="text-orange-400/40 text-[10px] md:text-xs tabular-nums">
                        {formatTimeAgo(trade.timestamp)}
                      </span>
                      
                      {/* Separator */}
                      <span className="text-orange-500/30 mx-2">•</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 md:gap-3 px-2 md:px-4 text-xs md:text-sm">
                  <motion.div
                    className="flex items-center gap-2"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <span className="text-base">🔍</span>
                    <span className="text-orange-300/70 font-medium">
                      Scanning for whale trades ($1k+)
                    </span>
                  </motion.div>
                  <span className="hidden md:inline text-orange-400/40 text-xs">
                    Live feed from Polymarket
                  </span>
                </div>
              )}
            </div>

            {/* Click hint - desktop only */}
            <div className="hidden md:flex flex-shrink-0 items-center px-3 text-[10px] text-orange-400/50 group-hover:text-orange-300 transition-colors font-medium tracking-wide">
              VIEW ALL →
            </div>

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 flex items-center justify-center w-8 h-full md:w-10 hover:bg-red-500/20 transition-colors border-l border-red-500/20"
              aria-label="Dismiss whale alerts"
            >
              <X className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-400/60 hover:text-orange-300 transition-colors" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
