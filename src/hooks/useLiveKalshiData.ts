import { useState, useEffect, useRef, useCallback } from 'react';
import { useDflowApi } from './useDflowApi';

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

// Parse orderbook object format { "0.50": 100, "0.48": 50 } into array of levels
const parseOrderbookSide = (data: any): OrderbookLevel[] => {
  if (!data || typeof data !== 'object') return [];
  
  // If it's already an array, handle that case
  if (Array.isArray(data)) {
    return data.map(level => ({
      price: Math.round((parseFloat(level?.price) || 0) * 100),
      size: parseFloat(level?.size || level?.quantity || 0),
    }));
  }
  
  // It's an object like { "0.50": 100, "0.48": 50 }
  return Object.entries(data)
    .map(([priceStr, size]) => ({
      price: Math.round(parseFloat(priceStr) * 100),
      size: typeof size === 'number' ? size : parseFloat(String(size) || '0'),
    }))
    .filter(level => level.size > 0)
    .sort((a, b) => b.price - a.price); // Sort by price descending (best first)
};

export function useLiveKalshiData(ticker: string, enabled = true) {
  const { getOrderbook, getTrades } = useDflowApi();
  const [orderbook, setOrderbook] = useState<Orderbook | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
        console.log('[Live Data] Raw orderbook:', JSON.stringify(obData).slice(0, 200));
        
        const parsedOrderbook: Orderbook = {
          yesBids: parseOrderbookSide(obData.yes_bids || obData.yesBids).slice(0, 10),
          yesAsks: parseOrderbookSide(obData.yes_asks || obData.yesAsks).slice(0, 10),
          noBids: parseOrderbookSide(obData.no_bids || obData.noBids).slice(0, 10),
          noAsks: parseOrderbookSide(obData.no_asks || obData.noAsks).slice(0, 10),
        };
        
        console.log('[Live Data] Parsed orderbook:', {
          yesBids: parsedOrderbook.yesBids.length,
          yesAsks: parsedOrderbook.yesAsks.length,
          noBids: parsedOrderbook.noBids.length,
          noAsks: parsedOrderbook.noAsks.length,
        });
        
        // Check if we got real data - check all sides
        const totalLevels = 
          parsedOrderbook.yesBids.length + 
          parsedOrderbook.yesAsks.length + 
          parsedOrderbook.noBids.length + 
          parsedOrderbook.noAsks.length;
          
        if (totalLevels > 0) {
          setOrderbook(parsedOrderbook);
          hasRealData = true;
          
          // Update live price from best yes bid or no bid
          if (parsedOrderbook.yesBids[0]?.price) {
            setLastPrice(parsedOrderbook.yesBids[0].price);
          } else if (parsedOrderbook.noBids[0]?.price) {
            setLastPrice(100 - parsedOrderbook.noBids[0].price);
          }
        }
      }

      if (tradesData?.trades && tradesData.trades.length > 0) {
        setTrades(tradesData.trades.map(parseTrade));
        hasRealData = true;
      }

      // If no real data, just show empty state (no mock)
      if (!hasRealData) {
        console.log('[Live Data] No orderbook or trade data available');
        setOrderbook({ yesBids: [], yesAsks: [], noBids: [], noAsks: [] });
        setTrades([]);
        setUsingMockData(false);
      } else {
        setUsingMockData(false);
      }
    } catch (err) {
      console.error('[Live Data] Fetch failed:', err);
      setOrderbook({ yesBids: [], yesAsks: [], noBids: [], noAsks: [] });
      setTrades([]);
      setUsingMockData(false);
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
