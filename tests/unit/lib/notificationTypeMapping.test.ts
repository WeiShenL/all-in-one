import { toFrontendNotificationType } from '@/lib/notificationTypeMapping';
import { NotificationType as PrismaNotificationType } from '@prisma/client';

describe('notificationTypeMapping', () => {
  describe('toFrontendNotificationType', () => {
    it('should map TASK_ASSIGNED to info', () => {
      const result = toFrontendNotificationType(
        PrismaNotificationType.TASK_ASSIGNED
      );
      expect(result).toBe('info');
    });

    it('should map TASK_UPDATED to info', () => {
      const result = toFrontendNotificationType(
        PrismaNotificationType.TASK_UPDATED
      );
      expect(result).toBe('info');
    });

    it('should map COMMENT_ADDED to info', () => {
      const result = toFrontendNotificationType(
        PrismaNotificationType.COMMENT_ADDED
      );
      expect(result).toBe('info');
    });

    it('should map TASK_DELETED to info', () => {
      const result = toFrontendNotificationType(
        PrismaNotificationType.TASK_DELETED
      );
      expect(result).toBe('info');
    });

    it('should map TASK_REASSIGNED to info', () => {
      const result = toFrontendNotificationType(
        PrismaNotificationType.TASK_REASSIGNED
      );
      expect(result).toBe('info');
    });

    it('should map DEADLINE_REMINDER to warning', () => {
      const result = toFrontendNotificationType(
        PrismaNotificationType.DEADLINE_REMINDER
      );
      expect(result).toBe('warning');
    });

    it('should map TASK_OVERDUE to error', () => {
      const result = toFrontendNotificationType(
        PrismaNotificationType.TASK_OVERDUE
      );
      expect(result).toBe('error');
    });

    it('should handle unknown notification type with default info', () => {
      // Test with any value that might come through
      const unknownType = 'UNKNOWN_TYPE' as any;
      const result = toFrontendNotificationType(unknownType);
      expect(result).toBe('info');
    });
  });
});
