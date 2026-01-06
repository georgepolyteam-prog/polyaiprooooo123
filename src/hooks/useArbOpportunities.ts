import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ArbOpportunity {
  id: string;
  matchKey: string;
  eventTitle: string;
  sport: string;
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
}

interface UseArbOpportunitiesOptions {
  sport?: string;
  minSpread?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useArbOpportunities(options: UseArbOpportunitiesOptions = {}) {
  const {
    sport = 'nfl',
    minSpread = 1,
    autoRefresh = true,
    refreshInterval = 30000,
  } = options;

  const [opportunities, setOpportunities] = useState<ArbOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchOpportunities = useCallback(async () => {
    try {
      setError(null);
      
      const { data, error: fnError } = await supabase.functions.invoke('arb-scanner', {
        body: {},
        headers: {},
      });

      // Add query params via URL since invoke doesn't support them directly
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arb-scanner?sport=${sport}&minSpread=${minSpread}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch opportunities: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      setOpportunities(result.opportunities || []);
      setLastUpdated(Date.now());
    } catch (err) {
      console.error('[useArbOpportunities] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch opportunities');
    } finally {
      setIsLoading(false);
    }
  }, [sport, minSpread]);

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
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}
