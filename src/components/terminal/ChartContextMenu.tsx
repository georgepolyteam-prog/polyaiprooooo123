import { useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChartContextMenuProps {
  x: number;
  y: number;
  price: number;
  onClose: () => void;
  onSetAlert: (price: number, direction: 'above' | 'below') => void;
}

export function ChartContextMenu({
  x,
  y,
  price,
  onClose,
  onSetAlert,
}: ChartContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 100);

  const formattedPrice = Math.round(price * 100);

  return (
    <div
      ref={menuRef}
      className="fixed bg-card border border-border rounded-lg shadow-xl z-50 py-1 min-w-[180px] animate-in fade-in-0 zoom-in-95"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="px-3 py-1.5 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bell className="w-3 h-3" />
          <span>Set Price Alert</span>
        </div>
      </div>

      <button
        onClick={() => {
          onSetAlert(formattedPrice, 'above');
          onClose();
        }}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
          "hover:bg-emerald-500/10 transition-colors"
        )}
      >
        <TrendingUp className="w-4 h-4 text-emerald-500" />
        <span>Alert Above {formattedPrice}¢</span>
      </button>

      <button
        onClick={() => {
          onSetAlert(formattedPrice, 'below');
          onClose();
        }}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
          "hover:bg-red-500/10 transition-colors"
        )}
      >
        <TrendingDown className="w-4 h-4 text-red-500" />
        <span>Alert Below {formattedPrice}¢</span>
      </button>
    </div>
  );
}
