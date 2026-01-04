import { useState, useEffect, useRef, useCallback } from 'react';
import { useDflowApi } from './useDflowApi';
import { generateMockOrderbook, generateMockTrades } from '@/lib/kalshi-mock-data';

interface OrderbookLevel {
  price: number;
  size: number;
}

interface Orderbook {
  yesBids: OrderbookLevel[];
  yesAsks: OrderbookLevel[];
  noBids: OrderbookLevel[];
  noAsks: OrderbookLevel[];
}

interface Trade {
  id: string;
  side: 'yes' | 'no';
  price: number;
  size: number;
  timestamp: number;
}

export function useLiveKalshiData(ticker: string, enabled = true) {
  const { getOrderbook, getTrades } = useDflowApi();
  const [orderbook, setOrderbook] = useState<Orderbook | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const safeArray = (arr: any) => Array.isArray(arr) ? arr : [];
  
  const parseLevel = (level: any): OrderbookLevel => ({
    price: Math.round((parseFloat(level?.price) || 0) * 100),
    size: parseFloat(level?.size || level?.quantity || 0),
  });

  const parseTrade = (t: any, idx: number): Trade => ({
    id: `${t.timestamp || idx}-${idx}`,
    side: (t.side || t.taker_side || 'yes').toLowerCase() as 'yes' | 'no',
    price: Math.round((parseFloat(t.price) || 0.5) * 100),
    size: parseFloat(t.size || t.amount || t.count || 1),
    timestamp: t.timestamp || Date.now() - idx * 60000,
  });

  const fetchLiveData = useCallback(async () => {
    if (!ticker) return;

    try {
      const [obData, tradesData] = await Promise.all([
        getOrderbook(ticker),
        getTrades(ticker, 20)
      ]);

      let hasRealData = false;

      if (obData) {
        const parsedOrderbook: Orderbook = {
          yesBids: safeArray(obData.yesBids || obData.yes_bids).map(parseLevel).slice(0, 10),
          yesAsks: safeArray(obData.yesAsks || obData.yes_asks).map(parseLevel).slice(0, 10),
          noBids: safeArray(obData.noBids || obData.no_bids).map(parseLevel).slice(0, 10),
          noAsks: safeArray(obData.noAsks || obData.no_asks).map(parseLevel).slice(0, 10),
        };
        
        // Check if we got real data
        if (parsedOrderbook.yesBids.length > 0 || parsedOrderbook.yesAsks.length > 0) {
          setOrderbook(parsedOrderbook);
          hasRealData = true;
          
          // Update live price from best bid
          if (parsedOrderbook.yesBids[0]?.price) {
            setLastPrice(parsedOrderbook.yesBids[0].price);
          }
        }
      }

      if (tradesData?.trades && tradesData.trades.length > 0) {
        setTrades(tradesData.trades.map(parseTrade));
        hasRealData = true;
      }

      // If no real data, use mock data
      if (!hasRealData) {
        console.log('[Live Data] No real data, using mock');
        setOrderbook(generateMockOrderbook());
        setTrades(generateMockTrades(20));
        setLastPrice(50);
        setUsingMockData(true);
      } else {
        setUsingMockData(false);
      }
    } catch (err) {
      console.error('[Live Data] Fetch failed, using mock data:', err);
      setOrderbook(generateMockOrderbook());
      setTrades(generateMockTrades(20));
      setLastPrice(50);
      setUsingMockData(true);
    }
  }, [ticker, getOrderbook, getTrades]);

  useEffect(() => {
    if (!ticker || !enabled) {
      setIsPolling(false);
      return;
    }

    let mounted = true;

    const poll = async () => {
      if (!mounted) return;
      await fetchLiveData();
    };

    // Initial fetch
    poll();
    setIsPolling(true);

    // Poll every 2 seconds for live feel
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      mounted = false;
      setIsPolling(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [ticker, enabled, fetchLiveData]);

  return { orderbook, trades, lastPrice, isPolling, usingMockData, refetch: fetchLiveData };
}
