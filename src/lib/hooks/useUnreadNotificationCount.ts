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

  // Fetch actual unread count from database ONLY on initial load
  const { data: unreadCountData, refetch } =
    trpc.notification.getUnreadCount.useQuery(
      { userId: user?.id ?? '' },
      {
        enabled: !!user?.id,
        staleTime: Infinity, // Never auto-refetch - we manage count manually
        gcTime: Infinity, // Keep in cache forever (until logout)
        refetchOnWindowFocus: false,
        refetchOnMount: false, // Only fetch once
        refetchOnReconnect: false,
      }
    );

  // Initialize count from DB (first load only)
  useEffect(() => {
    if (unreadCountData) {
      setCount(unreadCountData.count);
      localStorage.setItem(STORAGE_KEY, String(unreadCountData.count));
    }
  }, [unreadCountData]);

  // Increment count when realtime notification arrives (NO DB QUERY)
  useEffect(() => {
    if (lastNotificationTime > 0) {
      setCount(prev => {
        const newCount = prev + 1;
        localStorage.setItem(STORAGE_KEY, String(newCount));
        return newCount;
      });
    }
  }, [lastNotificationTime]);

  // Reset count (called when user views notifications)
  const resetCount = useCallback(() => {
    setCount(0);
    localStorage.setItem(STORAGE_KEY, '0');
  }, []);

  // Manual refetch from DB (for explicit sync, e.g., after error)
  const syncFromDatabase = useCallback(() => {
    refetch();
  }, [refetch]);

  // Sync count across browser tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        setCount(parseInt(e.newValue, 10));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return { count, resetCount, syncFromDatabase };
}
