'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const WARNING_TIMEOUT = 14 * 60 * 1000; // 14 minutes - show warning 1 min before

interface UseSessionTimeoutOptions {
  onTimeout: () => Promise<void>;
  enabled: boolean;
}

/**
 * Hook to handle automatic logout after 15 minutes of inactivity
 * Tracks user interactions (mouse, keyboard, scroll, touch) and resets timer
 */
export function useSessionTimeout({
  onTimeout,
  enabled,
}: UseSessionTimeoutOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    clearTimers();
    await onTimeout();

    // Redirect to login with session expired message
    const currentPath = pathname;
    const redirectUrl = `/auth/login?expired=true&redirect=${encodeURIComponent(currentPath)}`;
    router.push(redirectUrl);
  }, [onTimeout, router, pathname, clearTimers]);

  const resetTimer = useCallback(() => {
    if (!enabled) {
      return;
    }

    const now = Date.now();
    lastActivityRef.current = now;

    clearTimers();

    // Set timeout for automatic logout
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT);

    // Set warning timeout (1 minute before logout)
    warningRef.current = setTimeout(() => {
      console.warn('Session will expire in 1 minute due to inactivity');
      // You could dispatch an event here to show a warning modal
    }, WARNING_TIMEOUT);
  }, [enabled, handleLogout, clearTimers]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    // Events that indicate user activity
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle the activity handler to avoid excessive timer resets
    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (throttleTimeout) {
        return;
      }

      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
      }, 1000); // Throttle to once per second

      resetTimer();
    };

    // Initialize timer
    resetTimer();

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
      clearTimers();
    };
  }, [enabled, resetTimer, clearTimers]);

  return {
    resetTimer,
    clearTimers,
    lastActivity: lastActivityRef.current,
  };
}
