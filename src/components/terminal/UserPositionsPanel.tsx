import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Loader2, RefreshCw, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConnectWallet } from '@/components/ConnectWallet';
import { useAuth } from '@/hooks/useAuth';
import { TerminalAuthGate } from './TerminalAuthGate';

interface Position {
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  outcome: string;
  title: string;
  eventSlug: string;
}

export function UserPositionsPanel() {
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchPositions = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-positions?address=${address}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setPositions(result.positions || []);
    } catch (e) {
      console.error('[Positions] Error:', e);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address && !hasFetched) {
      fetchPositions();
    }
  }, [isConnected, address, hasFetched, fetchPositions]);

  // Not signed in
  if (!user) {
    return (
      <TerminalAuthGate
        title="View Your Positions"
        description="Sign in to see your Polymarket positions and P&L"
      />
    );
  }

  // Not wallet connected
  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
          <TrendingUp className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">Connect wallet to view positions</p>
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

  if (positions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <TrendingUp className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No open positions</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchPositions}
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
        {positions.map((pos, idx) => (
          <div
            key={`${pos.asset}-${idx}`}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  pos.cashPnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
                )}
              >
                {pos.cashPnl >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{pos.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {pos.outcome} • {pos.size.toFixed(2)} shares @ {(pos.avgPrice * 100).toFixed(0)}¢
                </p>
              </div>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p
                className={cn(
                  'text-sm font-bold font-mono',
                  pos.cashPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {pos.cashPnl >= 0 ? '+' : ''}${pos.cashPnl.toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {pos.percentPnl >= 0 ? '+' : ''}
                {pos.percentPnl.toFixed(1)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
