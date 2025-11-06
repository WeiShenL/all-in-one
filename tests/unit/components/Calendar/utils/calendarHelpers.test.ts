/**
 * Unit Tests for calendarHelpers Utility
 *
 * Testing calendar helper functions for status colors, priority colors,
 * and task ID extraction
 */

import {
  getStatusColor,
  getPriorityColor,
  getOriginalTaskId,
} from '@/app/components/Calendar/utils/calendarHelpers';

describe('calendarHelpers', () => {
  describe('getStatusColor', () => {
    it('should return blue for IN_PROGRESS status', () => {
      expect(getStatusColor('IN_PROGRESS')).toBe('#3182ce');
    });

    it('should return green for COMPLETED status', () => {
      expect(getStatusColor('COMPLETED')).toBe('#38a169');
    });

    it('should return red for BLOCKED status', () => {
      expect(getStatusColor('BLOCKED')).toBe('#e53e3e');
    });

    it('should return light purple for TO_DO status', () => {
      expect(getStatusColor('TO_DO')).toBe('#E8C0FA');
    });

    it('should return light purple for unknown/default status', () => {
      expect(getStatusColor('UNKNOWN_STATUS')).toBe('#E8C0FA');
      expect(getStatusColor('')).toBe('#E8C0FA');
    });

    it('should handle case-sensitive status strings', () => {
      // Should not match if case is different
      expect(getStatusColor('in_progress')).toBe('#E8C0FA');
      expect(getStatusColor('completed')).toBe('#E8C0FA');
    });
  });

  describe('getPriorityColor', () => {
    describe('High priority (>= 8)', () => {
      it('should return red for priority 8', () => {
        expect(getPriorityColor(8)).toBe('#dc2626');
      });

      it('should return red for priority 9', () => {
        expect(getPriorityColor(9)).toBe('#dc2626');
      });

      it('should return red for priority 10', () => {
        expect(getPriorityColor(10)).toBe('#dc2626');
      });

      it('should return red for priority greater than 10', () => {
        expect(getPriorityColor(15)).toBe('#dc2626');
        expect(getPriorityColor(100)).toBe('#dc2626');
      });
    });

    describe('Medium priority (5-7)', () => {
      it('should return orange for priority 5', () => {
        expect(getPriorityColor(5)).toBe('#f59e0b');
      });

      it('should return orange for priority 6', () => {
        expect(getPriorityColor(6)).toBe('#f59e0b');
      });

      it('should return orange for priority 7', () => {
        expect(getPriorityColor(7)).toBe('#f59e0b');
      });
    });

    describe('Low priority (< 5)', () => {
      it('should return green for priority 1', () => {
        expect(getPriorityColor(1)).toBe('#10b981');
      });

      it('should return green for priority 2', () => {
        expect(getPriorityColor(2)).toBe('#10b981');
      });

      it('should return green for priority 3', () => {
        expect(getPriorityColor(3)).toBe('#10b981');
      });

      it('should return green for priority 4', () => {
        expect(getPriorityColor(4)).toBe('#10b981');
      });

      it('should return green for priority 0', () => {
        expect(getPriorityColor(0)).toBe('#10b981');
      });

      it('should return green for negative priority', () => {
        expect(getPriorityColor(-1)).toBe('#10b981');
        expect(getPriorityColor(-10)).toBe('#10b981');
      });
    });

    describe('Edge cases', () => {
      it('should handle decimal priority values', () => {
        expect(getPriorityColor(7.5)).toBe('#f59e0b'); // Medium
        expect(getPriorityColor(8.1)).toBe('#dc2626'); // High
        expect(getPriorityColor(4.9)).toBe('#10b981'); // Low
      });
    });
  });

  describe('getOriginalTaskId', () => {
    it('should return original task ID for non-recurring task', () => {
      expect(getOriginalTaskId('task-123')).toBe('task-123');
      expect(getOriginalTaskId('abc-def-ghi')).toBe('abc-def-ghi');
    });

    it('should extract original task ID from first recurring occurrence', () => {
      expect(getOriginalTaskId('task-123-recur-1')).toBe('task-123');
    });

    it('should extract original task ID from second recurring occurrence', () => {
      expect(getOriginalTaskId('task-456-recur-2')).toBe('task-456');
    });

    it('should extract original task ID from nth recurring occurrence', () => {
      expect(getOriginalTaskId('task-789-recur-10')).toBe('task-789');
      expect(getOriginalTaskId('task-abc-recur-999')).toBe('task-abc');
    });

    it('should handle task IDs with hyphens', () => {
      expect(getOriginalTaskId('task-with-many-hyphens-recur-1')).toBe(
        'task-with-many-hyphens'
      );
    });

    it('should handle UUID-style task IDs', () => {
      expect(
        getOriginalTaskId('550e8400-e29b-41d4-a716-446655440000-recur-1')
      ).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should handle empty string', () => {
      expect(getOriginalTaskId('')).toBe('');
    });

    it('should handle task ID with -recur- but no suffix', () => {
      // Edge case: malformed recurring ID
      expect(getOriginalTaskId('task-123-recur-')).toBe('task-123');
    });

    it('should handle task ID that only contains -recur-', () => {
      expect(getOriginalTaskId('-recur-')).toBe('');
      expect(getOriginalTaskId('-recur-1')).toBe('');
    });

    it('should handle task ID with multiple -recur- patterns', () => {
      // Splits on first occurrence of '-recur-'
      expect(getOriginalTaskId('task-recur-1-recur-2')).toBe('task');
    });

    it('should preserve task IDs that contain "recur" but not the pattern', () => {
      expect(getOriginalTaskId('recurring-task-123')).toBe(
        'recurring-task-123'
      );
      expect(getOriginalTaskId('task-recurring')).toBe('task-recurring');
      expect(getOriginalTaskId('recur')).toBe('recur');
    });
  });
});
