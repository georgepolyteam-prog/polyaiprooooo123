import { useEffect, useCallback } from 'react';

interface UseTerminalHotkeysOptions {
  onSelectSide?: (side: 'YES' | 'NO') => void;
  onSetAmount?: (amount: string) => void;
  onToggleOrderType?: () => void;
  onExecuteTrade?: () => void;
  onRefresh?: () => void;
  onFocusSearch?: () => void;
  enabled?: boolean;
}

const PRESET_AMOUNTS = ['10', '25', '50', '100'];

export function useTerminalHotkeys({
  onSelectSide,
  onSetAmount,
  onToggleOrderType,
  onExecuteTrade,
  onRefresh,
  onFocusSearch,
  enabled = true,
}: UseTerminalHotkeysOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if typing in input fields
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target?.tagName)) return;

      const key = e.key.toLowerCase();

      switch (key) {
        case 'y':
          e.preventDefault();
          onSelectSide?.('YES');
          break;
        case 'n':
          e.preventDefault();
          onSelectSide?.('NO');
          break;
        case 'm':
          e.preventDefault();
          onToggleOrderType?.();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          e.preventDefault();
          onSetAmount?.(PRESET_AMOUNTS[parseInt(key) - 1]);
          break;
        case 'enter':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onExecuteTrade?.();
          }
          break;
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onRefresh?.();
          }
          break;
        case '/':
          e.preventDefault();
          onFocusSearch?.();
          break;
      }
    },
    [onSelectSide, onSetAmount, onToggleOrderType, onExecuteTrade, onRefresh, onFocusSearch]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
