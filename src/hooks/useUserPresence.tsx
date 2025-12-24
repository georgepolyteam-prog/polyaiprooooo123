import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PresenceState {
  activeUserCount: number;
  isHighTraffic: boolean;
}

const HIGH_TRAFFIC_THRESHOLD = 20;

export const useUserPresence = (): PresenceState => {
  const [activeUserCount, setActiveUserCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userIdRef = useRef<string>(`anon_${Math.random().toString(36).substring(2, 15)}`);

  useEffect(() => {
    const channel = supabase.channel('site_presence', {
      config: {
        presence: {
          key: userIdRef.current,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setActiveUserCount(count);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userIdRef.current,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return {
    activeUserCount,
    isHighTraffic: activeUserCount >= HIGH_TRAFFIC_THRESHOLD,
  };
};
