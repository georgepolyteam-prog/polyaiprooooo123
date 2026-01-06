import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UserCredits {
  credits_balance: number;
  total_deposited: number;
  total_spent: number;
}

export const useCredits = () => {
  const { user } = useAuth();
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    if (!user?.id) {
      setCredits(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('credits_balance, total_deposited, total_spent')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching credits:', error);
        setCredits({ credits_balance: 0, total_deposited: 0, total_spent: 0 });
      } else if (data) {
        setCredits(data);
      } else {
        // No row exists yet - that's fine, use defaults
        setCredits({ credits_balance: 0, total_deposited: 0, total_spent: 0 });
      }
    } catch (err) {
      console.error('Error fetching credits:', err);
      setCredits({ credits_balance: 0, total_deposited: 0, total_spent: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Subscribe to realtime updates for credits
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('user-credits-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[Credits] Realtime update received:', payload);
          if (payload.new && typeof payload.new === 'object') {
            const newData = payload.new as {
              credits_balance?: number;
              total_deposited?: number;
              total_spent?: number;
            };
            setCredits({
              credits_balance: newData.credits_balance || 0,
              total_deposited: newData.total_deposited || 0,
              total_spent: newData.total_spent || 0
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const useCredit = useCallback(async (amount: number = 1) => {
    if (!user?.id || !credits || credits.credits_balance < amount) {
      return false;
    }

    try {
      const { error } = await supabase
        .from('user_credits')
        .update({
          credits_balance: credits.credits_balance - amount,
          total_spent: (credits.total_spent || 0) + amount
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error using credit:', error);
        return false;
      }

      // Log credit usage
      await supabase
        .from('credit_usage')
        .insert({
          user_id: user.id,
          credits_used: amount
        });

      setCredits(prev => prev ? {
        ...prev,
        credits_balance: prev.credits_balance - amount,
        total_spent: (prev.total_spent || 0) + amount
      } : null);

      return true;
    } catch (err) {
      console.error('Error using credit:', err);
      return false;
    }
  }, [user?.id, credits]);

  const hasCredits = useCallback((amount: number = 1) => {
    return (credits?.credits_balance || 0) >= amount;
  }, [credits]);

  const refetch = useCallback(() => {
    fetchCredits();
  }, [fetchCredits]);

  return {
    credits: credits?.credits_balance || 0,
    totalDeposited: credits?.total_deposited || 0,
    totalSpent: credits?.total_spent || 0,
    isLoading,
    useCredit,
    hasCredits,
    refetch
  };
};
