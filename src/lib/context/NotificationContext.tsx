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
  isConnected: boolean;
  error: Error | null;
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
    },
    [addNotification, user?.id, isAuthPage]
  );

  const { isConnected, error } = useRealtimeNotifications({
    channel: 'notifications',
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

  const markAsReadMutation = trpc.notification.markAsRead.useMutation();

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

    // Mark notifications as read after displaying them
    if (notificationIds.length > 0) {
      // Delay marking as read to ensure toasts are visible first
      setTimeout(() => {
        markAsReadMutation.mutate({ notificationIds });
      }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadNotifications, user?.id, isAuthPage]);

  // Reset the loaded flag when user logs out or changes
  useEffect(() => {
    if (!user?.id) {
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
  }, [user?.id]);

  const value: NotificationContextType = {
    notifications: notifications.map(n => ({
      ...n,
      isDismissing: dismissingIds.has(n.id),
    })) as Notification[],
    addNotification,
    removeNotification,
    dismissNotification,
    clearAll,
    isConnected,
    error,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
