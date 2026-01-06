import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ArbOpportunity {
  id: string;
  matchKey: string;
  eventTitle: string;
  category: string;
  spreadPercent: number;
  buyPlatform: 'kalshi' | 'polymarket';
  sellPlatform: 'kalshi' | 'polymarket';
  buyPrice: number;
  sellPrice: number;
  buyTicker: string;
  sellTicker: string;
  buyVolume: number;
  sellVolume: number;
  estimatedProfit: number;
  expiresAt: string | null;
  updatedAt: number;
  matchScore?: number;
  matchReason?: string;
}

interface ArbStats {
  polymarketCount: number;
  kalshiCount: number;
  matchedPairs: number;
  opportunitiesFound: number;
}

interface UseArbOpportunitiesOptions {
  category?: string;
  minSpread?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useArbOpportunities(options: UseArbOpportunitiesOptions = {}) {
  const {
    category = 'all',
    minSpread = 1,
    autoRefresh = true,
    refreshInterval = 30000,
  } = options;

  const [opportunities, setOpportunities] = useState<ArbOpportunity[]>([]);
  const [stats, setStats] = useState<ArbStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchOpportunities = useCallback(async () => {
    try {
      setError(null);
      
      const { data, error: fnError } = await supabase.functions.invoke('arb-scanner', {
        body: { category, minSpread },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to fetch opportunities');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setOpportunities(data?.opportunities || []);
      setStats(data?.stats || null);
      setLastUpdated(Date.now());
    } catch (err) {
      console.error('[useArbOpportunities] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch opportunities');
    } finally {
      setIsLoading(false);
    }
  }, [category, minSpread]);

  // Initial fetch
  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchOpportunities, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchOpportunities]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    return fetchOpportunities();
  }, [fetchOpportunities]);

  // Filter opportunities by minimum spread
  const filteredOpportunities = opportunities.filter(
    (opp) => opp.spreadPercent >= minSpread
  );

  return {
    opportunities: filteredOpportunities,
    allOpportunities: opportunities,
    stats,
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}
