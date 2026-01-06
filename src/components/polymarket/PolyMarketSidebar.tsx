import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Loader2, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type PolyMarket } from '@/hooks/usePolymarketTerminal';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface PolyMarketSidebarProps {
  markets: PolyMarket[];
  selectedMarket: PolyMarket | null;
  onSelectMarket: (market: PolyMarket) => void;
  loading?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export function PolyMarketSidebar({
  markets,
  selectedMarket,
  onSelectMarket,
  loading = false,
  collapsed = false,
  onToggleCollapse,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}: PolyMarketSidebarProps) {
  const [search, setSearch] = useState('');
  const [apiResults, setApiResults] = useState<PolyMarket[]>([]);
  const [searching, setSearching] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Debounced API search for ALL Polymarket markets when query >= 3 chars
  useEffect(() => {
    if (search.length < 3) {
      setApiResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      console.log('[Sidebar] Starting search for:', search);
      try {
        const { data, error } = await supabase.functions.invoke('polymarket-data', {
          body: {
            action: 'search',
            query: search,
            limit: 30,
          },
        });

        console.log('[Sidebar] Search response:', { data, error });

        if (error) throw error;

        // The API returns markets directly at the top level
        const markets = data?.markets || data?.events || [];
        console.log('[Sidebar] Found markets:', markets.length);
        
        const toCents = (p: unknown): number => {
          const n = typeof p === 'number' ? p : parseFloat(String(p ?? '0'));
          const prob = n > 1 ? n / 100 : n;
          return Math.round(Math.max(0, Math.min(1, prob)) * 100);
        };

        // Transform API results to PolyMarket format
        const transformed: PolyMarket[] = markets.flatMap((market: any) => {
          const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];
          const eventSlug = market.eventSlug || market.slug || '';
          const marketSlug = market.slug || '';

          // If no nested outcomes, treat as a single market
          if (outcomes.length === 0 || typeof outcomes[0] === 'string') {
            const yesCents = toCents(market.yesPrice || market.outcomePrices?.[0] || 50);
            return [{
              id: market.conditionId || market.id || eventSlug,
              conditionId: market.conditionId || '',
              slug: marketSlug,
              eventSlug,
              marketUrl: market.marketUrl || (eventSlug ? `https://polymarket.com/event/${eventSlug}${marketSlug ? `/${marketSlug}` : ''}` : ''),
              title: market.question || market.title,
              question: market.question || market.title,
              description: market.description,
              image: market.image,
              volume24h: Number(market.volume24hr || market.volume24h || 0),
              volume: Number(market.volume || 0),
              liquidity: Number(market.liquidity || 0),
              endDate: market.endDate,
              yesPrice: yesCents,
              noPrice: 100 - yesCents,
              yesTokenId: market.yesTokenId ?? null,
              noTokenId: market.noTokenId ?? null,
            }];
          }

          // Handle nested outcomes
          return outcomes.map((outcome: any) => {
            const outcomeSlug = outcome.slug || '';
            const yesCents = toCents(outcome.yesPrice);

            return {
              id: outcome.conditionId || `${market.id}-${outcomeSlug}`,
              conditionId: outcome.conditionId || '',
              slug: outcomeSlug,
              eventSlug,
              marketUrl: eventSlug && outcomeSlug ? `https://polymarket.com/event/${eventSlug}/${outcomeSlug}` : (eventSlug ? `https://polymarket.com/event/${eventSlug}` : ''),
              title: outcome.question || market.title,
              question: outcome.question || market.title,
              description: market.description,
              image: outcome.image || market.image,
              volume24h: Number(outcome.volume24hr || 0),
              volume: Number(outcome.volume || market.volume || 0),
              liquidity: Number(outcome.liquidity || market.liquidity || 0),
              endDate: outcome.endDate || market.endDate,
              yesPrice: yesCents,
              noPrice: 100 - yesCents,
              yesTokenId: outcome.yesTokenId ?? null,
              noTokenId: outcome.noTokenId ?? null,
              outcomes: Array.isArray(outcome.outcomes) ? outcome.outcomes : ['Yes', 'No'],
            } as PolyMarket;
          });
        });

        const filtered = transformed.filter((m: PolyMarket) => Boolean(m.title));
        console.log('[Sidebar] Transformed markets:', filtered.length);
        setApiResults(filtered);
      } catch (err) {
        console.error('[Sidebar] Search error:', err);
        setApiResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  // Infinite scroll - observe the load more trigger
  useEffect(() => {
    if (!loadMoreRef.current || !onLoadMore || !hasMore || loadingMore || search.length >= 3) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loadingMore, search]);

  // Local filter for < 3 chars
  const filteredMarkets = useMemo(() => {
    if (!search.trim()) return markets;
    const query = search.toLowerCase();
    return markets.filter(m =>
      m.title.toLowerCase().includes(query) ||
      m.question?.toLowerCase().includes(query)
    );
  }, [markets, search]);

  // Use API results if searching with 3+ chars, otherwise local filter
  const displayMarkets = search.length >= 3 ? apiResults : filteredMarkets;

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    return `$${vol.toFixed(0)}`;
  };

  if (collapsed) {
    return (
      <div className="h-full w-full bg-card/80 backdrop-blur-xl flex flex-col items-center py-4 overflow-hidden">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground rotate-90 mt-2">{markets.length}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-card/80 backdrop-blur-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Markets</span>
          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            {search.length >= 3 ? displayMarkets.length : markets.length}
          </span>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all markets..."
            className="pl-9 h-9 text-sm bg-muted/40 border-border/30 focus:border-primary/50"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
          )}
        </div>
        {search.length > 0 && search.length < 3 && (
          <p className="text-[10px] text-muted-foreground mt-1 px-1">
            Type 3+ characters to search all Polymarket
          </p>
        )}
      </div>

      {/* Market List - Scrolls independently */}
      <ScrollArea className="flex-1 min-h-0">
        {loading && displayMarkets.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary/50 animate-spin" />
          </div>
        ) : displayMarkets.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {search.length >= 3 && !searching ? 'No markets found' : 'No markets found'}
            </p>
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="text-xs text-primary hover:underline mt-2"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            <AnimatePresence mode="sync">
              {displayMarkets.map((market) => (
                <motion.button
                  key={market.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => onSelectMarket(market)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl transition-all',
                    'hover:bg-muted/50',
                    selectedMarket?.id === market.id
                      ? 'bg-primary/10 border border-primary/30 shadow-sm'
                      : 'border border-transparent'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {market.image && (
                      <img
                        src={market.image}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shrink-0 shadow-sm"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed">
                        {market.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn(
                          'text-sm font-bold font-mono',
                          market.yesPrice >= 50 ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {market.yesPrice}¢
                        </span>
                        {market.yesPrice >= 50 ? (
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                          {formatVolume(market.volume24h || market.volume)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
            
            {/* Load more trigger */}
            {search.length < 3 && hasMore && (
              <div ref={loadMoreRef} className="py-4 flex justify-center">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Loading more...</span>
                  </div>
                ) : (
                  <div className="h-4" /> 
                )}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
