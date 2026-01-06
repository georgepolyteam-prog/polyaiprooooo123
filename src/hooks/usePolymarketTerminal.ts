import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { terminalCache } from '@/lib/terminal-cache';

// Custom hook to track tab visibility
function useTabVisibility() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return isVisible;
}

export interface PolyMarket {
  id: string;
  conditionId: string;
  /** Polymarket market slug (outcome-level) */
  slug: string;
  /** Polymarket event slug (event-level) */
  eventSlug: string;
  /** Canonical Polymarket URL for this market/outcome */
  marketUrl: string;
  title: string;
  question: string;
  description?: string;
  image?: string;
  volume24h: number;
  volume: number;
  liquidity: number;
  endDate?: string;
  yesPrice: number; // cents (0-100)
  noPrice: number; // cents (0-100)
  yesTokenId?: string | null;
  noTokenId?: string | null;
  outcomes?: string[];
}

export interface Trade {
  id: string;
  token_id: string;
  token_label: string;
  side: 'BUY' | 'SELL';
  market_slug: string;
  condition_id: string;
  shares: number;
  shares_normalized: number;
  price: number;
  tx_hash: string;
  title: string;
  timestamp: number;
  order_hash: string;
  user: string;
  taker: string;
  image?: string;
}

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface Orderbook {
  yesBids: OrderbookLevel[];
  yesAsks: OrderbookLevel[];
  noBids: OrderbookLevel[];
  noAsks: OrderbookLevel[];
  spread: number;
  midPrice: number;
}

interface UsePolymarketTerminalOptions {
  enabled?: boolean;
}

// Number of markets to prefetch data for
const PREFETCH_COUNT = 10;

export function usePolymarketTerminal({ enabled = true }: UsePolymarketTerminalOptions = {}) {
  const [markets, setMarkets] = useState<PolyMarket[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<PolyMarket | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [orderbook, setOrderbook] = useState<Orderbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMarketData, setLoadingMarketData] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const isTabVisible = useTabVisibility();

  // Request ID ref to prevent stale responses from overwriting state
  const requestIdRef = useRef(0);
  const isFirstFetchRef = useRef(true);
  const offsetRef = useRef(0);
  const prefetchedRef = useRef(false);
  const BATCH_SIZE = 50;

  // Helper to transform events to markets
  const transformEvents = useCallback((events: any[]): PolyMarket[] => {
    const toCents = (p: unknown): number => {
      const n = typeof p === 'number' ? p : parseFloat(String(p ?? '0'));
      const prob = n > 1 ? n / 100 : n;
      return Math.round(Math.max(0, Math.min(1, prob)) * 100);
    };

    const transformedMarkets: PolyMarket[] = events.flatMap((event: any) => {
      const outcomes = Array.isArray(event.outcomes) ? event.outcomes : [];
      const eventSlug = event.slug || '';

      if (outcomes.length === 0) {
        return [
          {
            id: event.id || eventSlug,
            conditionId: '',
            slug: eventSlug,
            eventSlug,
            marketUrl: eventSlug ? `https://polymarket.com/event/${eventSlug}` : '',
            title: event.title,
            question: event.title,
            description: event.description,
            image: event.image,
            volume24h: Number(event.volume24hr || 0),
            volume: Number(event.volume || 0),
            liquidity: Number(event.liquidity || 0),
            endDate: event.endDate,
            yesPrice: 50,
            noPrice: 50,
          },
        ];
      }

      return outcomes.map((outcome: any) => {
        const marketSlug = outcome.slug || '';
        const yesCents = toCents(outcome.yesPrice);
        const yesTokenId = outcome.yesTokenId ?? null;
        
        let marketUrl = '';
        if (eventSlug && marketSlug) {
          marketUrl = `https://polymarket.com/event/${eventSlug}/${marketSlug}`;
          if (yesTokenId) {
            marketUrl += `?tid=${yesTokenId}`;
          }
        } else if (eventSlug) {
          marketUrl = `https://polymarket.com/event/${eventSlug}`;
        }

        return {
          id: outcome.conditionId || `${event.id}-${marketSlug}`,
          conditionId: outcome.conditionId || '',
          slug: marketSlug,
          eventSlug,
          marketUrl,
          title: outcome.question || event.title,
          question: outcome.question || event.title,
          description: event.description,
          image: outcome.image || event.image,
          volume24h: Number(outcome.volume24hr || 0),
          volume: Number(outcome.volume || event.volume || 0),
          liquidity: Number(outcome.liquidity || event.liquidity || 0),
          endDate: outcome.endDate || event.endDate,
          yesPrice: yesCents,
          noPrice: 100 - yesCents,
          yesTokenId,
          noTokenId: outcome.noTokenId ?? null,
          outcomes: Array.isArray(outcome.outcomes) ? outcome.outcomes : ['Yes', 'No'],
        } as PolyMarket;
      });
    });

    return transformedMarkets.filter((m) =>
      Boolean(m.title) && Boolean(m.eventSlug) && Boolean(m.slug) && m.yesPrice >= 0 && m.yesPrice <= 100,
    );
  }, []);

  // Fetch top markets on mount - check cache first
  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        setError(null);

        // Check cache first for instant load
        const cachedMarkets = terminalCache.getMarkets();
        if (cachedMarkets && cachedMarkets.length > 0) {
          console.log('[PolyTerminal] Using cached markets for instant load');
          setMarkets(cachedMarkets);
          setSelectedMarket((prev) => prev ?? cachedMarkets[0]);
          setLoading(false);
          // Continue to fetch fresh data in background
        } else {
          setLoading(true);
        }

        const { data, error: fnError } = await supabase.functions.invoke('polymarket-data', {
          body: {
            action: 'getEvents',
            limit: 50,
            order: 'volume',
            ascending: false,
          },
        });

        if (fnError) throw fnError;
        if (!data?.success || !Array.isArray(data?.events)) {
          throw new Error('Invalid markets response');
        }

        const events = data.events as any[];

        if (events.length === 0) {
          console.log('[PolyTerminal] No events returned');
          if (!cachedMarkets) setError('No markets available');
          return;
        }

        console.log(`[PolyTerminal] Fetched ${events.length} events`);

        const validMarkets = transformEvents(events);

        console.log(`[PolyTerminal] Transformed ${validMarkets.length} markets`);
        setMarkets(validMarkets);
        offsetRef.current = BATCH_SIZE;
        setHasMore(events.length >= BATCH_SIZE);

        // Cache the markets list
        terminalCache.setMarkets(validMarkets);

        // Auto-select first market
        if (validMarkets.length > 0) {
          setSelectedMarket((prev) => prev ?? validMarkets[0]);
        }
      } catch (err) {
        console.error('[PolyTerminal] Failed to fetch markets:', err);
        if (!terminalCache.getMarkets()) {
          setError('Failed to load markets');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, [transformEvents]);

  // Load more markets (pagination)
  const loadMoreMarkets = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('polymarket-data', {
        body: {
          action: 'getEvents',
          limit: BATCH_SIZE,
          offset: offsetRef.current,
          order: 'volume',
          ascending: false,
        },
      });

      if (fnError) throw fnError;
      if (!data?.success || !Array.isArray(data?.events)) {
        setHasMore(false);
        return;
      }

      const events = data.events as any[];
      if (events.length === 0) {
        setHasMore(false);
        return;
      }

      console.log(`[PolyTerminal] Loaded ${events.length} more events`);

      const validMarkets = transformEvents(events);

      // Append to existing markets, filtering duplicates
      setMarkets(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMarkets = validMarkets.filter(m => !existingIds.has(m.id));
        const combined = [...prev, ...newMarkets];
        // Update cache with combined list
        terminalCache.setMarkets(combined);
        return combined;
      });

      offsetRef.current += BATCH_SIZE;
      setHasMore(events.length >= BATCH_SIZE);
    } catch (err) {
      console.error('[PolyTerminal] Failed to load more markets:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, transformEvents]);

  // Process orderbook from raw API response
  const processOrderbook = useCallback((raw: any, fallbackPrice: number): Orderbook | null => {
    if (!raw) return null;

    const yesBids: OrderbookLevel[] = (raw.bids || []).map((l: any) => ({
      price: Number(l.price ?? 0),
      size: Number(l.size ?? 0),
    }));

    const yesAsks: OrderbookLevel[] = (raw.asks || []).map((l: any) => ({
      price: Number(l.price ?? 0),
      size: Number(l.size ?? 0),
    }));

    const invert = (levels: OrderbookLevel[]) =>
      levels
        .map((l) => ({ ...l, price: Math.max(0, Math.min(100, 100 - l.price)) }))
        .filter((l) => l.size > 0);

    const noBids = invert(yesAsks).sort((a, b) => b.price - a.price);
    const noAsks = invert(yesBids).sort((a, b) => a.price - b.price);

    const bestBid = yesBids[0]?.price;
    const bestAsk = yesAsks[0]?.price;
    const spread = bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : 0;
    const midPrice = bestBid !== undefined && bestAsk !== undefined ? (bestBid + bestAsk) / 2 : fallbackPrice;

    return { yesBids, yesAsks, noBids, noAsks, spread, midPrice };
  }, []);

  // Process trades from raw API response
  const processTrades = useCallback((recent: any[], marketSlug: string, market: PolyMarket): Trade[] => {
    return recent.map((t: any, idx: number) => {
      const tsMs = t.timestamp ? new Date(t.timestamp).getTime() : Date.now();
      const price01 = Number.isFinite(Number(t.rawPrice)) ? Number(t.rawPrice) : Number(t.price ?? 0) / 100;
      const shares = Number(t.shares ?? 0);
      return {
        id: String(t.id ?? `${marketSlug}-${tsMs}-${idx}`),
        token_id: '',
        token_label: String(t.outcome || 'YES') === 'NO' ? 'No' : 'Yes',
        side: String(t.side || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
        market_slug: marketSlug,
        condition_id: market.conditionId,
        shares,
        shares_normalized: shares,
        price: price01,
        tx_hash: '',
        title: market.title,
        timestamp: Math.floor(tsMs / 1000),
        order_hash: '',
        user: String(t.wallet || ''),
        taker: '',
        image: market.image,
      };
    });
  }, []);

  // Fetch market data for a specific market (used for both main fetch and prefetch)
  const fetchMarketDataForMarket = useCallback(async (market: PolyMarket): Promise<{ orderbook: Orderbook | null; trades: Trade[] } | null> => {
    if (!market?.marketUrl) return null;

    try {
      const { data, error: fnError } = await supabase.functions.invoke('market-dashboard', {
        body: {
          marketUrl: market.marketUrl,
          yesTokenId: market.yesTokenId ?? undefined,
          noTokenId: market.noTokenId ?? undefined,
        },
      });

      if (fnError) throw fnError;

      const processedOrderbook = processOrderbook(data?.orderbook, market.yesPrice);
      const recent = Array.isArray(data?.recentTrades) ? data.recentTrades : [];
      const processedTrades = processTrades(recent, market.slug, market);

      return { orderbook: processedOrderbook, trades: processedTrades };
    } catch (err) {
      console.error(`[PolyTerminal] Failed to fetch data for ${market.slug}:`, err);
      return null;
    }
  }, [processOrderbook, processTrades]);

  // Fetch market data (orderbook + trades) via polling with stale-response protection
  const fetchMarketData = useCallback(async () => {
    if (!selectedMarket?.marketUrl) return;

    const currentRequestId = ++requestIdRef.current;
    const requestMarketSlug = selectedMarket.slug;

    // Check cache first for instant data
    if (isFirstFetchRef.current) {
      const cached = terminalCache.getMarketData(requestMarketSlug);
      if (cached) {
        console.log(`[PolyTerminal] Using cached data for instant load: ${requestMarketSlug}`);
        setOrderbook(cached.orderbook);
        setTrades(cached.trades);
        setLoadingMarketData(false);
        // Continue to fetch fresh data
      } else {
        setLoadingMarketData(true);
      }
    }

    try {
      setFetchError(null);
      const result = await fetchMarketDataForMarket(selectedMarket);

      // STALE RESPONSE CHECK
      if (currentRequestId !== requestIdRef.current) {
        console.log('[PolyTerminal] Discarding stale response for:', requestMarketSlug);
        return;
      }

      if (result) {
        setOrderbook(result.orderbook);
        setTrades(result.trades);
        setLastUpdateTime(Date.now());

        // Cache the fresh data
        terminalCache.setMarketData(requestMarketSlug, result.orderbook, result.trades);
      }

      isFirstFetchRef.current = false;
    } catch (err) {
      if (currentRequestId === requestIdRef.current) {
        console.error('[PolyTerminal] Failed to fetch market data:', err);
        setFetchError('Failed to load market data');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoadingMarketData(false);
      }
    }
  }, [selectedMarket, fetchMarketDataForMarket]);

  // Prefetch data for first 10 markets after initial load
  useEffect(() => {
    if (prefetchedRef.current || markets.length === 0) return;
    
    prefetchedRef.current = true;
    const marketsToPrefetch = markets.slice(1, PREFETCH_COUNT); // Skip first (already loading)
    
    if (marketsToPrefetch.length > 0) {
      console.log(`[PolyTerminal] Prefetching data for ${marketsToPrefetch.length} markets`);
      terminalCache.prefetchMarkets(marketsToPrefetch, fetchMarketDataForMarket);
    }
  }, [markets, fetchMarketDataForMarket]);

  // Clear trades when market changes
  useEffect(() => {
    if (selectedMarket) {
      // Clear stale data immediately when market changes
      setTrades([]);
      setOrderbook(null);
      setFetchError(null);
      isFirstFetchRef.current = true; // Reset first fetch flag
      setLoadingMarketData(true);
      fetchMarketData();
    }
  }, [selectedMarket?.slug]);

  // Poll every 2 seconds for live updates (only when tab is visible)
  useEffect(() => {
    if (!enabled || !selectedMarket || !isTabVisible) return;

    const interval = setInterval(fetchMarketData, 2000);
    return () => clearInterval(interval);
  }, [enabled, selectedMarket, isTabVisible, fetchMarketData]);

  // Retry function for manual refresh
  const retryFetch = useCallback(() => {
    setFetchError(null);
    if (selectedMarket) fetchMarketData();
  }, [selectedMarket, fetchMarketData]);

  // Calculate stats from trades
  const stats = useMemo(() => {
    const buyTrades = trades.filter(t => t.side === 'BUY');
    const sellTrades = trades.filter(t => t.side === 'SELL');
    
    const buyVolume = buyTrades.reduce((sum, t) => sum + (t.price * (t.shares_normalized || t.shares)), 0);
    const sellVolume = sellTrades.reduce((sum, t) => sum + (t.price * (t.shares_normalized || t.shares)), 0);

    return {
      tradeCount: trades.length,
      buyCount: buyTrades.length,
      sellCount: sellTrades.length,
      buyVolume,
      sellVolume,
      netFlow: buyVolume - sellVolume,
    };
  }, [trades]);

  return {
    markets,
    selectedMarket,
    setSelectedMarket,
    trades,
    orderbook,
    stats,
    connected: true, // Always "connected" since we use polling
    loading,
    loadingMarketData,
    loadingMore,
    hasMore,
    loadMoreMarkets,
    error,
    fetchError,
    retryFetch,
    refetchOrderbook: fetchMarketData,
    reconnect: fetchMarketData,
    reconnectAttempts: 0,
    lastMessageTime: lastUpdateTime,
  };
}
