import { useState, useEffect, useCallback, useRef } from 'react';

// DFlow WebSocket URL for real-time price updates (without c. prefix)
const WS_URL = 'wss://prediction-markets-api.dflow.net/api/v1/ws';

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

const MAX_RECONNECT_ATTEMPTS = 5;

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
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    // Prevent duplicate connections
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING ||
        isConnectingRef.current) {
      return;
    }

    // Stop after max attempts
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log('❌ Max WebSocket reconnection attempts reached, giving up');
      setError('Connection failed after max retries');
      return;
    }

    try {
      isConnectingRef.current = true;
      console.log(`🔌 Connecting to DFlow WebSocket... (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ DFlow WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;

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
                  timestamp: data.timestamp || Math.floor(Date.now() / 1000),
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
                  timestamp: data.timestamp || Math.floor(Date.now() / 1000),
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
                
                // Safely parse arrays
                const safeArray = (arr: any) => Array.isArray(arr) ? arr : [];
                
                const update: OrderbookUpdate = {
                  ticker: data.ticker,
                  yesBids: safeArray(data.yesBids || data.yes_bids).map(parseLevel),
                  yesAsks: safeArray(data.yesAsks || data.yes_asks).map(parseLevel),
                  noBids: safeArray(data.noBids || data.no_bids).map(parseLevel),
                  noAsks: safeArray(data.noAsks || data.no_asks).map(parseLevel),
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
              // Silently ignore unknown messages
              break;
          }
        } catch (parseErr) {
          console.error('Failed to parse WebSocket message:', parseErr);
        }
      };

      ws.onerror = () => {
        console.error('❌ DFlow WebSocket error');
        setError('WebSocket connection error');
        isConnectingRef.current = false;
      };

      ws.onclose = (event) => {
        console.log('🔌 DFlow WebSocket closed:', event.code);
        setIsConnected(false);
        wsRef.current = null;
        isConnectingRef.current = false;

        // Only auto-reconnect if under max attempts, not a normal closure, and autoReconnect enabled
        if (autoReconnect && 
            reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && 
            event.code !== 1000) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 16000);
          console.log(`🔄 Reconnecting in ${delay}ms... (${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to connect to real-time updates');
      isConnectingRef.current = false;
    }
  }, [tickers, channels, onPriceUpdate, onTradeUpdate, onOrderbookUpdate, autoReconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000); // Normal closure
      wsRef.current = null;
    }
    
    setIsConnected(false);
    isConnectingRef.current = false;
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
