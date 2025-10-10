/**
 * TDD Tests for Task.updateRecurring()
 *
 * AC: Staff member can update recurring settings (enable/disable, change interval)
 * Requirements: Task recurrence (Change Document Week 6)
 * Constraint: If enabled, must have valid recurrence interval in days (TM057)
 * Note: Authorization is now handled in TaskService layer
 */

import { InvalidRecurrenceError } from '../../../../src/domain/task/errors/TaskErrors';
import { createTestTask } from '../../../helpers/taskTestHelpers';

describe('Task - updateRecurring()', () => {
  // No authorization tests - moved to TaskService tests

  describe('Enabling Recurrence', () => {
    it('should enable recurrence with valid days (7 days)', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        recurringInterval: null,
      });

      task.updateRecurring(true, 7);

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurringInterval()).toBe(7);
    });

    it('should enable recurrence with 1 day (minimum)', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        recurringInterval: null,
      });

      task.updateRecurring(true, 1);

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurringInterval()).toBe(1);
    });

    it('should enable recurrence with 30 days (monthly)', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        recurringInterval: null,
      });

      task.updateRecurring(true, 30);

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurringInterval()).toBe(30);
    });

    it('should throw InvalidRecurrenceError when enabling without days (TM057)', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        recurringInterval: null,
      });

      expect(() => task.updateRecurring(true, null)).toThrow(
        InvalidRecurrenceError
      );
    });

    it('should throw InvalidRecurrenceError when days <= 0', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        recurringInterval: null,
      });

      expect(() => task.updateRecurring(true, 0)).toThrow(
        InvalidRecurrenceError
      );

      expect(() => task.updateRecurring(true, -5)).toThrow(
        InvalidRecurrenceError
      );
    });
  });

  describe('Disabling Recurrence', () => {
    it('should disable recurrence', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        recurringInterval: 7,
      });

      task.updateRecurring(false, null);

      expect(task.isTaskRecurring()).toBe(false);
      expect(task.getRecurringInterval()).toBeNull();
    });

    it('should allow disabling with null days', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        recurringInterval: 14,
      });

      task.updateRecurring(false, null);

      expect(task.isTaskRecurring()).toBe(false);
      expect(task.getRecurringInterval()).toBeNull();
    });

    it('should ignore days parameter when disabling', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        recurringInterval: 7,
      });

      // Even if days provided, should ignore when disabling
      task.updateRecurring(false, 999);

      expect(task.isTaskRecurring()).toBe(false);
      expect(task.getRecurringInterval()).toBeNull();
    });
  });

  describe('Updating Recurrence Interval', () => {
    it('should update recurrence interval from 7 to 14 days', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        recurringInterval: 7,
      });

      task.updateRecurring(true, 14);

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurringInterval()).toBe(14);
    });

    it('should allow multiple updates to recurrence settings', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        recurringInterval: null,
      });

      task.updateRecurring(true, 7);
      expect(task.getRecurringInterval()).toBe(7);

      task.updateRecurring(true, 14);
      expect(task.getRecurringInterval()).toBe(14);

      task.updateRecurring(false, null);
      expect(task.isTaskRecurring()).toBe(false);
    });
  });

  describe('State Updates', () => {
    it('should update task timestamp when recurrence is changed', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        recurringInterval: null,
      });

      const oldTimestamp = task.getUpdatedAt();

      task.updateRecurring(true, 7);

      const newTimestamp = task.getUpdatedAt();
      expect(newTimestamp.getTime()).toBeGreaterThanOrEqual(
        oldTimestamp.getTime()
      );
    });
  });

  describe('Edge Cases', () => {
    it('should work when task has multiple assignees', () => {
      const task = createTestTask({
        assignments: new Set(['user-1', 'user-2', 'user-3']),
        recurringInterval: null,
      });

      task.updateRecurring(true, 7);

      expect(task.isTaskRecurring()).toBe(true);
    });

    it('should preserve other task properties when updating recurrence', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        title: 'Weekly Report',
        priorityBucket: 5,
        recurringInterval: null,
      });

      task.updateRecurring(true, 7);

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getTitle()).toBe('Weekly Report');
      expect(task.getPriorityBucket()).toBe(5);
    });

    it('should handle very large recurrence intervals (annual)', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        recurringInterval: null,
      });

      task.updateRecurring(true, 365); // Annual

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurringInterval()).toBe(365);
    });
  });
});
