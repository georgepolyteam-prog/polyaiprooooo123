import { memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { KalshiCandlestickChart } from './KalshiCandlestickChart';
import type { KalshiMarket } from '@/hooks/useDflowApi';

interface KalshiChartModalProps {
  market: KalshiMarket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function KalshiChartModalComponent({ market, open, onOpenChange }: KalshiChartModalProps) {
  const isMobile = useIsMobile();

  if (!market) return null;

  const chartContent = (
    <div className="p-1">
      <KalshiCandlestickChart 
        ticker={market.ticker} 
        title={market.title || market.ticker}
      />
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl bg-background p-4 overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-lg font-semibold text-foreground line-clamp-2">
              {market.title || market.ticker}
            </SheetTitle>
          </SheetHeader>
          {chartContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-background border-border/50 p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground line-clamp-2">
            {market.title || market.ticker}
          </DialogTitle>
        </DialogHeader>
        {chartContent}
      </DialogContent>
    </Dialog>
  );
}

export const KalshiChartModal = memo(KalshiChartModalComponent);
