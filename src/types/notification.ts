import { NotificationType as PrismaNotificationType } from '@prisma/client';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationSeverity;
  title: string;
  message: string;
  timestamp: number;
  isDismissing?: boolean;
}

export interface RealtimeNotification {
  type: PrismaNotificationType;
  title: string;
  message: string;
  broadcast_at: string;
  userId: string; // The user this notification is intended for
}
