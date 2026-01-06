import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Loader2, RefreshCw, FileText, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConnectWallet } from '@/components/ConnectWallet';
import { useAuth } from '@/hooks/useAuth';
import { useDomeRouter } from '@/hooks/useDomeRouter';
import { TerminalAuthGate } from './TerminalAuthGate';
import { toast } from 'sonner';

interface OpenOrder {
  id: string;
  status: string;
  market_title: string;
  side: string;
  original_size: string;
  size_matched: string;
  price: string;
  outcome: string;
}

export function UserOrdersPanel() {
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const { credentials } = useDomeRouter();
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!address || !credentials) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-open-orders`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: address,
            apiCreds: {
              apiKey: credentials.apiKey,
              secret: credentials.apiSecret,
              passphrase: credentials.apiPassphrase,
            },
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();

      const mapped: OpenOrder[] = (result.orders || []).map((o: any) => ({
        id: o.id || o.order_id || '',
        status: o.status || 'LIVE',
        market_title: o.market_title || '',
        side: o.side || '',
        original_size: o.original_size || o.size || '0',
        size_matched: o.size_matched || '0',
        price: o.price || '0',
        outcome: o.outcome || '',
      }));

      setOrders(mapped);
    } catch (e) {
      console.error('[Orders] Error:', e);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [address, credentials]);

  useEffect(() => {
    if (isConnected && address && credentials && !hasFetched) {
      fetchOrders();
    }
  }, [isConnected, address, credentials, hasFetched, fetchOrders]);

  const handleCancel = async (orderId: string) => {
    if (!address || !credentials) return;
    setCancellingId(orderId);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-order`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: address,
            orderIds: [orderId],
            apiCreds: {
              apiKey: credentials.apiKey,
              secret: credentials.apiSecret,
              passphrase: credentials.apiPassphrase,
            },
          }),
        }
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to cancel');
      }

      toast.success('Order cancelled');
      fetchOrders();
    } catch (e) {
      console.error('[Orders] Cancel error:', e);
      toast.error('Failed to cancel order');
    } finally {
      setCancellingId(null);
    }
  };

  // Not signed in
  if (!user) {
    return (
      <TerminalAuthGate
        title="View Open Orders"
        description="Sign in to manage your open orders"
        icon={<FileText className="w-7 h-7 text-primary" />}
      />
    );
  }

  // Not wallet connected
  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
          <FileText className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">Connect wallet to view orders</p>
        <ConnectWallet />
      </div>
    );
  }

  // No API credentials linked
  if (!credentials) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <FileText className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">Link wallet to view orders</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Go to My Trades to link your wallet</p>
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

  if (orders.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <FileText className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No open orders</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchOrders}
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
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{order.market_title || 'Order'}</p>
              <p className="text-[10px] text-muted-foreground">
                <span
                  className={cn(
                    'font-semibold',
                    order.side?.toUpperCase() === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {order.side?.toUpperCase()}
                </span>{' '}
                {order.outcome} @ {(parseFloat(order.price) * 100).toFixed(0)}¢ • {order.original_size} shares
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              disabled={cancellingId === order.id}
              onClick={() => handleCancel(order.id)}
            >
              {cancellingId === order.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 text-muted-foreground hover:text-destructive" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
