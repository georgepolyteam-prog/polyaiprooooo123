import { useState, useEffect, useCallback, useRef } from 'react';

// DFlow WebSocket URL for real-time price updates
const WS_URL = 'wss://c.prediction-markets-api.dflow.net/api/v1/ws';

export interface PriceUpdate {
  ticker: string;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  timestamp: number;
}

export interface TradeUpdate {
  ticker: string;
  side: 'yes' | 'no';
  price: number;
  size: number;
  timestamp: number;
}

export interface OrderbookUpdate {
  ticker: string;
  yesBids: { price: number; size: number }[];
  yesAsks: { price: number; size: number }[];
  noBids: { price: number; size: number }[];
  noAsks: { price: number; size: number }[];
}

interface UseDflowWebSocketOptions {
  tickers?: string[];
  channels?: ('prices' | 'trades' | 'orderbook')[];
  onPriceUpdate?: (update: PriceUpdate) => void;
  onTradeUpdate?: (update: TradeUpdate) => void;
  onOrderbookUpdate?: (update: OrderbookUpdate) => void;
  autoReconnect?: boolean;
}

export function useDflowWebSocket({
  tickers = [],
  channels = ['prices'],
  onPriceUpdate,
  onTradeUpdate,
  onOrderbookUpdate,
  autoReconnect = true,
}: UseDflowWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      console.log('🔌 Connecting to DFlow WebSocket...');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ DFlow WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Subscribe to channels for specified tickers
        if (tickers.length > 0) {
          channels.forEach(channel => {
            const subscribeMsg = {
              type: 'subscribe',
              channel,
              tickers,
            };
            ws.send(JSON.stringify(subscribeMsg));
            console.log(`📡 Subscribed to ${channel} for`, tickers);
          });
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'price':
            case 'prices':
              if (onPriceUpdate) {
                const update: PriceUpdate = {
                  ticker: data.ticker,
                  yesBid: parseFloat(data.yesBid || data.yes_bid || 0) * 100,
                  yesAsk: parseFloat(data.yesAsk || data.yes_ask || 0) * 100,
                  noBid: parseFloat(data.noBid || data.no_bid || 0) * 100,
                  noAsk: parseFloat(data.noAsk || data.no_ask || 0) * 100,
                  timestamp: data.timestamp || Date.now(),
                };
                onPriceUpdate(update);
              }
              break;
              
            case 'trade':
            case 'trades':
              if (onTradeUpdate) {
                const update: TradeUpdate = {
                  ticker: data.ticker,
                  side: data.side?.toLowerCase() || 'yes',
                  price: parseFloat(data.price || 0) * 100,
                  size: parseFloat(data.size || data.amount || 0),
                  timestamp: data.timestamp || Date.now(),
                };
                onTradeUpdate(update);
              }
              break;
              
            case 'orderbook':
              if (onOrderbookUpdate) {
                const parseLevel = (level: any) => ({
                  price: parseFloat(level.price || 0) * 100,
                  size: parseFloat(level.size || level.quantity || 0),
                });
                
                const update: OrderbookUpdate = {
                  ticker: data.ticker,
                  yesBids: (data.yesBids || data.yes_bids || []).map(parseLevel),
                  yesAsks: (data.yesAsks || data.yes_asks || []).map(parseLevel),
                  noBids: (data.noBids || data.no_bids || []).map(parseLevel),
                  noAsks: (data.noAsks || data.no_asks || []).map(parseLevel),
                };
                onOrderbookUpdate(update);
              }
              break;
              
            case 'subscribed':
              console.log('📡 Subscription confirmed:', data.channel);
              break;
              
            case 'error':
              console.error('❌ WebSocket error:', data.message);
              setError(data.message);
              break;
              
            default:
              console.log('📩 WebSocket message:', data);
          }
        } catch (parseErr) {
          console.error('Failed to parse WebSocket message:', parseErr);
        }
      };

      ws.onerror = (event) => {
        console.error('❌ DFlow WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('🔌 DFlow WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Auto-reconnect with exponential backoff
        if (autoReconnect && reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to connect to real-time updates');
    }
  }, [tickers, channels, onPriceUpdate, onTradeUpdate, onOrderbookUpdate, autoReconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  const subscribe = useCallback((channel: string, newTickers: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        channel,
        tickers: newTickers,
      }));
    }
  }, []);

  const unsubscribe = useCallback((channel: string, tickersToRemove: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        channel,
        tickers: tickersToRemove,
      }));
    }
  }, []);

  // Connect on mount if tickers are provided
  useEffect(() => {
    if (tickers.length > 0) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [tickers.join(','), connect, disconnect]);

  return {
    isConnected,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}