import { useState, useEffect, useCallback } from 'react';
import { fetchPandoraMarkets, PandoraMarket } from '@/lib/pandora-api';

export function usePandoraMarkets() {
  const [markets, setMarkets] = useState<PandoraMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPandoraMarkets();
      setMarkets(data);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to load Pandora markets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    
    // Refresh every 30 seconds
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const refetch = useCallback(() => {
    load();
  }, [load]);

  return { markets, loading, error, refetch };
}
