'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNotifications } from '@/lib/context/NotificationContext';
import { useAuth } from '@/lib/supabase/auth-context';
import { trpc } from '@/app/lib/trpc';

const STORAGE_KEY = 'unreadNotificationCount';

export function useUnreadNotificationCount() {
  const [count, setCount] = useState(0);
  const { notifications } = useNotifications();
  const { user } = useAuth();

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

  // Update count when database count changes
  useEffect(() => {
    if (unreadCountData) {
      setCount(unreadCountData.count);
      localStorage.setItem(STORAGE_KEY, String(unreadCountData.count));
    }
  }, [unreadCountData]);

  // Also increment count when new toast notifications appear (for immediate feedback)
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.location.pathname === '/notifications'
    ) {
      return;
    }

    if (notifications.length > 0) {
      setCount(prev => {
        const newCount = prev + 1;
        localStorage.setItem(STORAGE_KEY, String(newCount));
        return newCount;
      });
    }
  }, [notifications.length]);

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
