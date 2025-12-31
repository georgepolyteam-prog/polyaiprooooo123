import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDflowApi } from '@/hooks/useDflowApi';
import { useDflowWebSocket, type OrderbookUpdate } from '@/hooks/useDflowWebSocket';

interface OrderbookLevel {
  price: number;
  size: number;
}

interface KalshiOrderbookProps {
  ticker: string;
  compact?: boolean;
}

export function KalshiOrderbook({ ticker, compact = false }: KalshiOrderbookProps) {
  const { getOrderbook, loading } = useDflowApi();
  const [orderbook, setOrderbook] = useState<{
    yesBids: OrderbookLevel[];
    yesAsks: OrderbookLevel[];
    noBids: OrderbookLevel[];
    noAsks: OrderbookLevel[];
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // WebSocket for real-time updates
  useDflowWebSocket({
    tickers: [ticker],
    channels: ['orderbook'],
    onOrderbookUpdate: (update: OrderbookUpdate) => {
      if (update.ticker === ticker) {
        setOrderbook({
          yesBids: update.yesBids,
          yesAsks: update.yesAsks,
          noBids: update.noBids,
          noAsks: update.noAsks,
        });
      }
    },
  });

  // Initial fetch
  useEffect(() => {
    const fetchOrderbook = async () => {
      try {
        const data = await getOrderbook(ticker);
        if (data) {
          const parseLevel = (level: any): OrderbookLevel => ({
            price: Math.round((parseFloat(level.price) || 0) * 100),
            size: parseFloat(level.size || level.quantity || 0),
          });
          
          setOrderbook({
            yesBids: (data.yesBids || data.yes_bids || []).map(parseLevel).slice(0, 10),
            yesAsks: (data.yesAsks || data.yes_asks || []).map(parseLevel).slice(0, 10),
            noBids: (data.noBids || data.no_bids || []).map(parseLevel).slice(0, 10),
            noAsks: (data.noAsks || data.no_asks || []).map(parseLevel).slice(0, 10),
          });
        }
      } catch (err) {
        console.error('Failed to fetch orderbook:', err);
      }
    };

    fetchOrderbook();
  }, [ticker, getOrderbook]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await getOrderbook(ticker);
      if (data) {
        const parseLevel = (level: any): OrderbookLevel => ({
          price: Math.round((parseFloat(level.price) || 0) * 100),
          size: parseFloat(level.size || level.quantity || 0),
        });
        
        setOrderbook({
          yesBids: (data.yesBids || data.yes_bids || []).map(parseLevel).slice(0, 10),
          yesAsks: (data.yesAsks || data.yes_asks || []).map(parseLevel).slice(0, 10),
          noBids: (data.noBids || data.no_bids || []).map(parseLevel).slice(0, 10),
          noAsks: (data.noAsks || data.no_asks || []).map(parseLevel).slice(0, 10),
        });
      }
    } catch (err) {
      console.error('Failed to refresh orderbook:', err);
    }
    setRefreshing(false);
  };

  // Calculate max size for bar widths
  const maxSize = useMemo(() => {
    if (!orderbook) return 1;
    const allSizes = [
      ...orderbook.yesBids.map(l => l.size),
      ...orderbook.yesAsks.map(l => l.size),
    ];
    return Math.max(...allSizes, 1);
  }, [orderbook]);

  if (loading && !orderbook) {
    return (
      <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orderbook) {
    return null;
  }

  const displayLevels = compact ? 5 : 8;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl bg-muted/30 border border-border/50"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Order Book</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn(
            'w-4 h-4 text-muted-foreground',
            refreshing && 'animate-spin'
          )} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* YES Side */}
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-1">
            <span>Bid</span>
            <span className="text-emerald-400 font-medium">YES</span>
            <span>Ask</span>
          </div>
          
          <div className="space-y-1">
            {/* Bids */}
            {orderbook.yesBids.slice(0, displayLevels).map((level, idx) => (
              <div key={`bid-${idx}`} className="relative h-6">
                <div
                  className="absolute inset-y-0 right-0 bg-emerald-500/20 rounded-sm"
                  style={{ width: `${(level.size / maxSize) * 100}%` }}
                />
                <div className="relative flex justify-between items-center h-full px-2 text-xs">
                  <span className="font-mono text-emerald-400">{level.price}¢</span>
                  <span className="text-muted-foreground">{level.size.toFixed(0)}</span>
                </div>
              </div>
            ))}
            
            {/* Asks (reversed) */}
            {orderbook.yesAsks.slice(0, displayLevels).reverse().map((level, idx) => (
              <div key={`ask-${idx}`} className="relative h-6">
                <div
                  className="absolute inset-y-0 left-0 bg-red-500/20 rounded-sm"
                  style={{ width: `${(level.size / maxSize) * 100}%` }}
                />
                <div className="relative flex justify-between items-center h-full px-2 text-xs">
                  <span className="text-muted-foreground">{level.size.toFixed(0)}</span>
                  <span className="font-mono text-red-400">{level.price}¢</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NO Side */}
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-1">
            <span>Bid</span>
            <span className="text-red-400 font-medium">NO</span>
            <span>Ask</span>
          </div>
          
          <div className="space-y-1">
            {orderbook.noBids.slice(0, displayLevels).map((level, idx) => (
              <div key={`no-bid-${idx}`} className="relative h-6">
                <div
                  className="absolute inset-y-0 right-0 bg-red-500/20 rounded-sm"
                  style={{ width: `${(level.size / maxSize) * 100}%` }}
                />
                <div className="relative flex justify-between items-center h-full px-2 text-xs">
                  <span className="font-mono text-red-400">{level.price}¢</span>
                  <span className="text-muted-foreground">{level.size.toFixed(0)}</span>
                </div>
              </div>
            ))}
            
            {orderbook.noAsks.slice(0, displayLevels).reverse().map((level, idx) => (
              <div key={`no-ask-${idx}`} className="relative h-6">
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-500/20 rounded-sm"
                  style={{ width: `${(level.size / maxSize) * 100}%` }}
                />
                <div className="relative flex justify-between items-center h-full px-2 text-xs">
                  <span className="text-muted-foreground">{level.size.toFixed(0)}</span>
                  <span className="font-mono text-emerald-400">{level.price}¢</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spread indicator */}
      {orderbook.yesBids[0] && orderbook.yesAsks[0] && (
        <div className="mt-3 pt-3 border-t border-border/30 flex justify-center">
          <span className="text-xs text-muted-foreground">
            Spread: <span className="text-foreground font-medium">
              {Math.abs(orderbook.yesAsks[0].price - orderbook.yesBids[0].price)}¢
            </span>
          </span>
        </div>
      )}
    </motion.div>
  );
}