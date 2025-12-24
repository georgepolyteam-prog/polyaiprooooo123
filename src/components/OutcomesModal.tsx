import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ArrowUpRight, TrendingUp, Droplets, Clock } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface MarketOutcome {
  question: string;
  slug: string;
  conditionId: string;
  yesTokenId: string | null;
  noTokenId: string | null;
  yesPrice: number;
  noPrice: number;
  volume: number;
  volume24hr: number;
  liquidity: number;
  endDate: string;
  image: string;
}

interface MarketEvent {
  id: string;
  title: string;
  slug: string;
  image: string;
  icon: string;
  category: string;
  volume: number;
  volume24hr: number;
  liquidity: number;
  endDate: string;
  outcomes: MarketOutcome[];
  marketsCount: number;
}

interface OutcomesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: MarketEvent | null;
  onTrade: (outcome: MarketOutcome, eventSlug: string) => void;
  onAskPoly: (event: MarketEvent, outcome: MarketOutcome) => void;
}

const formatVolume = (vol: number): string => {
  if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
};

// Format price with proper handling for small values
const formatPrice = (price: number): string => {
  if (typeof price !== 'number' || isNaN(price)) return '--';
  const cents = price * 100;
  if (cents <= 0) return '0¢';
  if (cents >= 100) return '100¢';
  if (cents < 1) return '< 1¢';
  if (cents > 99) return '> 99¢';
  return `${Math.round(cents)}¢`;
};

// Check if price is valid for display
const isValidPrice = (price: number): boolean => {
  if (typeof price !== 'number' || isNaN(price)) return false;
  if (price === 0 || price === 1 || price === 0.5) return false;
  return price > 0 && price < 1;
};

export function OutcomesModal({ open, onOpenChange, event, onTrade, onAskPoly }: OutcomesModalProps) {
  const isMobile = useIsMobile();

  if (!event) return null;

  const mobileContent = (
    <div className="flex-1 overflow-y-auto overscroll-contain -mx-6 px-6">
      <div className="space-y-3 pb-6">
        {event.outcomes.map((outcome, idx) => {
          const yesPercent = Math.round(outcome.yesPrice * 100);

          return (
            <div 
              key={idx}
              className="bg-muted/30 rounded-xl p-4 hover:bg-muted/50 transition-colors border border-border/50"
            >
              <p className="text-sm font-medium text-foreground mb-3">
                {outcome.question}
              </p>
              
              {/* Price Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5 text-xs font-medium">
                  <span className="text-emerald-500">
                    Yes {isValidPrice(outcome.yesPrice) ? formatPrice(outcome.yesPrice) : <Skeleton className="inline-block h-3 w-8" />}
                  </span>
                  <span className="text-rose-500">
                    No {isValidPrice(outcome.yesPrice) ? formatPrice(1 - outcome.yesPrice) : <Skeleton className="inline-block h-3 w-8" />}
                  </span>
                </div>
                <div className="h-2.5 bg-rose-500/20 rounded-full overflow-hidden">
                  {isValidPrice(outcome.yesPrice) ? (
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${yesPercent}%` }}
                    />
                  ) : (
                    <Skeleton className="h-full w-1/2 rounded-full" />
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {formatVolume(outcome.volume24hr || 0)}
                </span>
                <span className="flex items-center gap-1">
                  <Droplets className="w-3 h-3" />
                  {formatVolume(outcome.liquidity || 0)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={() => onAskPoly(event, outcome)}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Analyze
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 text-xs bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                  onClick={() => onTrade(outcome, event.slug)}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Trade
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const desktopContent = (
    <ScrollArea className="max-h-[70vh]">
      <div className="space-y-3 p-1">
        {event.outcomes.map((outcome, idx) => {
          const yesPercent = Math.round(outcome.yesPrice * 100);

          return (
            <div 
              key={idx}
              className="bg-muted/30 rounded-xl p-4 hover:bg-muted/50 transition-colors border border-border/50"
            >
              <p className="text-sm font-medium text-foreground mb-3">
                {outcome.question}
              </p>
              
              {/* Price Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5 text-xs font-medium">
                  <span className="text-emerald-500">
                    Yes {isValidPrice(outcome.yesPrice) ? formatPrice(outcome.yesPrice) : <Skeleton className="inline-block h-3 w-8" />}
                  </span>
                  <span className="text-rose-500">
                    No {isValidPrice(outcome.yesPrice) ? formatPrice(1 - outcome.yesPrice) : <Skeleton className="inline-block h-3 w-8" />}
                  </span>
                </div>
                <div className="h-2.5 bg-rose-500/20 rounded-full overflow-hidden">
                  {isValidPrice(outcome.yesPrice) ? (
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${yesPercent}%` }}
                    />
                  ) : (
                    <Skeleton className="h-full w-1/2 rounded-full" />
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {formatVolume(outcome.volume24hr || 0)}
                </span>
                <span className="flex items-center gap-1">
                  <Droplets className="w-3 h-3" />
                  {formatVolume(outcome.liquidity || 0)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={() => onAskPoly(event, outcome)}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Analyze
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 text-xs bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                  onClick={() => onTrade(outcome, event.slug)}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Trade
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );

  // Use Sheet on mobile, Dialog on desktop
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
          <SheetHeader className="pb-4 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              {event.category && (
                <Badge variant="secondary" className="text-xs">
                  {event.category}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {event.outcomes.length} outcomes
              </Badge>
            </div>
            <SheetTitle className="text-left line-clamp-2">
              {event.title}
            </SheetTitle>
          </SheetHeader>
          {mobileContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {event.category && (
              <Badge variant="secondary" className="text-xs">
                {event.category}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {event.outcomes.length} outcomes
            </Badge>
          </div>
          <DialogTitle className="line-clamp-2 pr-8">
            {event.title}
          </DialogTitle>
        </DialogHeader>
        {desktopContent}
      </DialogContent>
    </Dialog>
  );
}
