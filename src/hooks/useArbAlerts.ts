import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ArbAlert {
  id: string;
  userId: string;
  alertType: 'spread_threshold' | 'sport_filter' | 'market_specific';
  sport: string | null;
  minSpreadPercent: number;
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useArbAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<ArbAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!user) {
      setAlerts([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: dbError } = await supabase
        .from('arb_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      setAlerts(
        (data || []).map((row) => ({
          id: row.id,
          userId: row.user_id,
          alertType: row.alert_type as ArbAlert['alertType'],
          sport: row.sport,
          minSpreadPercent: Number(row.min_spread_percent),
          isActive: row.is_active,
          lastTriggeredAt: row.last_triggered_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      );
    } catch (err) {
      console.error('[useArbAlerts] Error fetching alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const createAlert = useCallback(
    async (alert: Omit<ArbAlert, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'lastTriggeredAt'>) => {
      if (!user) throw new Error('Must be logged in to create alerts');

      const { data, error: dbError } = await supabase
        .from('arb_alerts')
        .insert({
          user_id: user.id,
          alert_type: alert.alertType,
          sport: alert.sport,
          min_spread_percent: alert.minSpreadPercent,
          is_active: alert.isActive,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      await fetchAlerts();
      return data;
    },
    [user, fetchAlerts]
  );

  const updateAlert = useCallback(
    async (id: string, updates: Partial<Pick<ArbAlert, 'isActive' | 'minSpreadPercent' | 'sport'>>) => {
      if (!user) throw new Error('Must be logged in to update alerts');

      const updateData: Record<string, unknown> = {};
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.minSpreadPercent !== undefined) updateData.min_spread_percent = updates.minSpreadPercent;
      if (updates.sport !== undefined) updateData.sport = updates.sport;

      const { error: dbError } = await supabase
        .from('arb_alerts')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      await fetchAlerts();
    },
    [user, fetchAlerts]
  );

  const deleteAlert = useCallback(
    async (id: string) => {
      if (!user) throw new Error('Must be logged in to delete alerts');

      const { error: dbError } = await supabase
        .from('arb_alerts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      await fetchAlerts();
    },
    [user, fetchAlerts]
  );

  const toggleAlert = useCallback(
    async (id: string) => {
      const alert = alerts.find((a) => a.id === id);
      if (!alert) return;

      await updateAlert(id, { isActive: !alert.isActive });
    },
    [alerts, updateAlert]
  );

  return {
    alerts,
    activeAlerts: alerts.filter((a) => a.isActive),
    isLoading,
    error,
    createAlert,
    updateAlert,
    deleteAlert,
    toggleAlert,
    refresh: fetchAlerts,
  };
}
