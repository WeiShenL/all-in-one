'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRealtimeNotifications } from './useRealtimeNotifications';

const STORAGE_KEY = 'unreadNotificationCount';

export function useUnreadNotificationCount() {
  const [count, setCount] = useState(0);

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setCount(stored ? parseInt(stored, 10) : 0);
  }, []);

  // Increment count when new realtime notification arrives
  const handleNewNotification = useCallback(() => {
    // Don't increment if user is on notifications page
    if (
      typeof window !== 'undefined' &&
      window.location.pathname === '/notifications'
    ) {
      return;
    }

    setCount(prev => {
      const newCount = prev + 1;
      localStorage.setItem(STORAGE_KEY, String(newCount));
      return newCount;
    });
  }, []);

  // Reset count (called when user opens notifications page)
  const resetCount = useCallback(() => {
    setCount(0);
    localStorage.setItem(STORAGE_KEY, '0');
  }, []);

  // Listen to realtime notifications
  useRealtimeNotifications({
    channel: 'notifications',
    onNotification: handleNewNotification,
    autoReconnect: true,
  });

  // Sync across tabs (when another tab resets count)
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
