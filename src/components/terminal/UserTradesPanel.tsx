import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Loader2, RefreshCw, Clock, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConnectWallet } from '@/components/ConnectWallet';

type TimeFilter = '24h' | '7d' | '30d' | 'all';

interface Trade {
  marketSlug: string;
  marketTitle: string;
  side: string;
  volume: number;
  price: number;
  shares: number;
  timestamp: number;
}

export function UserTradesPanel() {
  const { address, isConnected } = useAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');

  const fetchTrades = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    try {
      // Calculate time filter
      const now = Math.floor(Date.now() / 1000);
      let start_time: number | undefined;
      if (timeFilter === '24h') start_time = now - 86400;
      else if (timeFilter === '7d') start_time = now - 7 * 86400;
      else if (timeFilter === '30d') start_time = now - 30 * 86400;

      const domePromise = fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dome-user-data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: address,
          type: 'all',
          start_time,
          limit: 100,
        }),
      });

      const profilePromise = fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-profile?address=${address}&timeframe=${timeFilter}`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const [domeResponse, profileResponse] = await Promise.all([domePromise, profilePromise]);

      let nextTrades: Trade[] = [];

      // Prefer Dome orders (same as MyTrades)
      if (domeResponse.ok) {
        const domeResult = await domeResponse.json();
        const domeOrders = domeResult?.orders || [];
        nextTrades = domeOrders.map((o: any) => ({
          marketSlug: o.market_slug || '',
          marketTitle: o.market_title || 'Unknown Market',
          side: o.side || 'BUY',
          volume: parseFloat(String(o.price || 0)) * parseFloat(String(o.size || 0)),
          price: parseFloat(String(o.price || 0)),
          shares: parseFloat(String(o.size || 0)),
          timestamp: typeof o.timestamp === 'string' ? parseInt(o.timestamp) : o.timestamp || 0,
        }));
      }

      // Fallback to wallet-profile recent trades if Dome returns nothing (same as MyTrades)
      if (nextTrades.length === 0 && profileResponse.ok) {
        const profileResult = await profileResponse.json();
        const recentTrades = Array.isArray(profileResult?.recentTrades) ? profileResult.recentTrades : [];
        nextTrades = recentTrades.map((t: any) => ({
          marketSlug: t.marketSlug ?? t.market_slug ?? '',
          marketTitle: t.marketTitle ?? t.market_title ?? 'Unknown Market',
          side: t.side ?? 'BUY',
          volume: Number(t.volume ?? 0),
          price: Number(t.price ?? 0),
          shares: Number(t.shares ?? 0),
          timestamp: Number(t.timestamp ?? 0),
        }));
      }

      // Sort by timestamp descending (newest first)
      nextTrades.sort((a, b) => b.timestamp - a.timestamp);
      setTrades(nextTrades);
    } catch (e) {
      console.error('[Trades] Error:', e);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [address, timeFilter]);

  useEffect(() => {
    if (isConnected && address && !hasFetched) {
      fetchTrades();
    }
  }, [isConnected, address, hasFetched, fetchTrades]);

  // Reset when address changes
  useEffect(() => {
    setHasFetched(false);
    setTrades([]);
  }, [address]);

  // Refetch when time filter changes
  useEffect(() => {
    if (hasFetched && isConnected && address) {
      fetchTrades();
    }
  }, [timeFilter]);

  const formatTime = (ts: number) => {
    try {
      if (!ts || isNaN(ts)) return 'Unknown';
      // Handle both seconds and milliseconds timestamps
      const date = ts > 9999999999 ? new Date(ts) : new Date(ts * 1000);
      return format(date, 'MMM d, HH:mm');
    } catch {
      return 'Unknown';
    }
  };

  // Not wallet connected
  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
          <Clock className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">Connect wallet to view trades</p>
        <ConnectWallet />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with filters */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <div className="flex items-center p-0.5 rounded-md bg-muted/40 border border-border/40">
            {(['24h', '7d', '30d', 'all'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeFilter(tf)}
                className={cn(
                  'px-2 py-0.5 text-[9px] font-medium rounded transition-all',
                  timeFilter === tf
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchTrades}
          disabled={loading}
          className="h-6 w-6"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Content */}
      {loading && trades.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary/50" />
        </div>
      ) : trades.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Clock className="w-8 h-8 text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">No trades found</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            Try expanding the time range
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-1">
            {trades.map((trade, idx) => (
              <div
                key={`${trade.marketSlug}-${trade.timestamp}-${idx}`}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
                      trade.side?.toUpperCase() === 'BUY' ? 'bg-emerald-500/15' : 'bg-red-500/15'
                    )}
                  >
                    {trade.side?.toUpperCase() === 'BUY' ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium truncate text-foreground leading-tight">
                      {trade.marketTitle}
                    </p>
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                      <span
                        className={cn(
                          'font-semibold',
                          trade.side?.toUpperCase() === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                        )}
                      >
                        {trade.side?.toUpperCase()}
                      </span>
                      <span>•</span>
                      <span>{trade.shares.toFixed(1)} @ {(trade.price * 100).toFixed(0)}¢</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-[10px] font-mono font-medium text-foreground">
                    ${trade.volume.toFixed(2)}
                  </p>
                  <p className="text-[8px] text-muted-foreground">{formatTime(trade.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}