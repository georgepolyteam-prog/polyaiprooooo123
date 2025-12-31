import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export function useDflowApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callDflowApi = useCallback(async (action: string, params?: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('dflow-api', {
        body: { action, params },
      });
      
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      
      return data;
    } catch (err) {
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

  // Get orderbook for a market
  const getOrderbook = useCallback(async (ticker: string) => {
    return callDflowApi('getOrderbook', { ticker });
  }, [callDflowApi]);

  // Get trade history for a market
  const getTrades = useCallback(async (ticker: string, limit = 50) => {
    return callDflowApi('getTrades', { ticker, limit });
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

  return {
    loading,
    error,
    getEvents,
    getMarkets,
    getMarketByTicker,
    getOrderbook,
    getTrades,
    getSeries,
    getTagsByCategories,
    getOrder,
    getOrderStatus,
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
