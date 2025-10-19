'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useRealtimeNotifications } from '@/lib/hooks/useRealtimeNotifications';
import { useAuth } from '@/lib/supabase/auth-context';
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

  const handleRealtimeNotification = useCallback(
    (notification: RealtimeNotification) => {
      // Only show notification if it's meant for this user
      if (notification.userId && user?.id && notification.userId !== user.id) {
        return;
      }

      const frontendType = toFrontendNotificationType(notification.type);
      addNotification(frontendType, notification.title, notification.message);
    },
    [addNotification, user?.id]
  );

  const { isConnected, error } = useRealtimeNotifications({
    channel: 'notifications',
    onNotification: handleRealtimeNotification,
    autoReconnect: true,
  });

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
