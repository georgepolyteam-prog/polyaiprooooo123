import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IrysMarket {
  condition_id: string;
  question: string;
  outcomes: string[];
  end_date_iso: string;
  closed: boolean;
  outcome?: string;
  outcome_prices?: number[];
  volume?: string;
  category?: string;
  irys: {
    txId: string;
    timestamp: number;
    proofUrl: string;
    category: string;
    finalPrice?: string;
  };
}

interface IrysQueryResult {
  success: boolean;
  markets: IrysMarket[];
  count: number;
  source: string;
  error?: string;
}

export function useIrysData() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markets, setMarkets] = useState<IrysMarket[]>([]);

  const queryHistoricalMarkets = useCallback(async (
    category?: string,
    limit = 20
  ): Promise<IrysMarket[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('query-irys', {
        body: { category, limit }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      const result = data as IrysQueryResult;
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to query Irys');
      }

      setMarkets(result.markets);
      return result.markets;

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch historical data';
      setError(errorMessage);
      console.error('Irys query error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getMarketByTxId = useCallback(async (txId: string): Promise<IrysMarket | null> => {
    try {
      const response = await fetch(`https://gateway.irys.xyz/${txId}`);
      if (!response.ok) return null;
      
      const market = await response.json();
      return {
        ...market,
        irys: {
          txId,
          timestamp: Date.now(),
          proofUrl: `https://gateway.irys.xyz/${txId}`,
          category: 'unknown'
        }
      };
    } catch (err) {
      console.error('Failed to fetch market from Irys:', err);
      return null;
    }
  }, []);

  return {
    isLoading,
    error,
    markets,
    queryHistoricalMarkets,
    getMarketByTxId
  };
}
