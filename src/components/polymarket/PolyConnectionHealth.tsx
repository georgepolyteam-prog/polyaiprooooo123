import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PolyConnectionHealthProps {
  connected: boolean;
  reconnectAttempts?: number;
  lastEventTime?: number | null;
  onReconnect?: () => void;
  compact?: boolean;
}

export function PolyConnectionHealth({
  connected,
  reconnectAttempts = 0,
  lastEventTime,
  onReconnect,
  compact = false,
}: PolyConnectionHealthProps) {
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  useEffect(() => {
    if (!lastEventTime) {
      setSecondsAgo(null);
      return;
    }
    const update = () => {
      const diff = Math.floor((Date.now() - lastEventTime) / 1000);
      setSecondsAgo(diff);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastEventTime]);

  const formatAgo = (s: number | null) => {
    if (s === null) return '--';
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m`;
  };

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium transition-colors',
          connected
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        )}
      >
        {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3 animate-pulse" />}
        {connected ? 'LIVE' : reconnectAttempts > 0 ? `Retry ${reconnectAttempts}` : 'Disconnected'}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-3 text-xs"
    >
      <div
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors',
          connected
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        )}
      >
        {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        <span className="font-medium">{connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {connected && secondsAgo !== null && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Last: {formatAgo(secondsAgo)} ago</span>
        </div>
      )}

      {!connected && reconnectAttempts > 0 && (
        <span className="text-muted-foreground">Attempt {reconnectAttempts}</span>
      )}

      {!connected && onReconnect && (
        <Button variant="ghost" size="sm" onClick={onReconnect} className="h-7 px-2 gap-1">
          <RefreshCw className="w-3 h-3" />
          Reconnect
        </Button>
      )}
    </motion.div>
  );
}
