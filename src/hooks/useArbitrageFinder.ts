import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SourceMarket {
  platform: 'polymarket' | 'kalshi';
  title: string;
  slug: string;
  yesPrice: number;
  noPrice: number;
  volume?: number;
  url: string;
  tokenId?: string;
  ticker?: string;
}

export interface MatchedMarket {
  platform: 'polymarket' | 'kalshi';
  title: string;
  slug: string;
  yesPrice: number;
  noPrice: number;
  volume?: number;
  url: string;
  tokenId?: string;
  ticker?: string;
}

export interface ArbitrageOpportunity {
  exists: boolean;
  confidence: number;
  buyYesOn: string;
  buyYesPlatform: 'polymarket' | 'kalshi';
  buyYesPrice: number;
  buyYesTokenId?: string;
  buyYesTicker?: string;
  buyNoOn: string;
  buyNoPlatform: 'polymarket' | 'kalshi';
  buyNoPrice: number;
  buyNoTokenId?: string;
  buyNoTicker?: string;
  totalCost: number;
  guaranteedPayout: number;
  netProfit: number;
  profitPercent: number;
  strategy: string;
  reasoning: string;
}

export interface FetchAttempt {
  url: string;
  status: number;
  bodyPreview: string;
  note: string;
}

export interface SearchAttempt {
  query: string;
  url: string;
  status: number;
  eventCount: number;
  marketCount: number;
}

export interface DebugInfo {
  reasoning?: string;
  candidateTitles?: string[];
  kalshiSearchUrl?: string;
  polymarketSearchUrl?: string;
  kalshiResponse?: any;
  polymarketResponse?: any;
  sourceApiResponse?: any;
  allSourceMarkets?: SourceMarket[];
  allCandidateMarkets?: MatchedMarket[];
  aiInput?: string;
  aiOutput?: string;
  kalshiFetchAttempts?: FetchAttempt[];
  polymarketTokenIdNotes?: string[];
  parsedUrlInfo?: any;
  searchQueries?: string[];
  kalshiSearchAttempts?: SearchAttempt[];
  polymarketSearchAttempts?: SearchAttempt[];
}

export interface ArbitrageResult {
  success: boolean;
  sourceMarket?: SourceMarket;
  sourceMarkets?: SourceMarket[];
  matchedMarket?: MatchedMarket;
  arbitrage?: ArbitrageOpportunity;
  searchQuery?: string;
  searchQueries?: string[];
  searchResultsCount?: number;
  error?: string;
  debug?: DebugInfo;
}

interface UseArbitrageFinderReturn {
  findArbitrage: (url: string) => Promise<void>;
  result: ArbitrageResult | null;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

export function useArbitrageFinder(): UseArbitrageFinderReturn {
  const [result, setResult] = useState<ArbitrageResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const findArbitrage = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('arbitrage-finder', {
        body: { url }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to find arbitrage');
      }

      if (!data.success) {
        throw new Error(data.error || 'Unknown error occurred');
      }

      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      setResult({ success: false, error: message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    findArbitrage,
    result,
    isLoading,
    error,
    reset
  };
}

// URL validation helpers
export function detectPlatform(url: string): 'polymarket' | 'kalshi' | null {
  if (url.includes('polymarket.com')) return 'polymarket';
  if (url.includes('kalshi.com')) return 'kalshi';
  return null;
}

export function isValidMarketUrl(url: string): boolean {
  return detectPlatform(url) !== null;
}
