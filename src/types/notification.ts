export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  isDismissing?: boolean;
}

export interface RealtimeNotification {
  type: NotificationType;
  title: string;
  message: string;
  broadcast_at: string;
}
