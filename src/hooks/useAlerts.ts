import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PriceAlert {
  id: string;
  marketSlug: string;
  conditionId: string;
  tokenId: string;
  targetPrice: number; // 0-100 cents
  direction: 'above' | 'below';
  isActive: boolean;
  createdAt: number;
  triggeredAt: number | null;
  triggeredPrice: number | null;
  marketTitle: string;
  marketImage?: string;
}

export function useAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const notificationPermissionRef = useRef<NotificationPermission>('default');

  // Load alerts from Supabase on mount / user change
  useEffect(() => {
    if (!user) {
      setAlerts([]);
      return;
    }

    const loadAlerts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_price_alerts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped: PriceAlert[] = (data || []).map((row: any) => ({
          id: row.id,
          marketSlug: row.market_slug,
          conditionId: row.condition_id,
          tokenId: row.token_id || '',
          targetPrice: row.target_price,
          direction: row.direction as 'above' | 'below',
          isActive: row.is_active,
          createdAt: new Date(row.created_at).getTime(),
          triggeredAt: row.triggered_at ? new Date(row.triggered_at).getTime() : null,
          triggeredPrice: row.triggered_price,
          marketTitle: row.market_title,
          marketImage: row.market_image,
        }));

        setAlerts(mapped);
      } catch (e) {
        console.error('[Alerts] Failed to load alerts:', e);
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();

    // Check notification permission
    if ('Notification' in window) {
      notificationPermissionRef.current = Notification.permission;
    }
  }, [user]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      notificationPermissionRef.current = permission;
      return permission === 'granted';
    }

    return Notification.permission === 'granted';
  }, []);

  // Create a new alert (requires auth)
  const createAlert = useCallback(async (params: {
    marketSlug: string;
    conditionId: string;
    tokenId: string;
    targetPrice: number;
    direction: 'above' | 'below';
    marketTitle: string;
    marketImage?: string;
  }) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to set price alerts',
        variant: 'destructive',
      });
      return null;
    }

    // Request notification permission on first alert
    await requestNotificationPermission();

    try {
      const { data, error } = await supabase
        .from('user_price_alerts')
        .insert({
          user_id: user.id,
          market_slug: params.marketSlug,
          condition_id: params.conditionId,
          token_id: params.tokenId,
          target_price: params.targetPrice,
          direction: params.direction,
          market_title: params.marketTitle,
          market_image: params.marketImage,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      const newAlert: PriceAlert = {
        id: data.id,
        marketSlug: data.market_slug,
        conditionId: data.condition_id,
        tokenId: data.token_id || '',
        targetPrice: data.target_price,
        direction: data.direction as 'above' | 'below',
        isActive: data.is_active,
        createdAt: new Date(data.created_at).getTime(),
        triggeredAt: null,
        triggeredPrice: null,
        marketTitle: data.market_title,
        marketImage: data.market_image,
      };

      setAlerts((prev) => [newAlert, ...prev]);

      toast({
        title: 'Alert Created',
        description: `Alert set for ${params.marketTitle} ${params.direction} ${params.targetPrice}¢`,
      });

      return newAlert;
    } catch (e) {
      console.error('[Alerts] Failed to create alert:', e);
      toast({
        title: 'Error',
        description: 'Failed to create alert',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, requestNotificationPermission]);

  // Delete an alert
  const deleteAlert = useCallback(async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('user_price_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (e) {
      console.error('[Alerts] Failed to delete alert:', e);
    }
  }, []);

  // Dismiss a triggered alert (remove from triggered list)
  const dismissAlert = useCallback(async (alertId: string) => {
    await deleteAlert(alertId);
  }, [deleteAlert]);

  // Update an alert
  const updateAlert = useCallback(async (alertId: string, updates: Partial<PriceAlert>) => {
    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.triggeredAt !== undefined)
        dbUpdates.triggered_at = updates.triggeredAt ? new Date(updates.triggeredAt).toISOString() : null;
      if (updates.triggeredPrice !== undefined) dbUpdates.triggered_price = updates.triggeredPrice;

      const { error } = await supabase
        .from('user_price_alerts')
        .update(dbUpdates)
        .eq('id', alertId);

      if (error) throw error;

      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, ...updates } : a))
      );
    } catch (e) {
      console.error('[Alerts] Failed to update alert:', e);
    }
  }, []);

  // Trigger an alert
  const triggerAlert = useCallback(
    async (alert: PriceAlert, currentPrice: number) => {
      // Update alert status
      await updateAlert(alert.id, {
        isActive: false,
        triggeredAt: Date.now(),
        triggeredPrice: currentPrice,
      });

      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🔔 Price Alert Triggered!', {
          body: `${alert.marketTitle}: Price ${alert.direction} ${alert.targetPrice}¢ (now ${Math.round(currentPrice)}¢)`,
          icon: alert.marketImage || '/favicon.png',
          requireInteraction: true,
          tag: alert.id,
        });
      }

      // Show in-app toast
      toast({
        title: '🎯 Alert Triggered!',
        description: `${alert.marketTitle} hit ${Math.round(currentPrice)}¢`,
      });
    },
    [updateAlert]
  );

  // Check if any alerts should trigger for a given market
  const checkAlerts = useCallback(
    (conditionId: string, currentPrice: number) => {
      const marketAlerts = alerts.filter(
        (a) => a.conditionId === conditionId && a.isActive
      );

      marketAlerts.forEach((alert) => {
        const shouldTrigger =
          (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
          (alert.direction === 'below' && currentPrice <= alert.targetPrice);

        if (shouldTrigger) {
          triggerAlert(alert, currentPrice);
        }
      });
    },
    [alerts, triggerAlert]
  );

  // Get alerts for a specific market
  const getAlertsForMarket = useCallback(
    (marketSlug: string) => {
      return alerts.filter((a) => a.marketSlug === marketSlug);
    },
    [alerts]
  );

  // Computed values
  const activeAlerts = alerts.filter((a) => a.isActive);
  const triggeredAlerts = alerts.filter((a) => !a.isActive && a.triggeredAt !== null);

  return {
    alerts,
    activeAlerts,
    triggeredAlerts,
    loading,
    isAuthenticated: !!user,
    createAlert,
    deleteAlert,
    dismissAlert,
    updateAlert,
    checkAlerts,
    getAlertsForMarket,
    requestNotificationPermission,
  };
}
