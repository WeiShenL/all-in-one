'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
  RealtimeChannel,
  RealtimeChannelSendResponse,
} from '@supabase/supabase-js';
import type { RealtimeNotification } from '@/types/notification';

export interface UseRealtimeNotificationsOptions {
  channel?: string;
  onNotification?: (notification: RealtimeNotification) => void;
  autoReconnect?: boolean;
}

export interface UseRealtimeNotificationsReturn {
  isConnected: boolean;
  error: Error | null;
  sendBroadcast: (
    notification: Omit<RealtimeNotification, 'broadcast_at'>
  ) => Promise<RealtimeChannelSendResponse>;
}

export const useRealtimeNotifications = ({
  channel = 'notifications',
  onNotification,
  autoReconnect = true,
}: UseRealtimeNotificationsOptions = {}): UseRealtimeNotificationsReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    const supabase = supabaseRef.current;

    // Create channel and subscribe
    const realtimeChannel = supabase.channel(channel, {
      config: {
        broadcast: {
          self: true, // Receive own broadcasts for testing
        },
      },
    });

    // Subscribe to broadcast events
    realtimeChannel
      .on(
        'broadcast',
        { event: 'notification' },
        (payload: { payload: RealtimeNotification }) => {
          if (onNotification) {
            onNotification(payload.payload);
          }
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setError(new Error('Failed to connect to realtime channel'));
        } else if (status === 'TIMED_OUT') {
          setIsConnected(false);
          setError(new Error('Connection timed out'));
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    channelRef.current = realtimeChannel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [channel, onNotification, autoReconnect]);

  const sendBroadcast = async (
    notification: Omit<RealtimeNotification, 'broadcast_at'>
  ): Promise<RealtimeChannelSendResponse> => {
    if (!channelRef.current) {
      throw new Error('Channel not initialized');
    }

    const payload: RealtimeNotification = {
      ...notification,
      broadcast_at: new Date().toISOString(),
    };

    return channelRef.current.send({
      type: 'broadcast',
      event: 'notification',
      payload,
    });
  };

  return {
    isConnected,
    error,
    sendBroadcast,
  };
};
