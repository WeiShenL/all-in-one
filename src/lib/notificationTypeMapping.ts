import { NotificationType as PrismaNotificationType } from '@prisma/client';
import type { NotificationSeverity } from '@/types/notification';

export const toFrontendNotificationType = (
  prismaType: PrismaNotificationType
): NotificationSeverity => {
  switch (prismaType) {
    case PrismaNotificationType.TASK_ASSIGNED:
    case PrismaNotificationType.TASK_UPDATED:
    case PrismaNotificationType.COMMENT_ADDED:
    case PrismaNotificationType.TASK_DELETED:
    case PrismaNotificationType.TASK_REASSIGNED:
      return 'info';
    case PrismaNotificationType.DEADLINE_REMINDER:
      return 'warning';
    case PrismaNotificationType.TASK_OVERDUE:
      return 'error';
    default:
      return 'info';
  }
};
