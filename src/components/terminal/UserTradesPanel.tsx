import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Loader2, RefreshCw, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConnectWallet } from '@/components/ConnectWallet';
import { useAuth } from '@/hooks/useAuth';
import { TerminalAuthGate } from './TerminalAuthGate';
import { format } from 'date-fns';

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
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchTrades = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    try {
      // Fetch from dome-user-data same as MyTrades history
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dome-user-data`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user: address,
            type: 'all',
            limit: 100,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();

      // Map orders array from dome-user-data
      const domeOrders = result.orders || [];
      const mapped: Trade[] = domeOrders.map((o: any) => ({
        marketSlug: o.market_slug || '',
        marketTitle: o.market_title || 'Unknown Market',
        side: o.side || 'BUY',
        volume: parseFloat(String(o.price || 0)) * parseFloat(String(o.size || 0)),
        price: parseFloat(String(o.price || 0)),
        shares: parseFloat(String(o.size || 0)),
        timestamp: typeof o.timestamp === 'string' ? parseInt(o.timestamp) : o.timestamp || 0,
      }));

      // Sort by timestamp descending (newest first)
      mapped.sort((a, b) => b.timestamp - a.timestamp);

      setTrades(mapped);
    } catch (e) {
      console.error('[Trades] Error:', e);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [address]);

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

  // Not signed in
  if (!user) {
    return (
      <TerminalAuthGate
        title="View Trade History"
        description="Sign in to see your recent trades"
        icon={<Clock className="w-7 h-7 text-primary" />}
      />
    );
  }

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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <Clock className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No recent trades</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchTrades}
          className="mt-2 gap-1 text-xs"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {trades.map((trade, idx) => (
          <div
            key={`${trade.marketSlug}-${trade.timestamp}-${idx}`}
            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                  trade.side?.toUpperCase() === 'BUY' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                )}
              >
                {trade.side?.toUpperCase() === 'BUY' ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium truncate text-foreground">{trade.marketTitle}</p>
                <p className="text-[10px] text-muted-foreground">
                  <span
                    className={cn(
                      'font-semibold',
                      trade.side?.toUpperCase() === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                    )}
                  >
                    {trade.side?.toUpperCase()}
                  </span>{' '}
                  {trade.shares.toFixed(2)} @ {(trade.price * 100).toFixed(0)}¢
                </p>
              </div>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p className="text-[11px] font-mono text-foreground">${trade.volume.toFixed(2)}</p>
              <p className="text-[9px] text-muted-foreground">{formatTime(trade.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
