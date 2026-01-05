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
  const lastMessageTimeRef = useRef<number>(Date.now());

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

        // Check for success response structure
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
          // Each event may have multiple outcomes
          const outcomes = event.outcomes || [];
          
          if (outcomes.length === 0) {
            // Single outcome event - use event directly
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

  // Connect to Dome WebSocket for live trades
  const connectWebSocket = useCallback(async () => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      if (!wsUrlRef.current) {
        const { data, error: fnError } = await supabase.functions.invoke('dome-ws-url');
        if (fnError || !data?.wsUrl) {
          console.error('Failed to get WebSocket URL:', fnError);
          setError('Failed to connect to live feed');
          return;
        }
        wsUrlRef.current = data.wsUrl;
      }

      const ws = new WebSocket(wsUrlRef.current);

      ws.onopen = () => {
        console.log('[PolyTerminal] WebSocket connected');
        setConnected(true);
        setError(null);
        lastMessageTimeRef.current = Date.now();

        // Subscribe to all Polymarket orders
        ws.send(JSON.stringify({
          action: 'subscribe',
          platform: 'polymarket',
          version: 1,
          type: 'orders',
          filters: {
            users: ['*'],
          },
        }));
      };

      ws.onmessage = (event) => {
        lastMessageTimeRef.current = Date.now();
        const data = JSON.parse(event.data);

        if (data.type === 'event') {
          const rawTrade = data.data;
          
          // Only add trades for selected market if we have one
          if (selectedMarket && rawTrade.condition_id !== selectedMarket.conditionId && 
              rawTrade.market_slug !== selectedMarket.slug) {
            return;
          }

          const newTrade: Trade = {
            id: rawTrade.order_hash || `${rawTrade.tx_hash}-${rawTrade.timestamp}`,
            ...rawTrade,
          };

          setTrades(prev => {
            const exists = prev.some(t => t.id === newTrade.id);
            if (exists) return prev;
            return [newTrade, ...prev.slice(0, 99)];
          });
        }
      };

      ws.onerror = () => {
        console.error('[PolyTerminal] WebSocket error');
        setError('Connection error');
      };

      ws.onclose = () => {
        console.log('[PolyTerminal] WebSocket closed');
        setConnected(false);
        wsRef.current = null;

        // Auto-reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[PolyTerminal] Connection error:', err);
      setError('Failed to connect');
    }
  }, [enabled, selectedMarket]);

  // Fetch orderbook data for selected market
  const fetchOrderbook = useCallback(async () => {
    if (!selectedMarket?.conditionId) return;

    try {
      const { data, error: fnError } = await supabase.functions.invoke('market-dashboard', {
        body: {
          marketSlug: selectedMarket.slug,
          conditionId: selectedMarket.conditionId,
        },
      });

      if (fnError) throw fnError;

      // Parse orderbook from response
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
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled, connectWebSocket]);

  // Fetch orderbook when market changes
  useEffect(() => {
    if (selectedMarket) {
      fetchOrderbook();
      setTrades([]); // Clear trades when switching markets
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
