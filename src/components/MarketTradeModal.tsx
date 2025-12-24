import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TradePanel } from "@/components/TradePanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { ExternalLink } from "lucide-react";

interface MarketTradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketData: {
    yesTokenId?: string;
    noTokenId?: string;
    conditionId?: string;
    title: string;
    currentPrice: number;
    url?: string;
    eventSlug?: string;
    marketSlug?: string;
  };
}

export function MarketTradeModal({ open, onOpenChange, marketData }: MarketTradeModalProps) {
  const isMobile = useIsMobile();

  // Guard against null marketData
  if (!marketData) {
    return null;
  }

  const content = (
    <div className="space-y-4">
      {/* Market Title */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground leading-snug flex-1">
          {marketData.title}
        </h3>
        {marketData.url && (
          <a
            href={marketData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Trade Panel */}
      <TradePanel marketData={marketData} />
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left">Trade Market</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Trade Market</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
