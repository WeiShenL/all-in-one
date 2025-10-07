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
    message: string
  ) => void;
  removeNotification: (id: string) => void;
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

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (type: NotificationType, title: string, message: string) => {
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

      // Auto-remove after delay
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
    notifications,
    addNotification,
    removeNotification,
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
