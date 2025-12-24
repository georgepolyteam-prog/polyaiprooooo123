import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDashboardData } from "@/hooks/useDashboardData";
import { OrderBook } from "@/components/dashboard/OrderBook";
import { TradeFeed } from "@/components/dashboard/TradeFeed";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { TopTraders } from "@/components/dashboard/TopTraders";
import { TradePanel } from "@/components/TradePanel";
import { useNavigate } from "react-router-dom";
import { 
  ExternalLink, 
  TrendingUp, 
  Clock,
  BarChart3,
  Droplets,
  RefreshCw,
  Sparkles,
  Share2,
  ArrowLeft,
  Loader2,
  DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

interface MarketDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: MarketEvent | null;
  selectedOutcome?: MarketOutcome | null;
  onTrade: (outcome: MarketOutcome, eventSlug: string) => void;
  onBack?: () => void;
}

const formatVolume = (vol: number): string => {
  if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
};

const formatTimeRemaining = (endDate: string, marketsCount?: number): string => {
  if (!endDate) {
    return marketsCount && marketsCount > 1 ? "Multi-Market" : "Ongoing";
  }
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  if (diff < 0) return "Ended";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 30) return `${Math.floor(days / 30)} months`;
  if (days > 0) return `${days} days`;
  if (hours > 0) return `${hours} hours`;
  return "< 1 hour";
};

// Epic Loading Skeleton with glassmorphic effects
const LoadingSkeleton = ({ event }: { event: MarketEvent }) => (
  <div className="flex flex-col h-full max-h-[95vh] overflow-hidden bg-background relative">
    {/* Epic Centered Loading Indicator */}
    <div className="absolute inset-0 flex items-center justify-center z-20 bg-background/80 backdrop-blur-md">
      <motion.div 
        className="flex flex-col items-center gap-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Epic Glow Ring Loader */}
        <div className="relative">
          <motion.div 
            className="w-20 h-20 rounded-full bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </motion.div>
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-secondary opacity-40 blur-xl animate-pulse" />
          {/* Pulsing rings */}
          <motion.div 
            className="absolute inset-[-12px] rounded-full border-2 border-primary/30"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div 
            className="absolute inset-[-24px] rounded-full border border-secondary/20"
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
          />
        </div>
        
        {/* Loading Text */}
        <div className="text-center space-y-2">
          <motion.p 
            className="text-base font-semibold text-foreground"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            Loading market data...
          </motion.p>
          <p className="text-sm text-muted-foreground">Fetching prices, trades & orderbook</p>
        </div>

        {/* Epic Progress Bar */}
        <div className="w-48 h-2 bg-muted/30 rounded-full overflow-hidden">
          <motion.div 
            className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </div>

    {/* Hero Skeleton (dimmed) */}
    <div className="relative flex-shrink-0 overflow-hidden opacity-30">
      <div className="absolute inset-0">
        {event.image ? (
          <>
            <img 
              src={event.image} 
              alt="" 
              className="w-full h-full object-cover opacity-20 blur-md scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 via-secondary/5 to-background" />
        )}
      </div>
      
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="skeleton-epic h-9 w-20 rounded-lg" />
          <div className="flex items-center gap-2">
            <div className="skeleton-epic h-9 w-9 rounded-lg" />
            <div className="skeleton-epic h-9 w-9 rounded-lg" />
          </div>
        </div>

        <div className="flex items-start gap-4">
          {event.image && (
            <div className="skeleton-epic w-20 h-20 rounded-2xl flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="skeleton-epic h-5 w-20 rounded-full" />
              <div className="skeleton-epic h-5 w-24 rounded-full" />
            </div>
            <div className="skeleton-epic h-8 w-3/4 rounded-lg" />
            <div className="flex flex-wrap items-center gap-3">
              <div className="skeleton-epic h-4 w-20 rounded" />
              <div className="skeleton-epic h-4 w-24 rounded" />
              <div className="skeleton-epic h-4 w-20 rounded" />
            </div>
          </div>
        </div>

        {/* Epic Price Cards Skeleton */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="skeleton-epic h-24 rounded-2xl" />
          <div className="skeleton-epic h-24 rounded-2xl" />
        </div>
      </div>
    </div>

    {/* Content Skeleton (dimmed) */}
    <div className="flex-1 overflow-hidden p-6 space-y-4 opacity-30">
      <div className="skeleton-epic h-48 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="skeleton-epic h-32 rounded-xl" />
        <div className="skeleton-epic h-32 rounded-xl" />
      </div>
    </div>
  </div>
);

export function MarketDetailModal({ 
  open, 
  onOpenChange, 
  event, 
  selectedOutcome,
  onTrade,
  onBack
}: MarketDetailModalProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [activeOutcome, setActiveOutcome] = useState<MarketOutcome | null>(null);
  const [showTradePanel, setShowTradePanel] = useState(false);
  const tradePanelRef = useRef<HTMLDivElement>(null);

  const scrollToTrade = () => {
    tradePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Construct market URL for dashboard data
  const marketUrl = event && activeOutcome 
    ? `https://polymarket.com/event/${event.slug}/${activeOutcome.slug}`
    : event 
      ? `https://polymarket.com/event/${event.slug}`
      : null;

  const dashboardData = useDashboardData(open ? marketUrl : null, activeOutcome?.yesTokenId, activeOutcome?.noTokenId);

  useEffect(() => {
    if (selectedOutcome) {
      setActiveOutcome(selectedOutcome);
    } else if (event?.outcomes?.[0]) {
      setActiveOutcome(event.outcomes[0]);
    }
  }, [event, selectedOutcome]);

  // Reset trade panel when modal closes
  useEffect(() => {
    if (!open) {
      setShowTradePanel(false);
    }
  }, [open]);

  if (!event) return null;

  const handleAnalyze = (outcome: MarketOutcome) => {
    const marketContext = {
      eventTitle: event.title,
      outcomeQuestion: outcome.question,
      currentOdds: outcome.yesPrice,
      volume: outcome.volume,
      url: `https://polymarket.com/event/${event.slug}/${outcome.slug}`,
      slug: outcome.slug,
      eventSlug: event.slug,
    };
    
    navigate('/chat', { 
      state: { 
        autoAnalyze: true,
        marketContext 
      }
    });
    onOpenChange(false);
  };

  const handleShare = async () => {
    const url = `https://polymarket.com/event/${event.slug}${activeOutcome ? `/${activeOutcome.slug}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } catch {
      window.open(url, '_blank');
    }
  };

  // Use dashboard data (real-time) as primary, fallback to event data
  const currentYesPrice = dashboardData.market?.yesPrice ?? activeOutcome?.yesPrice ?? 0;
  const yesPercent = Math.max(0, Math.min(100, Math.round(currentYesPrice * 100)));
  const isInitialLoading = dashboardData.isLoading && !dashboardData.market;
  const isRefreshing = dashboardData.isRefreshing;

  const content = (
    <AnimatePresence mode="wait">
      {isInitialLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <LoadingSkeleton event={event} />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col h-full max-h-[95vh] overflow-hidden bg-background"
        >
          {/* Hero Header with Glassmorphic Design */}
          <div className="relative flex-shrink-0 overflow-hidden">
            {/* Background with image blur effect */}
            <div className="absolute inset-0">
              {event.image ? (
                <>
                  <img 
                    src={event.image} 
                    alt="" 
                    className="w-full h-full object-cover opacity-40 blur-md scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/10 via-secondary/5 to-background" />
              )}
            </div>
            
            <div className="relative p-6">
              {/* Top actions */}
              <div className="flex items-center justify-between mb-4">
                {onBack ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  {/* Refresh indicator */}
                  {isRefreshing && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="hidden sm:inline">Updating...</span>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleShare}
                    className="h-9 w-9 p-0"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                  <a 
                    href={`https://polymarket.com/event/${event.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </a>
                </div>
              </div>

              {/* Main header content */}
              <div className="flex items-start gap-4">
                {event.image && (
                  <motion.img 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    src={event.image} 
                    alt="" 
                    className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 ring-2 ring-border shadow-xl"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {event.category && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        {event.category}
                      </Badge>
                    )}
                    {event.marketsCount > 1 && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <BarChart3 className="w-3 h-3" />
                        {event.marketsCount} markets
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground line-clamp-2 mb-3">
                    {dashboardData.market?.title || activeOutcome?.question || event.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {formatTimeRemaining(dashboardData.market?.endDate || activeOutcome?.endDate || event.endDate, event.marketsCount)}
                    </span>
                    {dashboardData.market ? (
                      <>
                        <span className="flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4" />
                          {formatVolume(dashboardData.stats.volume24h || 0)} / 24h
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Droplets className="w-4 h-4" />
                          {formatVolume(dashboardData.market.liquidity || 0)} liq
                        </span>
                      </>
                    ) : (
                      <>
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Epic Price Cards - Matching TradePanel Design */}
              {activeOutcome && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6"
                >
                  {/* Epic YES/NO Price Cards */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* YES Card */}
                    <motion.div 
                      className="price-card-epic-yes rounded-2xl p-4 cursor-pointer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={isMobile ? () => setShowTradePanel(true) : scrollToTrade}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-medium text-emerald-400/80 uppercase tracking-wider">Yes</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-emerald-400 tabular-nums">{yesPercent}</span>
                        <span className="text-lg text-emerald-400/70">¢</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-emerald-500/20 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${yesPercent}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </motion.div>

                    {/* NO Card */}
                    <motion.div 
                      className="price-card-epic-no rounded-2xl p-4 cursor-pointer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={isMobile ? () => setShowTradePanel(true) : scrollToTrade}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />
                        <span className="text-xs font-medium text-red-400/80 uppercase tracking-wider">No</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-red-400 tabular-nums">{100 - yesPercent}</span>
                        <span className="text-lg text-red-400/70">¢</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-red-500/20 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${100 - yesPercent}%` }}
                          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                        />
                      </div>
                    </motion.div>
                  </div>

                  {/* Tap to Trade hint on mobile */}
                  {isMobile && (
                    <p className="text-center text-xs text-muted-foreground">
                      Tap a card to trade
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {/* Main Content - Scrollable */}
          <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="p-6 space-y-6">
              {/* Mobile Trade Panel View - Rendered in scrollable area */}
              {isMobile && showTradePanel && activeOutcome ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 pb-20"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTradePanel(false)}
                    className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Analysis
                  </Button>
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Trade This Market
                  </h3>
                  <TradePanel
                    marketData={{
                      yesTokenId: activeOutcome.yesTokenId || undefined,
                      noTokenId: activeOutcome.noTokenId || undefined,
                      conditionId: activeOutcome.conditionId,
                      title: dashboardData.market?.title || activeOutcome.question,
                      currentPrice: dashboardData.market?.yesPrice ?? activeOutcome.yesPrice,
                      url: `https://polymarket.com/event/${event.slug}/${activeOutcome.slug}`,
                      eventSlug: event.slug,
                      marketSlug: activeOutcome.slug
                    }}
                  />
                </motion.div>
              ) : dashboardData.error ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                    <BarChart3 className="w-8 h-8 text-destructive" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load data</h3>
                  <p className="text-sm text-muted-foreground mb-4">{dashboardData.error}</p>
                  <Button variant="outline" size="sm" onClick={dashboardData.refresh}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              ) : (
                <>
                  {/* Price Chart */}
                  {dashboardData.priceHistory.length > 0 && (
                  <PriceChart
                      history={dashboardData.priceHistory}
                      currentPrice={(dashboardData.market?.yesPrice || 0) * 100}
                      priceChange7d={dashboardData.stats.priceChange7d}
                    />
                  )}

                  {/* Stats Grid */}
                  <StatsGrid
                    volume24h={dashboardData.stats.volume24h}
                    uniqueTraders={dashboardData.stats.uniqueTraders}
                    avgTradeSize={dashboardData.stats.avgTradeSize}
                    whaleCount={dashboardData.stats.whaleCount}
                    whaleVolume={dashboardData.stats.whaleVolume}
                    priceChange1h={dashboardData.stats.priceChange1h}
                    priceChange24h={dashboardData.stats.priceChange24h}
                    priceChange7d={dashboardData.stats.priceChange7d}
                    buyPressure={dashboardData.stats.buyPressure}
                    recentWhaleActivity={dashboardData.trades.some(t => t.isWhale && t.isNew)}
                  />

                  {/* Order Book & Trade Feed */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <OrderBook
                      bids={dashboardData.orderbook.bids}
                      asks={dashboardData.orderbook.asks}
                      spread={dashboardData.orderbook.spread}
                      midPrice={dashboardData.orderbook.midPrice}
                    />
                    <TradeFeed
                      trades={dashboardData.trades}
                      buyPressure={dashboardData.stats.buyPressure}
                    />
                  </div>

                  {/* Top Traders */}
                  {dashboardData.topTraders.length > 0 && (
                    <TopTraders
                      traders={dashboardData.topTraders}
                      whaleCount={dashboardData.topTraderStats.whaleCount}
                      whaleVolume={dashboardData.topTraderStats.whaleVolume}
                      totalVolume={dashboardData.topTraderStats.totalVolume}
                      whaleThreshold={dashboardData.topTraderStats.whaleThreshold}
                    />
                  )}

                  {/* Embedded Trade Panel for Desktop */}
                  {!isMobile && activeOutcome && (
                    <div className="mt-6" ref={tradePanelRef}>
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        Trade This Market
                      </h3>
                      <TradePanel
                        marketData={{
                          yesTokenId: activeOutcome.yesTokenId || undefined,
                          noTokenId: activeOutcome.noTokenId || undefined,
                          conditionId: activeOutcome.conditionId,
                          title: dashboardData.market?.title || activeOutcome.question,
                          currentPrice: dashboardData.market?.yesPrice ?? activeOutcome.yesPrice,
                          url: `https://polymarket.com/event/${event.slug}/${activeOutcome.slug}`,
                          eventSlug: event.slug,
                          marketSlug: activeOutcome.slug
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Fixed Bottom Actions Bar - Only show when NOT in trade panel mode on mobile */}
          {(!isMobile || !showTradePanel) && (
            <div className="flex-shrink-0 border-t border-border bg-card/95 backdrop-blur-sm">
              <div className="flex gap-3 p-4">
                <Button
                  variant="outline"
                  className="flex-1 gap-2 h-12 border-border/50 hover:bg-muted/50 hover:border-border"
                  onClick={() => activeOutcome && handleAnalyze(activeOutcome)}
                  disabled={!activeOutcome}
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>Analyze</span>
                </Button>
                <Button
                  className="flex-1 gap-2 h-12 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                  onClick={isMobile ? () => setShowTradePanel(true) : scrollToTrade}
                  disabled={!activeOutcome}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Trade</span>
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="bottom" 
          className="h-[95vh] p-0 rounded-t-3xl overflow-hidden"
          onPointerDownOutside={(e) => {
            // Prevent closing when scrolling within the trade panel
            if ((e.target as HTMLElement)?.closest?.('[data-trade-panel]')) {
              e.preventDefault();
            }
          }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{event.title}</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{event.title}</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
