import React, { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TradeRow, Trade } from './TradeRow';
import { Activity, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VirtualizedTradeListProps {
  trades: Trade[];
  onTradeClick: (trade: Trade) => void;
  loading?: boolean;
  error?: string | null;
  connected?: boolean;
  allTradesCount?: number;
  onReconnect?: () => void;
}

const ROW_HEIGHT = 72; // Approximate row height in pixels
const OVERSCAN = 5; // Number of items to render outside visible area

export function VirtualizedTradeList({
  trades,
  onTradeClick,
  loading = false,
  error = null,
  connected = false,
  allTradesCount = 0,
  onReconnect
}: VirtualizedTradeListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: trades.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const handleTradeClick = useCallback((trade: Trade) => {
    onTradeClick(trade);
  }, [onTradeClick]);

  // Empty state
  if (trades.length === 0 && !loading && !error) {
    return (
      <div className="text-center py-20">
        <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
        <p className="text-muted-foreground text-lg">
          {allTradesCount > 0 ? 'No trades match your filters' : 'Waiting for trades...'}
        </p>
        <p className="text-muted-foreground/60 text-sm mt-2">
          {connected ? 'Connected to live feed' : 'Reconnecting...'}
        </p>
        {!connected && onReconnect && (
          <Button onClick={onReconnect} variant="outline" className="mt-4 gap-2">
            <RefreshCw className="w-4 h-4" />
            Reconnect
          </Button>
        )}
      </div>
    );
  }

  // Loading state
  if (loading && !error) {
    return (
      <div className="text-center py-20">
        <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground">Connecting to live feed...</p>
        <p className="text-muted-foreground/60 text-xs mt-2">This may take a few seconds</p>
      </div>
    );
  }

  // Error state
  if (error && !loading) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <p className="text-destructive font-medium">{error}</p>
        {onReconnect && (
          <Button onClick={onReconnect} variant="outline" className="mt-4 gap-2">
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="divide-y divide-border/50 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto min-h-[200px]"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const trade = trades[virtualRow.index];
          const tradeId = trade.order_hash || `${trade.tx_hash}-${trade.timestamp}-${trade.token_id}`;
          
          return (
            <div
              key={tradeId}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TradeRow
                trade={trade}
                onClick={handleTradeClick}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
