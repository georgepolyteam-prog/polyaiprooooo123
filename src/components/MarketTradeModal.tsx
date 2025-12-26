import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { TradePanel } from "@/components/TradePanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarketTradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSide?: 'YES' | 'NO';
  marketData: {
    yesTokenId?: string;
    noTokenId?: string;
    conditionId?: string;
    title: string;
    currentPrice: number;
    url?: string;
    eventSlug?: string;
    marketSlug?: string;
    isLoading?: boolean;
  };
}

export function MarketTradeModal({ open, onOpenChange, defaultSide, marketData }: MarketTradeModalProps) {
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
      <TradePanel marketData={marketData} defaultSide={defaultSide} />
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" elevated className="h-[85vh] rounded-t-3xl">
          {/* Drag handle indicator */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/30" />
          
          <SheetHeader className="pb-4 flex flex-row items-center justify-between">
            <SheetTitle className="text-left">Trade Market</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </Button>
            </SheetClose>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent elevated className="max-w-md h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Trade Market</DialogTitle>
          <DialogDescription>Review and place an order on this market.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
