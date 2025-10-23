'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from 'react';
import { usePathname } from 'next/navigation';
import { useRealtimeNotifications } from '@/lib/hooks/useRealtimeNotifications';
import { useAuth } from '@/lib/supabase/auth-context';
import { trpc } from '@/app/lib/trpc';
import type {
  Notification,
  NotificationSeverity,
  RealtimeNotification,
} from '@/types/notification';
import { toFrontendNotificationType } from '@/lib/notificationTypeMapping';

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (
    type: NotificationSeverity,
    title: string,
    message: string
  ) => void;
  removeNotification: (id: string) => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  dismissAll: () => void; // Dismiss all with animation
  isConnected: boolean;
  error: Error | null;
  lastNotificationTime: number; // Timestamp of last notification received
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }
  return context;
};

/**
 * Optional version of useNotifications that returns null if provider is not available
 * Use this for components that can work without notifications (e.g., in AuthProvider)
 */
export const useNotificationsOptional = () => {
  return useContext(NotificationContext);
};

interface NotificationProviderProps {
  children: ReactNode;
  autoRemoveDelay?: number;
  maxNotifications?: number;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  autoRemoveDelay = 5000,
  maxNotifications = 5,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);
  const { user } = useAuth();
  const pathname = usePathname();

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setDismissingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  const dismissNotification = useCallback(
    (id: string) => {
      setDismissingIds(prev => new Set(prev).add(id));
      setTimeout(() => {
        removeNotification(id);
      }, 300);
    },
    [removeNotification]
  );

  const addNotification = useCallback(
    (type: NotificationSeverity, title: string, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const notification: Notification = {
        id,
        type,
        title,
        message,
        timestamp: Date.now(),
      };

      setNotifications(prev => {
        const updated = [notification, ...prev];
        return updated.slice(0, maxNotifications);
      });

      if (autoRemoveDelay > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, autoRemoveDelay);
      }
    },
    [autoRemoveDelay, maxNotifications, removeNotification]
  );

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismissAll = useCallback(() => {
    // Dismiss all notifications with animation
    notifications.forEach(notification => {
      dismissNotification(notification.id);
    });
  }, [notifications, dismissNotification]);

  // Check if we're on an auth page (do this early, before realtime setup)
  const isAuthPage = pathname?.startsWith('/auth') ?? false;

  const handleRealtimeNotification = useCallback(
    (notification: RealtimeNotification) => {
      // Don't show notifications on auth pages
      if (isAuthPage) {
        return;
      }

      // Only show notification if it's meant for this user
      if (notification.userId && user?.id && notification.userId !== user.id) {
        return;
      }

      const frontendType = toFrontendNotificationType(notification.type);
      addNotification(frontendType, notification.title, notification.message);

      // Update timestamp to trigger refetch in other components
      setLastNotificationTime(Date.now());
    },
    [addNotification, user?.id, isAuthPage]
  );

  const { isConnected, error } = useRealtimeNotifications({
    channel: 'notifications',
    userId: user?.id, // User-specific channel
    onNotification: handleRealtimeNotification,
    autoReconnect: true,
  });

  // Track if we've already fetched unread notifications for this user session
  const hasLoadedUnreadRef = useRef(false);
  const displayedNotificationIdsRef = useRef<Set<string>>(new Set());
  const previousUserIdRef = useRef<string | null>(null);

  // Fetch unread notifications - NEVER on auth pages
  const { data: unreadNotifications } =
    trpc.notification.getUnreadNotifications.useQuery(
      { userId: user?.id ?? '' },
      {
        enabled: !!user?.id && !isAuthPage && !hasLoadedUnreadRef.current,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      }
    );

  // Display unread notifications as toasts when they're fetched
  useEffect(() => {
    // Guard conditions
    if (!unreadNotifications || unreadNotifications.length === 0) {
      return;
    }
    if (!user?.id || isAuthPage || hasLoadedUnreadRef.current) {
      return;
    }

    // Mark that we've loaded unread notifications for this session
    hasLoadedUnreadRef.current = true;

    // Display each unread notification as a toast (skip duplicates)
    const notificationIds: string[] = [];
    unreadNotifications.forEach(dbNotification => {
      // Skip if already displayed
      if (displayedNotificationIdsRef.current.has(dbNotification.id)) {
        return;
      }

      const frontendType = toFrontendNotificationType(dbNotification.type);
      addNotification(
        frontendType,
        dbNotification.title,
        dbNotification.message
      );
      notificationIds.push(dbNotification.id);
      displayedNotificationIdsRef.current.add(dbNotification.id);
    });

    // Don't automatically mark as read here - let the user open the modal to mark as read
    // This way the count stays accurate until the user actually views them
    // if (notificationIds.length > 0) {
    //   setTimeout(() => {
    //     markAsReadMutation.mutate({ notificationIds });
    //   }, 1000);
    // }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadNotifications, user?.id, isAuthPage]);

  // Reset the loaded flag when user logs out or changes
  useEffect(() => {
    if (!user?.id) {
      // User logged out - dismiss all notifications with animation
      notifications.forEach(notification => {
        dismissNotification(notification.id);
      });

      hasLoadedUnreadRef.current = false;
      displayedNotificationIdsRef.current.clear();
      previousUserIdRef.current = null;
    } else if (
      previousUserIdRef.current &&
      previousUserIdRef.current !== user.id
    ) {
      // New user logged in, reset the flag
      hasLoadedUnreadRef.current = false;
      displayedNotificationIdsRef.current.clear();
      previousUserIdRef.current = user.id;
    } else if (!previousUserIdRef.current) {
      previousUserIdRef.current = user.id;
    }
  }, [user?.id, notifications, dismissNotification]);

  const value: NotificationContextType = {
    notifications: notifications.map(n => ({
      ...n,
      isDismissing: dismissingIds.has(n.id),
    })) as Notification[],
    addNotification,
    removeNotification,
    dismissNotification,
    clearAll,
    dismissAll,
    isConnected,
    error,
    lastNotificationTime,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
