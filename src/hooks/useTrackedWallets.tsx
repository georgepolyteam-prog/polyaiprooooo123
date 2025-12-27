import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface TrackedWallet {
  id: string;
  wallet_address: string;
  nickname: string | null;
  created_at: string;
}

export function useTrackedWallets() {
  const { user } = useAuth();
  const [trackedWallets, setTrackedWallets] = useState<TrackedWallet[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTrackedWallets = useCallback(async () => {
    if (!user) {
      setTrackedWallets([]);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tracked_wallets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrackedWallets(data || []);
    } catch (error) {
      console.error('Error fetching tracked wallets:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTrackedWallets();
  }, [fetchTrackedWallets]);

  const trackWallet = async (walletAddress: string, nickname?: string) => {
    if (!user) {
      toast.error('Please sign in to track wallets');
      return false;
    }

    try {
      const { error } = await supabase
        .from('tracked_wallets')
        .insert({
          user_id: user.id,
          wallet_address: walletAddress.toLowerCase(),
          nickname: nickname || null
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Wallet already tracked');
        } else {
          throw error;
        }
        return false;
      }

      toast.success('Wallet tracked successfully');
      await fetchTrackedWallets();
      return true;
    } catch (error) {
      console.error('Error tracking wallet:', error);
      toast.error('Failed to track wallet');
      return false;
    }
  };

  const untrackWallet = async (walletAddress: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('tracked_wallets')
        .delete()
        .eq('user_id', user.id)
        .eq('wallet_address', walletAddress.toLowerCase());

      if (error) throw error;

      toast.success('Wallet removed from tracking');
      await fetchTrackedWallets();
      return true;
    } catch (error) {
      console.error('Error untracking wallet:', error);
      toast.error('Failed to remove wallet');
      return false;
    }
  };

  const updateNickname = async (walletAddress: string, nickname: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('tracked_wallets')
        .update({ nickname: nickname || null })
        .eq('user_id', user.id)
        .eq('wallet_address', walletAddress.toLowerCase());

      if (error) throw error;

      toast.success('Nickname updated');
      await fetchTrackedWallets();
      return true;
    } catch (error) {
      console.error('Error updating nickname:', error);
      toast.error('Failed to update nickname');
      return false;
    }
  };

  const isWalletTracked = useCallback((walletAddress: string) => {
    return trackedWallets.some(
      w => w.wallet_address.toLowerCase() === walletAddress.toLowerCase()
    );
  }, [trackedWallets]);

  const getTrackedAddresses = useCallback(() => {
    return new Set(trackedWallets.map(w => w.wallet_address.toLowerCase()));
  }, [trackedWallets]);

  return {
    trackedWallets,
    loading,
    trackWallet,
    untrackWallet,
    updateNickname,
    isWalletTracked,
    getTrackedAddresses,
    refetch: fetchTrackedWallets
  };
}
