import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  TrendingUp, 
  Droplets, 
  ExternalLink, 
  Clock,
  BarChart3,
  X,
  Loader2,
  ArrowRight
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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

interface OutcomeSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: MarketEvent | null;
  onSelectOutcome: (outcome: MarketOutcome) => void;
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

const formatTimeRemaining = (endDate: string): string => {
  if (!endDate) return "Ongoing";
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  if (diff < 0) return "Ended";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 30) return `${Math.floor(days / 30)}mo`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return "< 1h";
};

export function OutcomeSelectionModal({ 
  open, 
  onOpenChange, 
  event,
  onSelectOutcome 
}: OutcomeSelectionModalProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");

  if (!event) return null;

  // Filter by search and sort by volume (highest first)
  const filteredOutcomes = (searchQuery
    ? event.outcomes.filter(o => 
        o.question.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : event.outcomes
  ).sort((a, b) => (b.volume || 0) - (a.volume || 0));
  
  // Check if market has meaningful activity
  const isActiveMarket = (o: MarketOutcome) => o.volume > 0 || o.liquidity > 0;

  // Loading state when no outcomes
  const isLoading = event.outcomes.length === 0;

  const content = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Loader2 className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-foreground">Loading outcomes...</p>
          <p className="text-xs text-muted-foreground mt-1">Fetching market data</p>
          <div className="mt-8 w-full max-w-md space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      ) : (
        <>
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        {/* Background image with blur */}
        {event.image && (
          <div className="absolute inset-0">
            <img 
              src={event.image}
              alt="" 
              className="w-full h-full object-cover opacity-30 blur-sm"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
          </div>
        )}
        
        <div className="relative p-6 pb-4">
          <div className="flex items-start gap-4">
            {event.image && (
              <img 
                src={event.image} 
                alt="" 
                className="w-16 h-16 rounded-xl object-cover flex-shrink-0 ring-2 ring-border shadow-lg"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {event.category && (
                  <Badge variant="secondary" className="text-xs">
                    {event.category}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs gap-1">
                  <BarChart3 className="w-3 h-3" />
                  {event.outcomes.length} outcomes
                </Badge>
              </div>
              <h2 className="text-lg font-bold text-foreground line-clamp-2">
                {event.title}
              </h2>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              {formatVolume(event.volume24hr || 0)} / 24h
            </span>
            <span className="flex items-center gap-1.5">
              <Droplets className="w-4 h-4" />
              {formatVolume(event.liquidity || 0)} liq
            </span>
            <a 
              href={`https://polymarket.com/event/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Polymarket
            </a>
          </div>
        </div>
      </div>

      {/* Search (show for many outcomes) */}
      {event.outcomes.length > 6 && (
        <div className="px-6 py-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search outcomes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Instruction */}
      <div className="px-6 py-3">
        <p className="text-sm text-muted-foreground">
          Select an outcome to view detailed analysis
        </p>
      </div>

      {/* Outcomes Grid */}
      <ScrollArea className="flex-1 min-h-0 px-6">
        <div className="grid gap-3 pb-6 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {filteredOutcomes.map((outcome, idx) => {
              const yesPercent = Math.round(outcome.yesPrice * 100);
              const noPercent = 100 - yesPercent;
              const hasActivity = isActiveMarket(outcome);
              const isHighVolume = outcome.volume >= 10000;

              return (
                <motion.button
                  key={outcome.slug || idx}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.03 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectOutcome(outcome)}
                  className={cn(
                    "group text-left p-4 rounded-xl transition-all",
                    "bg-card hover:bg-muted/60 border border-border/50",
                    "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
                    !hasActivity && "opacity-70",
                    isHighVolume && "ring-1 ring-primary/20"
                  )}
                >
                  {/* Badges row */}
                  <div className="flex items-center gap-1.5 mb-2">
                    {isHighVolume && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-0">
                        HOT
                      </Badge>
                    )}
                    {!hasActivity && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                        Low Activity
                      </Badge>
                    )}
                  </div>
                  
                  {/* Question */}
                  <p className="font-medium text-foreground mb-3 line-clamp-2 group-hover:text-foreground transition-colors">
                    {outcome.question}
                  </p>

                  {/* Price visualization */}
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
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {formatVolume(outcome.volume || 0)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Droplets className="w-3 h-3" />
                        {formatVolume(outcome.liquidity || 0)}
                      </span>
                    </div>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimeRemaining(outcome.endDate)}
                    </span>
                  </div>

                  {/* Analyze indicator */}
                  <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      Click to view details
                    </span>
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <ArrowRight className="w-3.5 h-3.5 text-primary group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>

          {filteredOutcomes.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <p className="text-muted-foreground">No outcomes match your search</p>
            </div>
          )}
        </div>
      </ScrollArea>
        </>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[95vh] p-0 rounded-t-3xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Select Outcome</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Select Outcome</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col h-full overflow-hidden">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
