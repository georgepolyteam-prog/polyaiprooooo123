import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Builder {
  rank: number;
  builder: string;
  builderName?: string;
  builderLogo?: string;
  volume: number;
  activeUsers: number;
  verified: boolean;
  trades?: number;
}

export interface VolumeDataPoint {
  date: string;
  volume: number;
}

export interface BuilderStatsData {
  leaderboard: Builder[];
  volumeHistory: VolumeDataPoint[] | null;
  builderDetails: Builder | null;
  timePeriod: string;
  fetchedAt: string;
}

export type TimePeriod = 'DAY' | 'WEEK' | 'MONTH' | 'ALL';

export function useBuilderStats(timePeriod: TimePeriod = 'WEEK', selectedBuilder?: string) {
  const [data, setData] = useState<BuilderStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        timePeriod,
        limit: '50',
      });

      if (selectedBuilder) {
        params.set('builder', selectedBuilder);
      }

      const { data: responseData, error: invokeError } = await supabase.functions.invoke(
        'builder-stats',
        { 
          body: null,
          headers: {},
        }
      );

      // Use fetch directly since we need query params
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/builder-stats?${params.toString()}`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch builder stats: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch builder stats';
      setError(message);
      console.error('Error fetching builder stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [timePeriod, selectedBuilder]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    data,
    leaderboard: data?.leaderboard || [],
    volumeHistory: (data?.volumeHistory || []).map((point: any) => ({
      date: point.dt || point.date,
      volume: point.volume || 0,
    })),
    builderDetails: data?.builderDetails,
    isLoading,
    error,
    refetch: fetchStats,
  };
}
