import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Client-side cache for API responses
const API_CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

function getCached(key: string): any | null {
  const cached = API_CACHE.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[DFlow API] Cache HIT: ${key}`);
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any) {
  API_CACHE.set(key, { data, timestamp: Date.now() });
}

// Market account info containing token mints
export interface MarketAccounts {
  yesMint: string;
  noMint: string;
  yesReserve?: string;
  noReserve?: string;
}

// Individual market within an event
export interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle?: string;
  status: string;
  yesPrice: number; // in cents (0-100)
  noPrice: number;  // in cents (0-100)
  volume: number;
  openInterest?: number;
  closeTime?: string;
  expirationTime?: string;
  result?: string;
  accounts: Record<string, MarketAccounts>;
  yesBid?: number;
  yesAsk?: number;
  noBid?: number;
  noAsk?: number;
}

// Event containing markets
export interface KalshiEvent {
  ticker: string;
  title: string;
  subtitle?: string;
  category?: string;
  seriesTicker?: string;
  markets: KalshiMarket[];
}

export interface OrderResponse {
  transaction: string; // Base64 encoded transaction
  executionMode: 'sync' | 'async';
  signature?: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct?: number;
}

export interface Candlestick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export function useDflowApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callDflowApi = useCallback(async (action: string, params?: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    
    const startTime = performance.now();
    console.log(`[DFlow API] Starting: ${action}`);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('dflow-api', {
        body: { action, params },
      });
      
      const elapsed = Math.round(performance.now() - startTime);
      console.log(`[DFlow API] ${action} completed in ${elapsed}ms`);
      
      // Warn on slow calls
      if (elapsed > 1000) {
        console.warn(`[DFlow API] SLOW CALL: ${action} took ${elapsed}ms`);
      }
      
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      
      return data;
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      console.error(`[DFlow API] ${action} failed after ${elapsed}ms:`, err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get events with nested markets - main discovery endpoint
  const getEvents = useCallback(async (status: 'active' | 'closed' | 'settled' = 'active'): Promise<KalshiEvent[]> => {
    const data = await callDflowApi('getEvents', { status, limit: 100 });
    
    // Transform API response to our format
    return (data.events || []).map((event: any) => ({
      ticker: event.ticker,
      title: event.title,
      subtitle: event.subtitle,
      category: event.category || event.seriesTicker,
      seriesTicker: event.seriesTicker,
      markets: (event.markets || []).map((market: any) => transformMarket(market)),
    }));
  }, [callDflowApi]);

  // Get all markets directly
  const getMarkets = useCallback(async (): Promise<KalshiMarket[]> => {
    const data = await callDflowApi('getMarkets');
    return (data.markets || []).map((market: any) => transformMarket(market));
  }, [callDflowApi]);

  // Get single market by ticker
  const getMarketByTicker = useCallback(async (ticker: string): Promise<KalshiMarket | null> => {
    const data = await callDflowApi('getMarketByTicker', { ticker });
    if (!data) return null;
    return transformMarket(data);
  }, [callDflowApi]);

  // Get orderbook for a market - CACHED
  const getOrderbook = useCallback(async (ticker: string) => {
    const cacheKey = `orderbook-${ticker}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    
    const data = await callDflowApi('getOrderbook', { ticker });
    setCache(cacheKey, data);
    return data;
  }, [callDflowApi]);

  // Get trade history for a market (returns empty array on 404) - CACHED
  const getTrades = useCallback(async (ticker: string, limit = 50) => {
    const cacheKey = `trades-${ticker}-${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    
    try {
      const data = await callDflowApi('getTrades', { ticker, limit });
      setCache(cacheKey, data);
      return data;
    } catch (err: any) {
      // 404 means no trades yet - return empty gracefully
      if (err?.message?.includes('404') || err?.message?.includes('Not found')) {
        const emptyData = { trades: [] };
        setCache(cacheKey, emptyData);
        return emptyData;
      }
      throw err;
    }
  }, [callDflowApi]);

  // Filter token mints to only prediction market outcome mints
  const filterOutcomeMints = useCallback(async (mints: string[]): Promise<string[]> => {
    try {
      const data = await callDflowApi('filterOutcomeMints', { mints });
      return data.outcomeMints || data.mints || [];
    } catch (err: any) {
      console.error('Failed to filter outcome mints:', err);
      return [];
    }
  }, [callDflowApi]);

  // Get multiple markets by mint addresses (for portfolio) - uses POST batch endpoint
  const getMarketsByMints = useCallback(async (mints: string[]): Promise<KalshiMarket[]> => {
    try {
      const data = await callDflowApi('getMarketsByMints', { mints });
      return (data.markets || []).map((market: any) => transformMarket(market));
    } catch (err: any) {
      // Return empty if not found
      if (err?.message?.includes('404')) {
        return [];
      }
      throw err;
    }
  }, [callDflowApi]);

  // Get all series (categories of markets)
  const getSeries = useCallback(async () => {
    return callDflowApi('getSeries');
  }, [callDflowApi]);

  // Get tags by categories for filtering
  const getTagsByCategories = useCallback(async () => {
    return callDflowApi('getTagsByCategories');
  }, [callDflowApi]);

  // Get order for buying/selling outcome tokens (replaces getQuote)
  const getOrder = useCallback(async (
    inputMint: string,
    outputMint: string,
    amount: number,
    userWallet: string,
    slippageBps = 50
  ): Promise<OrderResponse> => {
    return callDflowApi('getOrder', {
      inputMint,
      outputMint,
      amount,
      userWallet,
      slippageBps,
    });
  }, [callDflowApi]);

  // Check order status (for async trades)
  const getOrderStatus = useCallback(async (signature: string) => {
    return callDflowApi('getOrderStatus', { signature });
  }, [callDflowApi]);

  // Search events/markets
  const searchEvents = useCallback(async (query: string): Promise<KalshiEvent[]> => {
    const data = await callDflowApi('searchEvents', { query });
    return (data.events || data.results || []).map((event: any) => ({
      ticker: event.ticker,
      title: event.title,
      subtitle: event.subtitle,
      category: event.category || event.seriesTicker,
      seriesTicker: event.seriesTicker,
      markets: (event.markets || []).map((market: any) => transformMarket(market)),
    }));
  }, [callDflowApi]);

  // Get candlestick data for charts
  const getCandlesticks = useCallback(async (
    ticker: string,
    startTs?: number,
    endTs?: number,
    interval: 1 | 60 | 1440 = 60
  ): Promise<Candlestick[]> => {
    const data = await callDflowApi('getCandlesticks', { ticker, startTs, endTs, interval });
    return (data.candlesticks || data || []).map((c: any) => ({
      timestamp: c.timestamp || c.t,
      open: parseFloat(c.open || c.o) * 100,
      high: parseFloat(c.high || c.h) * 100,
      low: parseFloat(c.low || c.l) * 100,
      close: parseFloat(c.close || c.c) * 100,
      volume: parseFloat(c.volume || c.v || 0),
    }));
  }, [callDflowApi]);

  // Get market by outcome token mint
  const getMarketByMint = useCallback(async (mint: string): Promise<KalshiMarket | null> => {
    const data = await callDflowApi('getMarketByMint', { mint });
    if (!data) return null;
    return transformMarket(data);
  }, [callDflowApi]);

  // Get live sports data for an event
  const getLiveData = useCallback(async (ticker: string) => {
    return callDflowApi('getLiveData', { ticker });
  }, [callDflowApi]);

  // Get forecast history for an event
  const getForecastHistory = useCallback(async (eventId: string) => {
    return callDflowApi('getForecastHistory', { eventId });
  }, [callDflowApi]);

  return {
    loading,
    error,
    callDflowApi,
    getEvents,
    getMarkets,
    getMarketByTicker,
    getOrderbook,
    getTrades,
    filterOutcomeMints,
    getMarketsByMints,
    getSeries,
    getTagsByCategories,
    getOrder,
    getOrderStatus,
    searchEvents,
    getCandlesticks,
    getMarketByMint,
    getLiveData,
    getForecastHistory,
  };
}

// Helper function to transform API market response
function transformMarket(market: any): KalshiMarket {
  // Parse prices - they come as decimal (0-1) or cents (0-100) depending on endpoint
  const parsePrice = (value: any): number => {
    if (value === undefined || value === null) return 50;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    // If it's a decimal (0-1), convert to cents
    return num <= 1 ? Math.round(num * 100) : Math.round(num);
  };

  // Use bid/ask if available, otherwise use 50/50
  const yesPrice = parsePrice(market.yesBid || market.yesAsk) || 50;
  const noPrice = parsePrice(market.noBid || market.noAsk) || (100 - yesPrice);

  return {
    ticker: market.ticker,
    title: market.title,
    subtitle: market.subtitle,
    status: market.status,
    yesPrice,
    noPrice,
    volume: market.volume || 0,
    openInterest: market.openInterest,
    closeTime: market.closeTime ? new Date(market.closeTime * 1000).toISOString() : undefined,
    expirationTime: market.expirationTime ? new Date(market.expirationTime * 1000).toISOString() : undefined,
    result: market.result,
    accounts: market.accounts || {},
    yesBid: parsePrice(market.yesBid),
    yesAsk: parsePrice(market.yesAsk),
    noBid: parsePrice(market.noBid),
    noAsk: parsePrice(market.noAsk),
  };
}