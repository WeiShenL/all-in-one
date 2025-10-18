import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useNotifications } from '@/lib/context/NotificationContext';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const WARNING_TIMEOUT = 14 * 60 * 1000; // 14 minutes - show warning 1 min before

interface UseSessionTimeoutOptions {
  onTimeout: () => Promise<void>;
  enabled: boolean;
}

/**
 * Hook to handle automatic logout after 15 minutes of inactivity
 * Tracks user interactions (mouse, keyboard, scroll, touch) and resets timer
 * Shows real-time toast notifications for warnings and logout
 */
export function useSessionTimeout({
  onTimeout,
  enabled,
}: UseSessionTimeoutOptions) {
  const pathname = usePathname();
  const { addNotification, notifications, dismissNotification } =
    useNotifications();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef<boolean>(false);
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

    // Store session expired flag in localStorage
    const currentPath = pathname;
    localStorage.setItem('sessionExpired', 'true');
    localStorage.setItem('sessionExpiredRedirect', currentPath);

    // Don't show notification here - it will be shown on the login page instead
    await onTimeout();
  }, [onTimeout, pathname, clearTimers]);

  const resetTimer = useCallback(() => {
    if (!enabled) {
      return;
    }

    const now = Date.now();
    lastActivityRef.current = now;

    // Clear warning notification if user became active
    if (warningShownRef.current) {
      // Dismiss all warning notifications with animation
      notifications.forEach(notification => {
        if (notification.type === 'warning') {
          dismissNotification(notification.id);
        }
      });
      warningShownRef.current = false;
    }

    clearTimers();

    // Set timeout for automatic logout
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT);

    // Set warning timeout (1 minute before logout)
    warningRef.current = setTimeout(() => {
      warningShownRef.current = true;
      addNotification(
        'warning',
        'Inactivity Warning',
        'Your session will expire soon due to inactivity. Move your mouse or press a key to stay logged in.'
      );
    }, WARNING_TIMEOUT);
  }, [
    enabled,
    handleLogout,
    clearTimers,
    addNotification,
    notifications,
    dismissNotification,
  ]);

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

    // Initialize timer on mount only
    const initTimer = () => {
      clearTimers();

      // Set timeout for automatic logout
      timeoutRef.current = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_TIMEOUT);

      // Set warning timeout (1 minute before logout)
      warningRef.current = setTimeout(() => {
        warningShownRef.current = true;
        addNotification(
          'warning',
          'Inactivity Warning',
          'Your session will expire soon due to inactivity. Move your mouse or press a key to stay logged in.'
        );
      }, WARNING_TIMEOUT);
    };

    initTimer();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    resetTimer,
    clearTimers,
    lastActivity: lastActivityRef.current,
  };
}
