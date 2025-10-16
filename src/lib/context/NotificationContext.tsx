'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useRealtimeNotifications } from '@/lib/hooks/useRealtimeNotifications';
import type {
  Notification,
  NotificationType,
  RealtimeNotification,
} from '@/types/notification';

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (
    type: NotificationType,
    title: string,
    message: string,
    customTimeout?: number
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
      // Mark as dismissing to trigger exit animation
      setDismissingIds(prev => new Set(prev).add(id));
      // Remove after animation completes
      setTimeout(() => {
        removeNotification(id);
      }, 300);
    },
    [removeNotification]
  );

  const addNotification = useCallback(
    (
      type: NotificationType,
      title: string,
      message: string,
      customTimeout?: number
    ) => {
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
        // Keep only the most recent notifications
        return updated.slice(0, maxNotifications);
      });

      // Auto-remove after delay (use customTimeout if provided, otherwise use default)
      const timeoutDuration =
        customTimeout !== undefined ? customTimeout : autoRemoveDelay;
      if (timeoutDuration > 0) {
        setTimeout(() => {
          dismissNotification(id); // Use dismissNotification to trigger exit animation
        }, timeoutDuration);
      }
    },
    [autoRemoveDelay, maxNotifications, dismissNotification]
  );

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Handle incoming realtime notifications
  const handleRealtimeNotification = useCallback(
    (notification: RealtimeNotification) => {
      addNotification(
        notification.type,
        notification.title,
        notification.message
      );
    },
    [addNotification]
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
