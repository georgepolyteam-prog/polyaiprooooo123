import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface KalshiMarket {
  id: string;
  question: string;
  category?: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  endDate?: string;
  imageUrl?: string;
  description?: string;
}

export interface Quote {
  price: number;
  shares: number;
  fee: number;
  total: number;
  transaction?: string;
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

  const discoverMarkets = useCallback(async (): Promise<KalshiMarket[]> => {
    const data = await callDflowApi('discoverMarkets');
    // Transform API response to our format
    return (data.markets || data || []).map((m: any) => ({
      id: m.id || m.marketId,
      question: m.question || m.title || m.name,
      category: m.category,
      yesPrice: Math.round((m.yesPrice || m.yes_price || 0.5) * 100),
      noPrice: Math.round((m.noPrice || m.no_price || 0.5) * 100),
      volume: m.volume || m.totalVolume || 0,
      endDate: m.endDate || m.end_date,
      imageUrl: m.imageUrl || m.image_url,
      description: m.description,
    }));
  }, [callDflowApi]);

  const getMarketDetails = useCallback(async (marketId: string): Promise<KalshiMarket | null> => {
    const data = await callDflowApi('getMarketDetails', { marketId });
    if (!data) return null;
    return {
      id: data.id || data.marketId,
      question: data.question || data.title || data.name,
      category: data.category,
      yesPrice: Math.round((data.yesPrice || data.yes_price || 0.5) * 100),
      noPrice: Math.round((data.noPrice || data.no_price || 0.5) * 100),
      volume: data.volume || data.totalVolume || 0,
      endDate: data.endDate || data.end_date,
      imageUrl: data.imageUrl || data.image_url,
      description: data.description,
    };
  }, [callDflowApi]);

  const getUserPositions = useCallback(async (walletAddress: string) => {
    return callDflowApi('getUserPositions', { walletAddress });
  }, [callDflowApi]);

  const getQuote = useCallback(async (
    marketId: string,
    side: 'YES' | 'NO',
    amount: number,
    userWallet: string
  ): Promise<Quote> => {
    const data = await callDflowApi('getQuote', {
      marketId,
      side,
      amount,
      userWallet,
    });
    return {
      price: data.price || 0,
      shares: data.shares || 0,
      fee: data.fee || 0,
      total: data.total || amount,
      transaction: data.transaction,
    };
  }, [callDflowApi]);

  const executeSwap = useCallback(async (params: {
    marketId: string;
    side: 'YES' | 'NO';
    amount: number;
    userWallet: string;
    signedTransaction: string;
  }) => {
    return callDflowApi('executeSwap', params);
  }, [callDflowApi]);

  const settlePosition = useCallback(async (params: {
    marketId: string;
    userWallet: string;
  }) => {
    return callDflowApi('settlePosition', params);
  }, [callDflowApi]);

  return {
    loading,
    error,
    discoverMarkets,
    getMarketDetails,
    getUserPositions,
    getQuote,
    executeSwap,
    settlePosition,
  };
}
