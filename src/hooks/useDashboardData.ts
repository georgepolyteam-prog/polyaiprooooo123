import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Trade {
  id: string;
  side: string;
  outcome?: string;
  size: number;
  price: number;
  timeAgo: string;
  wallet: string;
  timestamp: string;
  isNew?: boolean;
  isWhale?: boolean;
}

interface OrderLevel {
  price: number;
  size: number;
}

interface PricePoint {
  timestamp: number;
  price: number;
  volume?: number;
}

interface MultiMarketData {
  needsSelection: boolean;
  eventSlug: string;
  eventTitle: string;
  eventUrl: string;
  markets: Array<{
    id: number;
    market_slug: string;
    question: string;
    yes_price: number;
    volume: number;
  }>;
}

interface TopTrader {
  wallet: string;
  volume: number;
  buyPercent: number;
  trades: number;
  isWhale: boolean;
}

interface MarketInfo {
  description: string | null;
  resolutionSource: string | null;
  tags: string[];
  createdDate?: string;
}

interface DashboardData {
  market: {
    title: string;
    yesPrice: number;
    noPrice: number;
    yesVolume: number;
    noVolume: number;
    totalVolume: number;
    liquidity: number;
    endDate?: string;
    marketUrl: string;
  } | null;
  trades: Trade[];
  orderbook: {
    bids: OrderLevel[];
    asks: OrderLevel[];
    spread: number;
    midPrice: number;
  };
  priceHistory: PricePoint[];
  stats: {
    volume24h: number;
    uniqueTraders: number;
    avgTradeSize: number;
    whaleCount: number;
    whaleVolume: number;
    priceChange1h: number;
    priceChange24h: number;
    priceChange7d: number;
    buyPressure: number;
  };
  topTraders: TopTrader[];
  topTraderStats: {
    whaleCount: number;
    whaleVolume: number;
    totalVolume: number;
    whaleThreshold: number;
  };
  marketInfo: MarketInfo | null;
  multiMarketData: MultiMarketData | null;
  lastUpdate: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
}

export function useDashboardData(marketUrl: string | null, yesTokenId?: string, noTokenId?: string) {
  const [data, setData] = useState<DashboardData>({
    market: null,
    trades: [],
    orderbook: { bids: [], asks: [], spread: 0, midPrice: 0.5 },
    priceHistory: [],
    stats: {
      volume24h: 0,
      uniqueTraders: 0,
      avgTradeSize: 0,
      whaleCount: 0,
      whaleVolume: 0,
      priceChange1h: 0,
      priceChange24h: 0,
      priceChange7d: 0,
      buyPressure: 50,
    },
    topTraders: [],
    topTraderStats: {
      whaleCount: 0,
      whaleVolume: 0,
      totalVolume: 0,
      whaleThreshold: 500,
    },
    marketInfo: null,
    multiMarketData: null,
    lastUpdate: Date.now(),
    isLoading: false,
    isRefreshing: false,
    error: null,
  });

  const hasFetchedRef = useRef(false);
  const requestIdRef = useRef(0);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!marketUrl) return;

    // Increment request ID to track this specific request
    const currentRequestId = ++requestIdRef.current;

    // For NEW markets (not refresh), clear all old data to prevent stale display
    if (!isRefresh) {
      setData({
        market: null,
        trades: [],
        orderbook: { bids: [], asks: [], spread: 0, midPrice: 0.5 },
        priceHistory: [],
        stats: {
          volume24h: 0,
          uniqueTraders: 0,
          avgTradeSize: 0,
          whaleCount: 0,
          whaleVolume: 0,
          priceChange1h: 0,
          priceChange24h: 0,
          priceChange7d: 0,
          buyPressure: 50,
        },
        topTraders: [],
        topTraderStats: {
          whaleCount: 0,
          whaleVolume: 0,
          totalVolume: 0,
          whaleThreshold: 500,
        },
        marketInfo: null,
        multiMarketData: null,
        lastUpdate: Date.now(),
        isLoading: true,
        isRefreshing: false,
        error: null,
      });
    } else {
      // For refreshes, keep existing data visible while updating
      setData(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: true,
        error: null,
        multiMarketData: null
      }));
    }

    try {
      const { data: response, error } = await supabase.functions.invoke('market-dashboard', {
        body: { marketUrl, yesTokenId, noTokenId },
      });

      // Check if this request is still current before processing response
      if (currentRequestId !== requestIdRef.current) {
        console.log('[Dashboard] Discarding stale response for:', marketUrl);
        return;
      }

      if (error) throw error;

      // Handle multi-market selection
      if (response.needsMarketSelection) {
        setData(prev => ({
          ...prev,
          isLoading: false,
          isRefreshing: false,
          error: null,
          multiMarketData: {
            needsSelection: true,
            eventSlug: response.eventSlug,
            eventTitle: response.eventTitle,
            eventUrl: response.eventUrl || `https://polymarket.com/event/${response.eventSlug}`,
            markets: response.markets || [],
          },
        }));
        return;
      }

      if (response.error) {
        throw new Error(response.error);
      }

      // Transform the response into our data format
      // Edge function returns: market.question, market.odds (0-100), market.volume
      const market = response.market || {};
      const tradeStats = response.tradeStats || {};
      const whales = response.whales || [];
      const topTradersRaw = response.topTraders || [];
      const topTraderStatsRaw = response.topTraderStats || {};
      
      // Map trades - prices already in 0-100 format from edge function
      const trades = (response.recentTrades || []).map((t: any) => ({
        id: t.id,
        side: t.side,
        outcome: t.outcome,
        size: t.size,
        price: t.price, // Already 0-100
        timeAgo: t.timeAgo,
        wallet: t.wallet,
        timestamp: t.timestamp,
        isNew: false,
        isWhale: t.size >= (topTraderStatsRaw.whaleThreshold || 10000),
      }));

      // Process orderbook - prices already in 0-100 format from edge function
      const orderbook = response.orderbook || { bids: [], asks: [], spread: 0 };
      const bids = (orderbook.bids || []).slice(0, 10).map((b: any) => ({
        price: b.price || 0, // Already 0-100
        size: b.size || 0,
      }));
      const asks = (orderbook.asks || []).slice(0, 10).map((a: any) => ({
        price: a.price || 0, // Already 0-100
        size: a.size || 0,
      }));
      
      // Calculate mid price same as sidebar: use best bid/ask if available, otherwise fall back to market odds
      const hasBids = bids.length > 0 && bids[0].price > 0;
      const hasAsks = asks.length > 0 && asks[0].price > 0;
      const bestBid = hasBids ? bids[0].price : 0;
      const bestAsk = hasAsks ? asks[0].price : 100;
      const spread = orderbook.spread || (hasAsks && hasBids ? bestAsk - bestBid : 0);
      // Match sidebar logic: if we have valid orderbook data, use it; otherwise fall back to market odds
      const midPrice = hasBids && hasAsks 
        ? (bestBid + bestAsk) / 2 
        : (market.odds || 50);

      // Process price history - prices already in 0-100 format from edge function
      // Edge function sends { date, price, open, high, low, close } with prices in 0-100
      const priceHistory = (response.priceHistory || []).map((p: any) => ({
        timestamp: p.date || p.timestamp || new Date().toISOString(),
        price: p.price || p.close || 50, // Already 0-100
        volume: p.volume || 0,
      }));

      // Process top traders
      const topTraders = topTradersRaw.map((t: any) => ({
        wallet: t.wallet || 'unknown',
        volume: t.volume || 0,
        buyPercent: t.buyPercent || 50,
        trades: t.trades || 0,
        isWhale: t.isWhale || false,
      }));

      // Get current odds in 0-1 format for MarketHeader (which expects 0-1)
      // Clamp to 0-100 range before converting to prevent impossible values
      const clampedOdds = Math.max(0, Math.min(100, market.odds || 50));
      const currentOdds = clampedOdds / 100;
      
      setData({
        market: {
          title: market.question || market.title || 'Unknown Market',
          yesPrice: currentOdds,
          noPrice: 1 - currentOdds,
          yesVolume: tradeStats.yesVolume24h || tradeStats.buyVolume || (market.volume || 0) / 2,
          noVolume: tradeStats.noVolume24h || tradeStats.sellVolume || (market.volume || 0) / 2,
          totalVolume: tradeStats.totalVolume24h || market.volume || 0,
          liquidity: market.liquidity || 0,
          endDate: market.endDate,
          marketUrl: market.url || marketUrl,
        },
        trades,
        orderbook: { bids, asks, spread, midPrice },
        priceHistory,
        stats: {
          volume24h: tradeStats.totalVolume24h || tradeStats.buyVolume + tradeStats.sellVolume || 0,
          uniqueTraders: tradeStats.uniqueTraders24h || topTraderStatsRaw.uniqueTraders || tradeStats.totalCount || 0,
          avgTradeSize: tradeStats.largestTrade ? tradeStats.largestTrade / 10 : 0,
          whaleCount: topTraderStatsRaw.whaleCount || whales.length || 0,
          whaleVolume: topTraderStatsRaw.whaleVolume || whales.reduce((sum: number, w: any) => sum + (w.amount || 0), 0),
          priceChange1h: response.priceChange1h || 0,
          priceChange24h: response.priceChange24h || 0,
          priceChange7d: response.priceChange || 0,
          buyPressure: tradeStats.buyPressure || 50,
        },
        topTraders,
        topTraderStats: {
          whaleCount: topTraderStatsRaw.whaleCount || 0,
          whaleVolume: topTraderStatsRaw.whaleVolume || 0,
          totalVolume: topTraderStatsRaw.totalTopTraderVolume || 0,
          whaleThreshold: topTraderStatsRaw.whaleThreshold || 500,
        },
        marketInfo: {
          description: market.description || null,
          resolutionSource: market.resolutionSource || null,
          tags: market.tags || [],
          createdDate: market.createdDate || undefined,
        },
        multiMarketData: null,
        lastUpdate: Date.now(),
        isLoading: false,
        isRefreshing: false,
        error: null,
      });
    } catch (err: any) {
      // Check if this request is still current before setting error
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      console.error('[Dashboard] Fetch error:', err);
      setData(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: err.message || 'Failed to load market data',
      }));
    }
  }, [marketUrl]);

  // Initial fetch
  useEffect(() => {
    if (marketUrl) {
      hasFetchedRef.current = false;
      fetchData(false);
    }
  }, [marketUrl, fetchData]);

  // Polling for updates (every 30 seconds to reduce flickering)
  useEffect(() => {
    if (!marketUrl || data.isLoading || data.multiMarketData) return;

    const interval = setInterval(() => {
      fetchData(true); // Mark as refresh
    }, 30000);

    return () => clearInterval(interval);
  }, [marketUrl, data.isLoading, data.multiMarketData, fetchData]);

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return { ...data, refresh };
}
