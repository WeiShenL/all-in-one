import { NotificationType as PrismaNotificationType } from '@prisma/client';

export type FrontendNotificationType = 'info' | 'success' | 'warning' | 'error';

export const toFrontendNotificationType = (
  prismaType: PrismaNotificationType
): FrontendNotificationType => {
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
