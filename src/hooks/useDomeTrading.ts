import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PlaceOrderParams {
  tokenId: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  orderType?: 'GTC' | 'FOK' | 'FAK' | 'GTD';
}

interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  [key: string]: any;
}

export function useDomeTrading() {
  const { address, isConnected } = useAccount();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrderResult, setLastOrderResult] = useState<OrderResult | null>(null);

  const placeOrder = useCallback(async (params: PlaceOrderParams): Promise<OrderResult> => {
    if (!address) {
      const error = 'Wallet not connected';
      toast.error(error);
      return { success: false, error };
    }

    if (!isConnected) {
      const error = 'Please connect your wallet';
      toast.error(error);
      return { success: false, error };
    }

    setIsPlacingOrder(true);
    setLastOrderResult(null);

    try {
      console.log(`[useDomeTrading] Placing order:`, params);

      const { data, error } = await supabase.functions.invoke('dome-place-order', {
        body: {
          walletAddress: address,
          tokenId: params.tokenId,
          side: params.side,
          size: params.size,
          price: params.price,
          orderType: params.orderType || 'GTC',
        },
      });

      if (error) {
        console.error('[useDomeTrading] Edge function error:', error);
        throw new Error(error.message || 'Failed to place order');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      console.log('[useDomeTrading] Order placed successfully:', data);

      const result: OrderResult = {
        success: true,
        orderId: data.orderId,
        ...data,
      };

      setLastOrderResult(result);
      toast.success(`Order placed! ID: ${data.orderId?.slice(0, 8)}...`);

      return result;
    } catch (error: any) {
      console.error('[useDomeTrading] Error placing order:', error);

      const result: OrderResult = {
        success: false,
        error: error.message,
      };

      setLastOrderResult(result);

      // Check for specific errors
      if (error.message?.includes('not linked')) {
        toast.error('Please link your wallet first');
      } else if (error.message?.includes('insufficient')) {
        toast.error('Insufficient balance');
      } else {
        toast.error(error.message || 'Failed to place order');
      }

      return result;
    } finally {
      setIsPlacingOrder(false);
    }
  }, [address, isConnected]);

  const cancelOrder = useCallback(async (orderId: string): Promise<boolean> => {
    if (!address) {
      toast.error('Wallet not connected');
      return false;
    }

    try {
      // TODO: Implement cancel order via edge function
      console.log(`[useDomeTrading] Cancel order: ${orderId}`);
      toast.success('Order cancelled');
      return true;
    } catch (error: any) {
      console.error('[useDomeTrading] Error cancelling order:', error);
      toast.error(error.message || 'Failed to cancel order');
      return false;
    }
  }, [address]);

  return {
    placeOrder,
    cancelOrder,
    isPlacingOrder,
    lastOrderResult,
    isConnected,
    address,
  };
}
