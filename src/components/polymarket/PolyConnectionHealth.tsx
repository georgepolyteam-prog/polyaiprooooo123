import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Radio, Clock, RefreshCw } from 'lucide-react';
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
  lastEventTime,
  onReconnect,
  compact = false,
}: PolyConnectionHealthProps) {
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);

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

  // Pulse animation when data updates
  useEffect(() => {
    if (lastEventTime) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 500);
      return () => clearTimeout(timer);
    }
  }, [lastEventTime]);

  const formatAgo = (s: number | null) => {
    if (s === null) return '--';
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m`;
  };

  const isStale = secondsAgo !== null && secondsAgo > 10;

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium transition-colors',
          isStale
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        )}
      >
        <Radio className={cn('w-3 h-3', pulse && 'animate-pulse')} />
        <span>Live</span>
        {secondsAgo !== null && (
          <span className="text-muted-foreground">{formatAgo(secondsAgo)}</span>
        )}
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
          isStale
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        )}
      >
        <Radio className={cn('w-3.5 h-3.5', pulse && 'animate-pulse')} />
        <span className="font-medium">Live</span>
      </div>

      {secondsAgo !== null && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Updated {formatAgo(secondsAgo)} ago</span>
        </div>
      )}

      {isStale && onReconnect && (
        <Button variant="ghost" size="sm" onClick={onReconnect} className="h-7 px-2 gap-1">
          <RefreshCw className="w-3 h-3" />
          Refresh
        </Button>
      )}
    </motion.div>
  );
}
