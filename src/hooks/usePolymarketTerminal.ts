import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PolyMarket {
  id: string;
  conditionId: string;
  slug: string;
  title: string;
  question: string;
  description?: string;
  image?: string;
  volume24h: number;
  volume: number;
  liquidity: number;
  endDate?: string;
  yesPrice: number;
  noPrice: number;
  outcomes: string[];
  tokens: { tokenId: string; outcome: string }[];
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

        const events = data?.events || [];
        
        if (events.length === 0) {
          console.log('[PolyTerminal] No events returned');
          setError('No markets available');
          setLoading(false);
          return;
        }

        console.log(`[PolyTerminal] Fetched ${events.length} events`);

        // Transform events into flat market list
        const transformedMarkets: PolyMarket[] = events.flatMap((event: any) => {
          const outcomes = event.outcomes || [];
          
          if (outcomes.length === 0) {
            return [{
              id: event.id || event.slug,
              conditionId: event.conditionId || '',
              slug: event.slug || '',
              title: event.title,
              question: event.title,
              description: event.description,
              image: event.image,
              volume24h: parseFloat(event.volume24hr || event.volume24h || 0),
              volume: parseFloat(event.volume || 0),
              liquidity: parseFloat(event.liquidity || 0),
              endDate: event.endDate,
              yesPrice: 50,
              noPrice: 50,
              outcomes: ['Yes', 'No'],
              tokens: [],
            }];
          }

          return outcomes.map((outcome: any) => ({
            id: outcome.conditionId || `${event.id}-${outcome.slug}`,
            conditionId: outcome.conditionId || '',
            slug: outcome.slug || event.slug || '',
            title: outcome.question || event.title,
            question: outcome.question || event.title,
            description: event.description,
            image: event.image || outcome.image,
            volume24h: parseFloat(outcome.volume24hr || outcome.volume24h || 0),
            volume: parseFloat(outcome.volume || event.volume || 0),
            liquidity: parseFloat(outcome.liquidity || event.liquidity || 0),
            endDate: outcome.endDate || event.endDate,
            yesPrice: Math.round((parseFloat(outcome.yesPrice || 0.5)) * 100),
            noPrice: Math.round((1 - parseFloat(outcome.yesPrice || 0.5)) * 100),
            outcomes: outcome.outcomes || ['Yes', 'No'],
            tokens: outcome.tokens || [],
          }));
        });

        // Filter out invalid/placeholder markets
        const validMarkets = transformedMarkets.filter(m => 
          m.title && m.yesPrice > 0 && m.yesPrice < 100
        );

        console.log(`[PolyTerminal] Transformed ${validMarkets.length} valid markets`);
        setMarkets(validMarkets);
        
        // Auto-select first market
        if (validMarkets.length > 0 && !selectedMarket) {
          setSelectedMarket(validMarkets[0]);
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
          const data = JSON.parse(event.data);

          if (data.type === 'ack') {
            // Subscription acknowledged - store the subscription ID
            subscriptionIdRef.current = data.subscription_id;
            console.log(`[PolyTerminal] 📡 Subscription confirmed: ${data.subscription_id}`);
          } else if (data.type === 'event') {
            const rawTrade = data.data;
            
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

            setTrades(prev => {
              const exists = prev.some(t => t.id === newTrade.id);
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
    if (!selectedMarket?.conditionId && !selectedMarket?.slug) return;

    try {
      const { data, error: fnError } = await supabase.functions.invoke('market-dashboard', {
        body: {
          marketSlug: selectedMarket.slug,
          conditionId: selectedMarket.conditionId,
        },
      });

      if (fnError) throw fnError;

      if (data?.orderbook) {
        setOrderbook({
          yesBids: data.orderbook.yesBids || [],
          yesAsks: data.orderbook.yesAsks || [],
          noBids: data.orderbook.noBids || [],
          noAsks: data.orderbook.noAsks || [],
          spread: data.orderbook.spread || 0,
          midPrice: data.orderbook.midPrice || 50,
        });
      }
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
    if (selectedMarket && wsRef.current?.readyState === WebSocket.OPEN) {
      updateSubscription(wsRef.current, selectedMarket);
      setTrades([]); // Clear trades when switching markets
      fetchOrderbook();
    }
  }, [selectedMarket?.slug, selectedMarket?.conditionId]);

  // Fetch orderbook when market changes
  useEffect(() => {
    if (selectedMarket) {
      fetchOrderbook();
    }
  }, [selectedMarket, fetchOrderbook]);

  // Poll orderbook every 5 seconds
  useEffect(() => {
    if (!selectedMarket) return;
    
    const interval = setInterval(fetchOrderbook, 5000);
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
  };
}
