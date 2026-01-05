import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

const MAX_RECONNECT_ATTEMPTS = 5;

export function usePolymarketTerminal({ enabled = true }: UsePolymarketTerminalOptions = {}) {
  const [markets, setMarkets] = useState<PolyMarket[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<PolyMarket | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [orderbook, setOrderbook] = useState<Orderbook | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const wsUrlRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const subscriptionIdRef = useRef<string | null>(null);
  const isConnectingRef = useRef(false);
  const lastMessageTimeRef = useRef<number | null>(null);

  // Keep latest market filter in a ref so WebSocket handlers always use the current market
  const marketFilterRef = useRef<{ slug?: string | null; conditionId?: string | null } | null>(null);

  // Seed trades from the market-dashboard "recentTrades" only once per selected market
  const seededTradesMarketSlugRef = useRef<string | null>(null);

  // Fetch top markets on mount
  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        setLoading(true);
        setError(null);

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
          setError('No markets available');
          return;
        }

        console.log(`[PolyTerminal] Fetched ${events.length} events`);

        const toCents = (p: unknown): number => {
          const n = typeof p === 'number' ? p : parseFloat(String(p ?? '0'));
          // Dome/Gamma prices are typically 0..1. If we ever get 0..100, normalize.
          const prob = n > 1 ? n / 100 : n;
          return Math.round(Math.max(0, Math.min(1, prob)) * 100);
        };

        // Flatten events -> outcome-level markets
        const transformedMarkets: PolyMarket[] = events.flatMap((event: any) => {
          const outcomes = Array.isArray(event.outcomes) ? event.outcomes : [];
          const eventSlug = event.slug || '';

          // Fallback (should be rare): create a single pseudo-market
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

            return {
              id: outcome.conditionId || `${event.id}-${marketSlug}`,
              conditionId: outcome.conditionId || '',
              slug: marketSlug,
              eventSlug,
              marketUrl: eventSlug && marketSlug ? `https://polymarket.com/event/${eventSlug}/${marketSlug}` : (eventSlug ? `https://polymarket.com/event/${eventSlug}` : ''),
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
              yesTokenId: outcome.yesTokenId ?? null,
              noTokenId: outcome.noTokenId ?? null,
              outcomes: Array.isArray(outcome.outcomes) ? outcome.outcomes : ['Yes', 'No'],
            } as PolyMarket;
          });
        });

        const validMarkets = transformedMarkets.filter((m) =>
          Boolean(m.title) && Boolean(m.eventSlug) && Boolean(m.slug) && m.yesPrice >= 0 && m.yesPrice <= 100,
        );

        console.log(`[PolyTerminal] Transformed ${validMarkets.length} markets`);
        setMarkets(validMarkets);

        // Auto-select first market
        if (validMarkets.length > 0) {
          setSelectedMarket((prev) => prev ?? validMarkets[0]);
        }
      } catch (err) {
        console.error('[PolyTerminal] Failed to fetch markets:', err);
        setError('Failed to load markets');
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, []);

  // Subscribe to market-specific orders
  const subscribeToMarket = useCallback((ws: WebSocket, market: PolyMarket | null) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Build subscription based on market
    const subscription: any = {
      action: 'subscribe',
      platform: 'polymarket',
      version: 1,
      type: 'orders',
      filters: {},
    };

    if (market?.slug) {
      // Subscribe to specific market by slug
      subscription.filters.market_slugs = [market.slug];
      console.log(`[PolyTerminal] Subscribing to market: ${market.slug}`);
    } else if (market?.conditionId) {
      // Fallback to condition_id if no slug
      subscription.filters.condition_ids = [market.conditionId];
      console.log(`[PolyTerminal] Subscribing to condition: ${market.conditionId}`);
    } else {
      // Subscribe to all trades (requires Dev tier)
      subscription.filters.users = ['*'];
      console.log('[PolyTerminal] Subscribing to all trades');
    }

    ws.send(JSON.stringify(subscription));
  }, []);

  // Update subscription when market changes
  const updateSubscription = useCallback((ws: WebSocket, market: PolyMarket | null) => {
    if (ws.readyState !== WebSocket.OPEN || !subscriptionIdRef.current) {
      // No existing subscription, create new one
      subscribeToMarket(ws, market);
      return;
    }

    // Update existing subscription
    const update: any = {
      action: 'update',
      subscription_id: subscriptionIdRef.current,
      platform: 'polymarket',
      version: 1,
      type: 'orders',
      filters: {},
    };

    if (market?.slug) {
      update.filters.market_slugs = [market.slug];
      console.log(`[PolyTerminal] Updating subscription to market: ${market.slug}`);
    } else if (market?.conditionId) {
      update.filters.condition_ids = [market.conditionId];
      console.log(`[PolyTerminal] Updating subscription to condition: ${market.conditionId}`);
    } else {
      update.filters.users = ['*'];
      console.log('[PolyTerminal] Updating subscription to all trades');
    }

    ws.send(JSON.stringify(update));
  }, [subscribeToMarket]);

  // Connect to Dome WebSocket for live trades
  const connectWebSocket = useCallback(async () => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN || isConnectingRef.current) return;

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[PolyTerminal] Max reconnection attempts reached');
      setError('Connection failed after max retries');
      return;
    }

    try {
      isConnectingRef.current = true;
      
      if (!wsUrlRef.current) {
        console.log('[PolyTerminal] Fetching WebSocket URL...');
        const { data, error: fnError } = await supabase.functions.invoke('dome-ws-url');
        if (fnError || !data?.wsUrl) {
          console.error('[PolyTerminal] Failed to get WebSocket URL:', fnError);
          setError('Failed to connect to live feed');
          isConnectingRef.current = false;
          return;
        }
        wsUrlRef.current = data.wsUrl;
      }

      console.log(`[PolyTerminal] Connecting to Dome WebSocket (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
      const ws = new WebSocket(wsUrlRef.current);

      ws.onopen = () => {
        console.log('[PolyTerminal] ✅ WebSocket connected');
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        subscriptionIdRef.current = null;

        // Subscribe to current market
        subscribeToMarket(ws, selectedMarket);
      };

      ws.onmessage = (event) => {
        try {
          lastMessageTimeRef.current = Date.now();
          const data = JSON.parse(event.data);

          if (data.type === 'ack') {
            // Subscription acknowledged - store the subscription ID
            subscriptionIdRef.current = data.subscription_id;
            console.log(`[PolyTerminal] 📡 Subscription confirmed: ${data.subscription_id}`);
          } else if (data.type === 'event') {
            const rawTrade = data.data;

            const filter = marketFilterRef.current;
            if (filter) {
              const matchesSlug = filter.slug && rawTrade.market_slug && rawTrade.market_slug === filter.slug;
              const matchesCondition = filter.conditionId && rawTrade.condition_id && rawTrade.condition_id === filter.conditionId;
              if (!matchesSlug && !matchesCondition) {
                return;
              }
            }

            console.log('[PolyTerminal] 📦 Trade received:', {
              side: rawTrade.side,
              token_label: rawTrade.token_label,
              price: rawTrade.price,
              shares: rawTrade.shares_normalized,
              market: rawTrade.market_slug,
            });

            const newTrade: Trade = {
              id: rawTrade.order_hash || `${rawTrade.tx_hash}-${rawTrade.timestamp}`,
              token_id: rawTrade.token_id || '',
              token_label: rawTrade.token_label || 'Yes',
              side: rawTrade.side || 'BUY',
              market_slug: rawTrade.market_slug || '',
              condition_id: rawTrade.condition_id || '',
              shares: rawTrade.shares || 0,
              shares_normalized: rawTrade.shares_normalized || rawTrade.shares / 1000000 || 0,
              price: rawTrade.price || 0,
              tx_hash: rawTrade.tx_hash || '',
              title: rawTrade.title || '',
              timestamp: rawTrade.timestamp || Math.floor(Date.now() / 1000),
              order_hash: rawTrade.order_hash || '',
              user: rawTrade.user || '',
              taker: rawTrade.taker || '',
              image: rawTrade.image,
            };

            setTrades((prev) => {
              const exists = prev.some((t) => t.id === newTrade.id);
              if (exists) return prev;
              return [newTrade, ...prev.slice(0, 99)];
            });
          } else if (data.type === 'error') {
            console.error('[PolyTerminal] ❌ WebSocket error:', data.message || data);
          }
        } catch (parseErr) {
          console.error('[PolyTerminal] Failed to parse message:', parseErr);
        }
      };

      ws.onerror = () => {
        console.error('[PolyTerminal] ❌ WebSocket error');
        setError('Connection error');
        isConnectingRef.current = false;
      };

      ws.onclose = (event) => {
        console.log(`[PolyTerminal] 🔌 WebSocket closed: ${event.code}`);
        setConnected(false);
        wsRef.current = null;
        subscriptionIdRef.current = null;
        isConnectingRef.current = false;

        // Auto-reconnect with exponential backoff
        if (enabled && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && event.code !== 1000) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 16000);
          console.log(`[PolyTerminal] 🔄 Reconnecting in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connectWebSocket();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[PolyTerminal] Connection error:', err);
      setError('Failed to connect');
      isConnectingRef.current = false;
    }
  }, [enabled, selectedMarket, subscribeToMarket]);

  // Fetch orderbook data for selected market
  const fetchOrderbook = useCallback(async () => {
    if (!selectedMarket?.marketUrl) return;

    try {
      const { data, error: fnError } = await supabase.functions.invoke('market-dashboard', {
        body: {
          marketUrl: selectedMarket.marketUrl,
          yesTokenId: selectedMarket.yesTokenId ?? undefined,
          noTokenId: selectedMarket.noTokenId ?? undefined,
        },
      });

      if (fnError) throw fnError;

      const raw = data?.orderbook;

      // Seed the trades feed immediately from the dashboard response (so it's not empty while waiting for WS)
      const recent = Array.isArray(data?.recentTrades) ? (data.recentTrades as any[]) : [];
      if (selectedMarket?.slug && seededTradesMarketSlugRef.current !== selectedMarket.slug) {
        if (recent.length > 0) {
          const seeded: Trade[] = recent.map((t: any, idx: number) => {
            const tsMs = t.timestamp ? new Date(t.timestamp).getTime() : Date.now();
            const price01 = Number.isFinite(Number(t.rawPrice)) ? Number(t.rawPrice) : Number(t.price ?? 0) / 100;
            const shares = Number(t.shares ?? 0);
            return {
              id: String(t.id ?? `${selectedMarket.slug}-${tsMs}-${idx}`),
              token_id: '',
              token_label: String(t.outcome || 'YES') === 'NO' ? 'No' : 'Yes',
              side: String(t.side || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
              market_slug: selectedMarket.slug,
              condition_id: selectedMarket.conditionId,
              shares,
              shares_normalized: shares,
              price: price01,
              tx_hash: '',
              title: selectedMarket.title,
              timestamp: Math.floor(tsMs / 1000),
              order_hash: '',
              user: String(t.wallet || ''),
              taker: '',
              image: selectedMarket.image,
            };
          });
          setTrades(seeded);
        }
        seededTradesMarketSlugRef.current = selectedMarket.slug;
      }

      if (!raw) {
        setOrderbook(null);
        return;
      }

      const yesBids: OrderbookLevel[] = (raw.bids || []).map((l: any) => ({
        price: Number(l.price ?? 0),
        size: Number(l.size ?? 0),
      }));

      const yesAsks: OrderbookLevel[] = (raw.asks || []).map((l: any) => ({
        price: Number(l.price ?? 0),
        size: Number(l.size ?? 0),
      }));

      // Derive NO-side by inverting YES-side prices (NO = 100 - YES)
      const invert = (levels: OrderbookLevel[]) =>
        levels
          .map((l) => ({ ...l, price: Math.max(0, Math.min(100, 100 - l.price)) }))
          .filter((l) => l.size > 0);

      const noBids = invert(yesAsks).sort((a, b) => b.price - a.price);
      const noAsks = invert(yesBids).sort((a, b) => a.price - b.price);

      const bestBid = yesBids[0]?.price;
      const bestAsk = yesAsks[0]?.price;
      const spread = bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : 0;
      const midPrice = bestBid !== undefined && bestAsk !== undefined ? (bestBid + bestAsk) / 2 : selectedMarket.yesPrice;

      setOrderbook({
        yesBids,
        yesAsks,
        noBids,
        noAsks,
        spread,
        midPrice,
      });
    } catch (err) {
      console.error('[PolyTerminal] Failed to fetch orderbook:', err);
    }
  }, [selectedMarket]);

  // Connect WebSocket when enabled
  useEffect(() => {
    if (enabled) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000);
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled]);

  // Update subscription when market changes
  useEffect(() => {
    marketFilterRef.current = selectedMarket
      ? { slug: selectedMarket.slug, conditionId: selectedMarket.conditionId }
      : null;

    // When switching markets, clear feed and allow a new seed from market-dashboard
    seededTradesMarketSlugRef.current = null;
    setTrades([]);

    if (!selectedMarket) return;

    // Update WS subscription if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      updateSubscription(wsRef.current, selectedMarket);
    }

    // Fetch orderbook + seed trades
    fetchOrderbook();
  }, [selectedMarket?.slug, selectedMarket?.conditionId]);

  // Fetch orderbook when market changes
  useEffect(() => {
    if (selectedMarket) {
      fetchOrderbook();
    }
  }, [selectedMarket, fetchOrderbook]);

  // Poll orderbook every 2 seconds (snappier “live” feel)
  useEffect(() => {
    if (!selectedMarket) return;

    const interval = setInterval(fetchOrderbook, 2000);
    return () => clearInterval(interval);
  }, [selectedMarket, fetchOrderbook]);

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

  // Expose reconnect helper
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    wsRef.current?.close();
    connectWebSocket();
  }, [connectWebSocket]);

  return {
    markets,
    selectedMarket,
    setSelectedMarket,
    trades,
    orderbook,
    stats,
    connected,
    loading,
    error,
    refetchOrderbook: fetchOrderbook,
    reconnect,
    reconnectAttempts: reconnectAttemptsRef.current,
    lastMessageTime: lastMessageTimeRef.current,
  };
}
