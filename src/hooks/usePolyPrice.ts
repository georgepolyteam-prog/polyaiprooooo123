import { useState, useEffect, useCallback } from 'react';

interface PolyPriceData {
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
}

const POLY_CONTRACT = '982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump';

export const usePolyPrice = (refreshInterval = 30000) => {
  const [data, setData] = useState<PolyPriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrice = useCallback(async () => {
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${POLY_CONTRACT}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch price data');
      }
      
      const result = await response.json();
      
      if (result.pairs && result.pairs.length > 0) {
        // Get the most liquid pair
        const pair = result.pairs[0];
        
        setData({
          price: parseFloat(pair.priceUsd) || 0,
          priceChange24h: parseFloat(pair.priceChange?.h24) || 0,
          marketCap: pair.fdv || 0,
          volume24h: pair.volume?.h24 || 0,
          liquidity: pair.liquidity?.usd || 0,
        });
        setError(null);
      } else {
        setError('No trading pairs found');
      }
    } catch (err) {
      console.error('Error fetching POLY price:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch price');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    
    const interval = setInterval(fetchPrice, refreshInterval);
    
    return () => clearInterval(interval);
  }, [fetchPrice, refreshInterval]);

  return { data, isLoading, error, refetch: fetchPrice };
};
