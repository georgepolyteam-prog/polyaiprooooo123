import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

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

const STORAGE_KEY = 'polymarket-price-alerts';

export function useAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const notificationPermissionRef = useRef<NotificationPermission>('default');

  // Load alerts from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PriceAlert[];
        setAlerts(parsed);
      }
    } catch (e) {
      console.error('[Alerts] Failed to load alerts:', e);
    }

    // Check notification permission
    if ('Notification' in window) {
      notificationPermissionRef.current = Notification.permission;
    }
  }, []);

  // Persist alerts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch (e) {
      console.error('[Alerts] Failed to save alerts:', e);
    }
  }, [alerts]);

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

  // Create a new alert
  const createAlert = useCallback(async (params: {
    marketSlug: string;
    conditionId: string;
    tokenId: string;
    targetPrice: number;
    direction: 'above' | 'below';
    marketTitle: string;
    marketImage?: string;
  }) => {
    // Request notification permission on first alert
    await requestNotificationPermission();

    const newAlert: PriceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...params,
      isActive: true,
      createdAt: Date.now(),
      triggeredAt: null,
      triggeredPrice: null,
    };

    setAlerts(prev => [...prev, newAlert]);

    toast({
      title: "Alert Created",
      description: `Alert set for ${params.marketTitle} ${params.direction} ${params.targetPrice}¢`,
    });

    return newAlert;
  }, [requestNotificationPermission]);

  // Delete an alert
  const deleteAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  // Dismiss a triggered alert (remove from triggered list)
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  // Update an alert
  const updateAlert = useCallback((alertId: string, updates: Partial<PriceAlert>) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, ...updates } : a
    ));
  }, []);

  // Trigger an alert
  const triggerAlert = useCallback((alert: PriceAlert, currentPrice: number) => {
    // Update alert status
    updateAlert(alert.id, {
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
      title: "🎯 Alert Triggered!",
      description: `${alert.marketTitle} hit ${Math.round(currentPrice)}¢`,
    });
  }, [updateAlert]);

  // Check if any alerts should trigger for a given market
  const checkAlerts = useCallback((conditionId: string, currentPrice: number) => {
    const marketAlerts = alerts.filter(
      a => a.conditionId === conditionId && a.isActive
    );

    marketAlerts.forEach(alert => {
      const shouldTrigger =
        (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
        (alert.direction === 'below' && currentPrice <= alert.targetPrice);

      if (shouldTrigger) {
        triggerAlert(alert, currentPrice);
      }
    });
  }, [alerts, triggerAlert]);

  // Get alerts for a specific market
  const getAlertsForMarket = useCallback((marketSlug: string) => {
    return alerts.filter(a => a.marketSlug === marketSlug);
  }, [alerts]);

  // Computed values
  const activeAlerts = alerts.filter(a => a.isActive);
  const triggeredAlerts = alerts.filter(a => !a.isActive && a.triggeredAt !== null);

  return {
    alerts,
    activeAlerts,
    triggeredAlerts,
    createAlert,
    deleteAlert,
    dismissAlert,
    updateAlert,
    checkAlerts,
    getAlertsForMarket,
    requestNotificationPermission,
  };
}
