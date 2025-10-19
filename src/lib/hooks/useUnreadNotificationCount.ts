'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { useNotifications } from '@/lib/context/NotificationContext';
import { trpc } from '@/app/lib/trpc';

const STORAGE_KEY = 'unreadNotificationCount';

export function useUnreadNotificationCount() {
  const [count, setCount] = useState(0);
  const { user } = useAuth();
  const { lastNotificationTime } = useNotifications();

  // Fetch actual unread count from database (just the count, not the full notifications)
  const { data: unreadCountData, refetch } =
    trpc.notification.getUnreadCount.useQuery(
      { userId: user?.id ?? '' },
      {
        enabled: !!user?.id,
        refetchInterval: 30000, // Refetch every 30 seconds
        refetchOnWindowFocus: true,
      }
    );

  // Update count when database count changes - this is the source of truth
  useEffect(() => {
    if (unreadCountData) {
      setCount(unreadCountData.count);
      localStorage.setItem(STORAGE_KEY, String(unreadCountData.count));
    }
  }, [unreadCountData]);

  // Refetch count when new realtime notification arrives
  useEffect(() => {
    if (lastNotificationTime > 0) {
      refetch();
    }
  }, [lastNotificationTime, refetch]);

  const resetCount = useCallback(() => {
    setCount(0);
    localStorage.setItem(STORAGE_KEY, '0');
    // Refetch to get updated count from database
    refetch();
  }, [refetch]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        setCount(parseInt(e.newValue, 10));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return { count, resetCount };
}
