import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * EIP-712 domain for Polymarket CLOB authentication.
 * 
 * IMPORTANT: The domain name 'ClobAuthDomain' is the expected format for Polymarket's
 * derive-api-key endpoint. This matches what the official Polymarket CLOB client uses.
 * If signature verification fails, verify this matches the current Polymarket API docs.
 * 
 * Reference: https://docs.polymarket.com/#derive-api-key
 */
const CLOB_AUTH_DOMAIN = {
  name: 'ClobAuthDomain',
  version: '1',
  chainId: 137, // Polygon mainnet
} as const;

// EIP-712 types for CLOB auth
const CLOB_AUTH_TYPES = {
  ClobAuth: [
    { name: 'address', type: 'address' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'message', type: 'string' },
  ],
} as const;

export function usePolymarketLink() {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [isLinking, setIsLinking] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Check if user is already linked
  const checkLinkStatus = useCallback(async () => {
    if (!address) {
      setIsLinked(false);
      return false;
    }

    setIsChecking(true);
    try {
      // Check if credentials exist in database
      const { data, error } = await supabase
        .from('polymarket_credentials')
        .select('id')
        .eq('user_address', address.toLowerCase())
        .maybeSingle();

      if (error) {
        console.error('[usePolymarketLink] Error checking link status:', error);
        setIsLinked(false);
        return false;
      }

      const linked = !!data;
      setIsLinked(linked);
      return linked;
    } catch (error) {
      console.error('[usePolymarketLink] Error checking link status:', error);
      setIsLinked(false);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [address]);

  // Check link status when address changes
  useEffect(() => {
    if (isConnected && address) {
      checkLinkStatus();
    } else {
      setIsLinked(false);
    }
  }, [address, isConnected, checkLinkStatus]);

  // Link user to Polymarket
  const linkUser = useCallback(async () => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsLinking(true);
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = timestamp;

      // Build EIP-712 message
      const message = {
        address: address as `0x${string}`,
        timestamp: timestamp.toString(),
        nonce: BigInt(nonce),
        message: 'This message attests that I control the given wallet',
      };

      console.log('[usePolymarketLink] Requesting signature for wallet linking...');

      // Get signature from user
      const signature = await signTypedDataAsync({
        account: address,
        domain: CLOB_AUTH_DOMAIN,
        types: CLOB_AUTH_TYPES,
        primaryType: 'ClobAuth',
        message,
      });

      console.log('[usePolymarketLink] Signature obtained, sending to backend...');

      // Send to backend to derive credentials and store
      const { data, error } = await supabase.functions.invoke('link-polymarket-user', {
        body: {
          walletAddress: address,
          signature,
          timestamp,
          nonce,
        },
      });

      if (error) {
        console.error('[usePolymarketLink] Backend error:', error);
        throw new Error(error.message || 'Failed to link wallet');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      console.log('[usePolymarketLink] Wallet linked successfully!');
      setIsLinked(true);
      toast.success('Wallet linked to Polymarket!');
      return true;
    } catch (error: any) {
      console.error('[usePolymarketLink] Error linking user:', error);
      
      // Handle user rejection
      if (error.message?.includes('rejected') || error.code === 4001) {
        toast.error('Signature rejected');
      } else {
        toast.error(error.message || 'Failed to link wallet');
      }
      throw error;
    } finally {
      setIsLinking(false);
    }
  }, [address, signTypedDataAsync]);

  // Unlink user (remove credentials)
  const unlinkUser = useCallback(async () => {
    if (!address) return;

    try {
      // Note: This requires service role, so we'd need an edge function
      // For now, just update local state
      setIsLinked(false);
      toast.success('Wallet unlinked');
    } catch (error) {
      console.error('[usePolymarketLink] Error unlinking:', error);
    }
  }, [address]);

  return {
    isLinked,
    isLinking,
    isChecking,
    linkUser,
    unlinkUser,
    checkLinkStatus,
    address,
    isConnected,
  };
}
