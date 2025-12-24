import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  RefreshCw, 
  TrendingUp, 
  Clock, 
  Filter,
  ChevronDown,
  Droplets,
  Zap,
  ArrowUpRight,
  Flame,
  Timer,
  Sparkles,
  X,
  SlidersHorizontal,
  ExternalLink,
  Layers,
  BarChart3,
  Activity,
  Beaker,
  Bug
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { MarketTradeModal } from "@/components/MarketTradeModal";
import { MarketDetailModal } from "@/components/MarketDetailModal";
import { OutcomeSelectionModal } from "@/components/OutcomeSelectionModal";
import { OutcomesModal } from "@/components/OutcomesModal";
import { MarketsTour } from "@/components/MarketsTour";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

// Categories are now dynamically extracted from events

const QUICK_FILTERS = [
  { id: "trending", label: "Trending", icon: Flame },
  { id: "highVolume", label: "High Volume", icon: TrendingUp },
  { id: "endingSoon", label: "Ending Soon", icon: Timer },
];

const formatVolume = (vol: number): string => {
  if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
};

// Format price with proper handling for small values
const formatPrice = (price: number): string => {
  // Ensure price is a valid number
  if (typeof price !== 'number' || isNaN(price)) return '--';
  
  const cents = price * 100;
  
  // Handle edge cases
  if (cents <= 0) return '0¢';
  if (cents >= 100) return '100¢';
  if (cents < 1) return '< 1¢';
  if (cents > 99) return '> 99¢';
  
  return `${Math.round(cents)}¢`;
};

// Check if price is valid (not uninitialized, extreme, or loading placeholder)
const isValidPrice = (price: number): boolean => {
  if (typeof price !== 'number' || isNaN(price)) return false;
  // 0, 0.5 (exactly), and 1 are typically placeholder/uninitialized values
  if (price === 0 || price === 1 || price === 0.5) return false;
  return price > 0 && price < 1;
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
  if (days > 30) return `${Math.floor(days / 30)}mo`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return "< 1h";
};

const Markets = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"volume24hr" | "volume" | "liquidity">("volume24hr");
  const [displayCount, setDisplayCount] = useState(24);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [outcomeSelectionOpen, setOutcomeSelectionOpen] = useState(false);
  const [outcomesModalOpen, setOutcomesModalOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<MarketEvent | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | null>(null);
  const [selectedOutcomesEvent, setSelectedOutcomesEvent] = useState<MarketEvent | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Check if tour should be shown
  useEffect(() => {
    const tourCompleted = localStorage.getItem("poly-markets-tour-completed");
    if (!tourCompleted && !isLoading) {
      // Delay showing tour until markets are loaded
      const timer = setTimeout(() => setShowTour(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Stable fetch function - doesn't depend on sortBy to prevent re-fetching
  const fetchMarkets = useCallback(async (sortOrder?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('polymarket-data', {
        body: { 
          action: 'getEvents', 
          limit: 250,
          order: sortOrder || 'volume',
          ascending: false
        }
      });

      if (error) throw error;
      
      if (data?.success && data?.events) {
        setEvents(data.events);
        console.log(`Fetched ${data.events.length} events via edge function`);
      } else {
        throw new Error("Invalid response from edge function");
      }
    } catch (error) {
      console.error("Error fetching markets:", error);
      toast.error("Failed to load markets. Please try again.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch only - no dependencies to prevent re-fetching
  useEffect(() => {
    fetchMarkets('volume');
  }, []);

  // Memoized filter and sort - prevents recalculation on every render
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    
    // First: filter out expired/invalid events (backup filter in case edge function misses any)
    let filtered = events.filter(event => {
      // Skip events with no valid outcomes
      if (!event.outcomes || event.outcomes.length === 0) return false;
      
      // Check event-level end date
      if (event.endDate) {
        const end = new Date(event.endDate);
        if (end.getTime() < now) return false;
      }
      
      // Filter out events where all outcomes are expired or effectively resolved
      const validOutcomes = event.outcomes.filter(outcome => {
        // Check expiration
        if (outcome.endDate) {
          const outEnd = new Date(outcome.endDate);
          if (outEnd.getTime() <= now) return false;
        }
        // Filter out effectively resolved markets (99%+ on either side)
        if (outcome.yesPrice >= 0.99 || outcome.noPrice >= 0.99) return false;
        return true;
      });
      
      return validOutcomes.length > 0;
    });

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(query) ||
        event.outcomes.some(o => o.question.toLowerCase().includes(query))
      );
    }

    if (categoryFilter !== "All") {
      filtered = filtered.filter(event => 
        event.category?.toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    // Apply quick filters
    if (quickFilter === "trending") {
      filtered = filtered.filter(event => (event.volume24hr || 0) > 50000);
    } else if (quickFilter === "highVolume") {
      filtered = filtered.filter(event => (event.volume || 0) > 1000000);
    } else if (quickFilter === "endingSoon") {
      const now = new Date();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter(event => {
        if (!event.endDate) return false;
        const end = new Date(event.endDate);
        const diff = end.getTime() - now.getTime();
        return diff > 0 && diff < oneWeek;
      });
    }

    // Stable sort with secondary key (id) to prevent jumping between refreshes
    return [...filtered].sort((a, b) => {
      let primarySort = 0;
      if (sortBy === "volume24hr") primarySort = (b.volume24hr || 0) - (a.volume24hr || 0);
      else if (sortBy === "volume") primarySort = (b.volume || 0) - (a.volume || 0);
      else primarySort = (b.liquidity || 0) - (a.liquidity || 0);
      
      // Secondary sort by id for stability
      if (primarySort === 0) return a.id.localeCompare(b.id);
      return primarySort;
    });
  }, [events, searchQuery, categoryFilter, quickFilter, sortBy]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMarkets(sortBy);
  };

  // Memoized event handlers to prevent unnecessary re-renders
  const handleEventClick = useCallback((event: MarketEvent, outcome?: MarketOutcome) => {
    if (outcome) {
      setSelectedEvent(event);
      setSelectedOutcome(outcome);
      setDetailModalOpen(true);
    } else if (event.outcomes.length === 1) {
      setSelectedEvent(event);
      setSelectedOutcome(event.outcomes[0]);
      setDetailModalOpen(true);
    } else {
      setSelectedEvent(event);
      setOutcomeSelectionOpen(true);
    }
  }, []);

  const handleOutcomeSelected = useCallback((outcome: MarketOutcome) => {
    setOutcomeSelectionOpen(false);
    setSelectedOutcome(outcome);
    setDetailModalOpen(true);
  }, []);

  const handleBackToSelection = useCallback(() => {
    setDetailModalOpen(false);
    setTimeout(() => {
      setSelectedEvent(prev => {
        if (prev && prev.outcomes.length > 1) {
          setOutcomeSelectionOpen(true);
        }
        return prev;
      });
    }, 200);
  }, []);

  const handleTrade = useCallback((outcome: MarketOutcome, eventSlug: string) => {
    setSelectedMarket({
      yesTokenId: outcome.yesTokenId,
      noTokenId: outcome.noTokenId,
      conditionId: outcome.conditionId,
      title: outcome.question,
      currentPrice: outcome.yesPrice,
      url: `https://polymarket.com/event/${eventSlug}`,
      eventSlug,
      marketSlug: outcome.slug
    });
    setTradeModalOpen(true);
  }, []);

  const handleAskPoly = useCallback((event: MarketEvent, outcome?: MarketOutcome) => {
    const targetOutcome = outcome || event.outcomes[0];
    if (!targetOutcome) return;

    const marketContext = {
      eventTitle: event.title,
      outcomeQuestion: targetOutcome.question,
      currentOdds: targetOutcome.yesPrice,
      volume: targetOutcome.volume,
      url: `https://polymarket.com/event/${event.slug}/${targetOutcome.slug}`,
      slug: targetOutcome.slug,
      eventSlug: event.slug,
    };
    
    navigate('/chat', { 
      state: { 
        autoAnalyze: true,
        marketContext 
      }
    });
  }, [navigate]);

  const handleShowAllOutcomes = useCallback((event: MarketEvent) => {
    setSelectedOutcomesEvent(event);
    setOutcomesModalOpen(true);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setCategoryFilter("All");
    setQuickFilter(null);
  }, []);

  const hasActiveFilters = searchQuery || categoryFilter !== "All" || quickFilter;
  const visibleEvents = useMemo(() => filteredEvents.slice(0, displayCount), [filteredEvents, displayCount]);
  const hasMore = displayCount < filteredEvents.length;

  // Memoized stats to prevent recalculation on every render
  const { totalVolume24h, totalLiquidity } = useMemo(() => ({
    totalVolume24h: events.reduce((sum, e) => sum + (e.volume24hr || 0), 0),
    totalLiquidity: events.reduce((sum, e) => sum + (e.liquidity || 0), 0),
  }), [events]);

  // Dynamic categories from events - filter out empty/null values
  const dynamicCategories = useMemo(() => {
    const cats = new Set<string>();
    events.forEach(e => {
      if (e.category && e.category.trim() && e.category !== 'Other') {
        cats.add(e.category);
      }
    });
    // Sort alphabetically, add "All" first and "Other" last if it exists
    const sortedCats = Array.from(cats).sort();
    const hasOther = events.some(e => e.category === 'Other');
    return ["All", ...sortedCats, ...(hasOther ? ["Other"] : [])];
  }, [events]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar />
      
      {/* Markets Tour */}
      {showTour && (
        <MarketsTour onComplete={() => setShowTour(false)} />
      )}
      
      <main className="flex-1 flex flex-col">
        {/* Hero Section - Clean & Minimal */}
        <div className="relative border-b border-border/50 bg-gradient-to-b from-muted/30 to-background">
          {/* Subtle background glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[150px]" />
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 py-12 md:py-16">
            <div className="flex flex-col gap-6">
              {/* Title Row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                    <span className="text-foreground">Prediction </span>
                    <span className="gradient-text">Markets</span>
                  </h1>
                  <span className="inline-flex items-center bg-primary/10 text-primary/80 px-2.5 py-1 text-xs font-medium rounded-full pointer-events-none select-none">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
                    Live
                  </span>
                  <span className="inline-flex items-center bg-amber-500/15 text-amber-500/80 border border-amber-500/20 px-2.5 py-1 text-xs font-medium rounded-full pointer-events-none select-none">
                    <Beaker className="w-3 h-3 mr-1.5" />
                    Early Access
                  </span>
                </div>
                
                <div className="flex items-center gap-4">
                  <p className="text-muted-foreground text-sm sm:text-base max-w-md">
                    Click any card for live data, charts & AI insights
                  </p>
                  <Link to="/help" className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25">
                    <Bug className="w-3 h-3" />
                    Report a Bug
                  </Link>
                </div>
              </div>
              
              {/* Stats Row - Compact Pills */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">24h Vol:</span>
                  <span className="text-sm font-semibold text-foreground">{formatVolume(totalVolume24h)}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
                  <Droplets className="w-3.5 h-3.5 text-secondary" />
                  <span className="text-xs text-muted-foreground">Liquidity:</span>
                  <span className="text-sm font-semibold text-foreground">{formatVolume(totalLiquidity)}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
                  <Layers className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs text-muted-foreground">Markets:</span>
                  <span className="text-sm font-semibold text-foreground">{events.length}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="gap-1.5 h-8 px-3 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section - Clean & Minimal */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-muted/30 border-0 rounded-full focus-visible:ring-1 focus-visible:ring-primary"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Filters - Pills */}
              <div className="flex items-center gap-1.5">
                {QUICK_FILTERS.map((filter) => (
                  <Button
                    key={filter.id}
                    variant={quickFilter === filter.id ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setQuickFilter(quickFilter === filter.id ? null : filter.id)}
                    className={cn(
                      "gap-1.5 h-9 rounded-full px-3",
                      quickFilter === filter.id 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <filter.icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-xs">{filter.label}</span>
                  </Button>
                ))}
              </div>

              {/* More Filters Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-1.5 h-9 rounded-full px-3 text-muted-foreground hover:text-foreground"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs">Filters</span>
                {hasActiveFilters && (
                  <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                )}
              </Button>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-2.5 pt-3 mt-3 border-t border-border/30">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide flex-1">
                  {dynamicCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                        categoryFilter === cat
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-muted/40 border-0 rounded-full px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="volume24hr">24h Volume</option>
                    <option value="volume">Total Volume</option>
                    <option value="liquidity">Liquidity</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Markets Grid */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading markets...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
                <Search className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No markets found</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Try adjusting your search or filters to find what you're looking for
              </p>
              <Button variant="outline" onClick={clearFilters} className="gap-2">
                <X className="w-4 h-4" />
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleEvents.map((event) => (
                  <MarketEventCard 
                    key={event.id} 
                    event={event}
                    onClick={handleEventClick}
                    onTrade={handleTrade}
                    onAskPoly={handleAskPoly}
                    onShowAllOutcomes={handleShowAllOutcomes}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-10">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setDisplayCount(prev => prev + 24)}
                    className="gap-2 px-8 w-full sm:w-auto"
                  >
                    Load More Markets
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="pb-12" />
      </main>

      {/* Outcome Selection Modal (for multi-outcome events) */}
      <OutcomeSelectionModal
        open={outcomeSelectionOpen}
        onOpenChange={setOutcomeSelectionOpen}
        event={selectedEvent}
        onSelectOutcome={handleOutcomeSelected}
      />

      {/* Detail Modal */}
      <MarketDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        event={selectedEvent}
        selectedOutcome={selectedOutcome}
        onTrade={handleTrade}
        onBack={selectedEvent && selectedEvent.outcomes.length > 1 ? handleBackToSelection : undefined}
      />

      {/* Trade Modal */}
      <MarketTradeModal
        open={tradeModalOpen}
        onOpenChange={setTradeModalOpen}
        marketData={selectedMarket}
      />

      {/* Outcomes Modal */}
      <OutcomesModal
        open={outcomesModalOpen}
        onOpenChange={setOutcomesModalOpen}
        event={selectedOutcomesEvent}
        onTrade={handleTrade}
        onAskPoly={handleAskPoly}
      />
    </div>
  );
};

// Memoized Market Event Card Component
interface MarketEventCardProps {
  event: MarketEvent;
  onClick: (event: MarketEvent, outcome?: MarketOutcome) => void;
  onTrade: (outcome: MarketOutcome, eventSlug: string) => void;
  onAskPoly: (event: MarketEvent, outcome?: MarketOutcome) => void;
  onShowAllOutcomes: (event: MarketEvent) => void;
}

const MarketEventCard = memo(({ event, onClick, onTrade, onAskPoly, onShowAllOutcomes }: MarketEventCardProps) => {
  const primaryOutcome = event.outcomes[0];
  const showExpand = event.outcomes.length > 2;
  const displayOutcomes = useMemo(() => event.outcomes.slice(0, 2), [event.outcomes]);
  const isMultiMarket = event.outcomes.length > 1;

  if (!primaryOutcome) return null;

  const isHighVolume = (event.volume24hr || 0) > 100000;

  const handleCardClick = useCallback(() => onClick(event), [onClick, event]);
  const handleAnalyze = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAskPoly(event);
  }, [onAskPoly, event]);
  const handleTradeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (primaryOutcome) onTrade(primaryOutcome, event.slug);
  }, [onTrade, primaryOutcome, event.slug]);
  const handleShowAll = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onShowAllOutcomes(event);
  }, [onShowAllOutcomes, event]);

  return (
    <div 
      className="group bg-card border border-border rounded-xl overflow-hidden cursor-pointer transition-colors duration-200 hover:border-muted-foreground/40"
      onClick={handleCardClick}
    >
      {/* Header with Image */}
      <div className="relative h-28 overflow-hidden">
        {event.image ? (
          <img 
            src={event.image} 
            alt="" 
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
        
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          {event.category && (
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-xs">
              {event.category}
            </Badge>
          )}
          {isHighVolume && (
            <Badge className="bg-primary/90 text-primary-foreground text-xs gap-1">
              <Flame className="w-3 h-3" />
              Hot
            </Badge>
          )}
        </div>

        {/* Time remaining / Multi-Market indicator */}
        <div className="absolute top-3 right-3">
          <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-xs gap-1">
            {isMultiMarket && !event.endDate ? (
              <>
                <Layers className="w-3 h-3" />
                Multi-Market
              </>
            ) : (
              <>
                <Clock className="w-3 h-3" />
                {formatTimeRemaining(event.endDate, event.marketsCount)}
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground line-clamp-2 leading-tight mb-3 group-hover:text-primary transition-colors min-h-[2.5rem]">
          {event.title}
        </h3>

        {/* Stats Row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {formatVolume(event.volume24hr || 0)}
          </span>
          <span className="flex items-center gap-1">
            <Droplets className="w-3 h-3" />
            {formatVolume(event.liquidity || 0)}
          </span>
          {event.marketsCount > 1 && (
            <span className="ml-auto flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {event.marketsCount} outcomes
            </span>
          )}
        </div>

        {/* Outcomes */}
        <div className="space-y-2 mb-4" onClick={(e) => e.stopPropagation()}>
          {displayOutcomes.map((outcome, idx) => (
            <OutcomeRow 
              key={idx} 
              outcome={outcome} 
              event={event}
              onTrade={onTrade}
              onAskPoly={onAskPoly}
              isMultiOutcome={event.outcomes.length > 1}
            />
          ))}

          {showExpand && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground text-xs gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                onShowAllOutcomes(event);
              }}
            >
              <ExternalLink className="w-3 h-3" />
              View all {event.outcomes.length} outcomes
            </Button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-xs h-9"
            onClick={(e) => {
              e.stopPropagation();
              onAskPoly(event);
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Analyze
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 text-xs h-9 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              if (primaryOutcome) onTrade(primaryOutcome, event.slug);
            }}
          >
            <Zap className="w-3.5 h-3.5" />
            Trade
          </Button>
        </div>
      </div>
    </div>
  );
});

// Memoized Outcome Row Component
interface OutcomeRowProps {
  outcome: MarketOutcome;
  event: MarketEvent;
  onTrade: (outcome: MarketOutcome, eventSlug: string) => void;
  onAskPoly: (event: MarketEvent, outcome: MarketOutcome) => void;
  isMultiOutcome: boolean;
}

const OutcomeRow = memo(({ outcome, event, onTrade, onAskPoly, isMultiOutcome }: OutcomeRowProps) => {
  const yesPercent = Math.round(outcome.yesPrice * 100);
  const noPercent = 100 - yesPercent;
  const priceValid = isValidPrice(outcome.yesPrice);
  const yesPriceDisplay = formatPrice(outcome.yesPrice);
  const noPriceDisplay = formatPrice(1 - outcome.yesPrice);

  // Show skeleton for invalid/loading prices
  if (!priceValid) {
    return (
      <div className="bg-muted/30 rounded-xl p-3">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // Single outcome: show prominent Yes/No buy buttons
  if (!isMultiOutcome) {
    return (
      <div className="bg-muted/30 rounded-xl p-3">
        <div className="flex items-center gap-2">
          {/* Yes Button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onTrade(outcome, event.slug);
            }}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 transition-all group/yes"
          >
            <div className="text-xl font-bold text-emerald-500 group-hover/yes:scale-105 transition-transform">{yesPriceDisplay}</div>
            <div className="text-xs text-emerald-400/80 font-medium">Buy Yes</div>
          </button>
          
          {/* No Button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onTrade(outcome, event.slug);
            }}
            className="flex-1 py-3 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 transition-all group/no"
          >
            <div className="text-xl font-bold text-rose-500 group-hover/no:scale-105 transition-transform">{noPriceDisplay}</div>
            <div className="text-xs text-rose-400/80 font-medium">Buy No</div>
          </button>
          
          {/* Analyze */}
          <Button
            variant="ghost"
            size="sm"
            className="h-full py-3 px-3 text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={(e) => {
              e.stopPropagation();
              onAskPoly(event, outcome);
            }}
            title="AI Analysis"
          >
            <Sparkles className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Multi-outcome: show compact price bar with loading state
  return (
    <div 
      className="bg-muted/30 rounded-xl p-3 hover:bg-muted/50 transition-all group/outcome cursor-pointer border border-transparent hover:border-border/50"
      onClick={(e) => {
        e.stopPropagation();
        onTrade(outcome, event.slug);
      }}
    >
      <p className="text-sm font-medium text-foreground mb-2 line-clamp-1">
        {outcome.question}
      </p>
      
      <div className="flex items-center justify-between gap-3">
        {/* Price Bar */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5 text-xs font-medium">
            <span className="text-emerald-500">Yes {priceValid ? yesPriceDisplay : <Skeleton className="inline-block h-3 w-8" />}</span>
            <span className="text-rose-500">No {priceValid ? noPriceDisplay : <Skeleton className="inline-block h-3 w-8" />}</span>
          </div>
          <div className="h-2 bg-rose-500/20 rounded-full overflow-hidden">
            {priceValid ? (
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${yesPercent}%` }}
              />
            ) : (
              <Skeleton className="h-full w-1/2 rounded-full" />
            )}
          </div>
        </div>

        {/* Actions - always visible on mobile, hover on desktop */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5 md:bg-transparent md:p-0 md:opacity-0 md:group-hover/outcome:opacity-100 transition-all">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onAskPoly(event, outcome);
            }}
            title="Analyze"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onTrade(outcome, event.slug);
            }}
            title="Trade"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
});

export default Markets;
