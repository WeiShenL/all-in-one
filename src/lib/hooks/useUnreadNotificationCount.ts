'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNotifications } from '@/lib/context/NotificationContext';

const STORAGE_KEY = 'unreadNotificationCount';

export function useUnreadNotificationCount() {
  const [count, setCount] = useState(0);
  const { notifications } = useNotifications();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setCount(stored ? parseInt(stored, 10) : 0);
  }, []);

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
  }, []);

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
