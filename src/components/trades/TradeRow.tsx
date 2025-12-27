import React, { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const WHALE_THRESHOLD = 1000;
const MEGA_WHALE_THRESHOLD = 10000;

export interface Trade {
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
  resolved_url?: string;
  _batchIndex?: number;
  _batchTime?: number;
}

interface TradeRowProps {
  trade: Trade;
  onClick: (trade: Trade) => void;
  style?: React.CSSProperties;
}

// Pure functions moved outside component
const formatTime = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleTimeString();
};

const formatVolume = (price: number, shares: number): string => {
  const volume = (price ?? 0) * (shares ?? 0);
  if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}k`;
  return `$${volume.toFixed(2)}`;
};

const getWhaleLevel = (volume: number): 'mega' | 'whale' | null => {
  if (volume >= MEGA_WHALE_THRESHOLD) return 'mega';
  if (volume >= WHALE_THRESHOLD) return 'whale';
  return null;
};

const TradeRowComponent = ({ trade, onClick, style }: TradeRowProps) => {
  // Memoize computed values
  const computed = useMemo(() => {
    const volume = trade.price * (trade.shares_normalized || trade.shares);
    const whaleLevel = getWhaleLevel(volume);
    const isRecentBatch = trade._batchTime && (Date.now() - trade._batchTime < 500);
    const staggerDelay = isRecentBatch ? (trade._batchIndex || 0) * 30 : 0;
    const formattedVolume = formatVolume(trade.price, trade.shares_normalized || trade.shares);
    const formattedTime = formatTime(trade.timestamp);
    const walletShort = `${trade.user.slice(0, 6)}...${trade.user.slice(-4)}`;
    
    return {
      volume,
      whaleLevel,
      isRecentBatch,
      staggerDelay,
      formattedVolume,
      formattedTime,
      walletShort
    };
  }, [trade.price, trade.shares_normalized, trade.shares, trade._batchTime, trade._batchIndex, trade.timestamp, trade.user]);

  const { whaleLevel, isRecentBatch, staggerDelay, formattedVolume, formattedTime, walletShort } = computed;

  return (
    <div
      onClick={() => onClick(trade)}
      className={cn(
        "group grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer",
        isRecentBatch && "animate-fade-in",
        whaleLevel === 'mega' && "bg-warning/10 shadow-[0_0_20px_rgba(234,179,8,0.2)]",
        whaleLevel === 'whale' && "bg-warning/5"
      )}
      style={{
        ...style,
        ...(isRecentBatch ? { animationDelay: `${staggerDelay}ms` } : {})
      }}
    >
      {/* Market Info */}
      <div className="sm:col-span-5 flex items-center gap-3 min-w-0">
        {trade.image ? (
          <img 
            src={trade.image} 
            alt="" 
            className="w-10 h-10 rounded-lg object-cover shrink-0"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className={cn(
            "w-10 h-10 rounded-lg bg-muted items-center justify-center shrink-0",
            trade.image ? "hidden" : "flex"
          )}
        >
          <Activity className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-foreground font-medium text-sm truncate group-hover:text-primary transition-colors">
            {trade.title}
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            {walletShort}
          </div>
        </div>
        {whaleLevel && (
          <span className={cn(
            "hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded",
            whaleLevel === 'mega' 
              ? 'bg-destructive/20 text-destructive shadow-[0_0_10px_rgba(239,68,68,0.3)]'
              : 'bg-warning/20 text-warning'
          )}>
            {whaleLevel === 'mega' ? '🔥 MEGA' : '🐋 WHALE'}
          </span>
        )}
      </div>

      {/* Side */}
      <div className="sm:col-span-2 flex items-center">
        <div className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold",
          trade.side === 'BUY' 
            ? 'bg-success/20 text-success' 
            : 'bg-destructive/20 text-destructive'
        )}>
          {trade.side === 'BUY' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trade.side} {trade.token_label}
        </div>
      </div>

      {/* Price */}
      <div className="sm:col-span-2 flex items-center sm:justify-end">
        <span className="text-foreground font-mono font-semibold">
          ${(trade.price ?? 0).toFixed(3)}
        </span>
      </div>

      {/* Volume */}
      <div className="sm:col-span-2 flex items-center sm:justify-end">
        <span className={cn(
          "font-mono font-bold",
          whaleLevel === 'mega' ? 'text-destructive' : whaleLevel === 'whale' ? 'text-warning' : 'text-primary'
        )}>
          {formattedVolume}
        </span>
      </div>

      {/* Time */}
      <div className="sm:col-span-1 flex items-center sm:justify-end">
        <span className="text-xs text-muted-foreground">
          {formattedTime}
        </span>
      </div>

      {/* Mobile: Show whale badge */}
      <div className="sm:hidden flex items-center justify-between">
        {whaleLevel && (
          <span className={cn(
            "px-1.5 py-0.5 text-[10px] font-bold rounded",
            whaleLevel === 'mega' 
              ? 'bg-destructive/20 text-destructive' 
              : 'bg-warning/20 text-warning'
          )}>
            {whaleLevel === 'mega' ? '🔥 MEGA' : '🐋 WHALE'}
          </span>
        )}
        <ExternalLink className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  );
};

// Memoize component - only re-render if trade data actually changes
export const TradeRow = memo(TradeRowComponent, (prevProps, nextProps) => {
  const prevTrade = prevProps.trade;
  const nextTrade = nextProps.trade;
  
  // Compare only the fields that affect rendering
  return (
    prevTrade.order_hash === nextTrade.order_hash &&
    prevTrade.tx_hash === nextTrade.tx_hash &&
    prevTrade.timestamp === nextTrade.timestamp &&
    prevTrade.image === nextTrade.image &&
    prevTrade._batchTime === nextTrade._batchTime
  );
});

TradeRow.displayName = 'TradeRow';
