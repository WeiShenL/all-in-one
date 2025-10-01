/**
 * TDD Tests for Task.updateRecurring()
 *
 * AC: Staff member can update recurring settings (enable/disable, change interval)
 * Requirements: Task recurrence (Change Document Week 6)
 * Constraint: If enabled, must have valid recurrence interval in days (TM057)
 */

import {
  UnauthorizedError,
  InvalidRecurrenceError,
} from '../../../../src/domain/task/errors/TaskErrors';
import { createTestTask } from '../../../helpers/taskTestHelpers';

describe('Task - updateRecurring()', () => {
  describe('Authorization', () => {
    it('should allow assigned user to update recurring settings', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: false,
        recurrenceDays: null,
      });

      task.updateRecurring(true, 7, 'user-1');

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurrenceDays()).toBe(7);
    });

    it('should throw UnauthorizedError when user is not assigned', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: false,
        recurrenceDays: null,
      });

      expect(() => task.updateRecurring(true, 7, 'user-999')).toThrow(
        UnauthorizedError
      );
    });
  });

  describe('Enabling Recurrence', () => {
    it('should enable recurrence with valid days (7 days)', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: false,
        recurrenceDays: null,
      });

      task.updateRecurring(true, 7, 'user-1');

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurrenceDays()).toBe(7);
    });

    it('should enable recurrence with 1 day (minimum)', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: false,
        recurrenceDays: null,
      });

      task.updateRecurring(true, 1, 'user-1');

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurrenceDays()).toBe(1);
    });

    it('should enable recurrence with 30 days (monthly)', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: false,
        recurrenceDays: null,
      });

      task.updateRecurring(true, 30, 'user-1');

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurrenceDays()).toBe(30);
    });

    it('should throw InvalidRecurrenceError when enabling without days (TM057)', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: false,
        recurrenceDays: null,
      });

      expect(() => task.updateRecurring(true, null, 'user-1')).toThrow(
        InvalidRecurrenceError
      );
    });

    it('should throw InvalidRecurrenceError when days <= 0', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: false,
        recurrenceDays: null,
      });

      expect(() => task.updateRecurring(true, 0, 'user-1')).toThrow(
        InvalidRecurrenceError
      );

      expect(() => task.updateRecurring(true, -5, 'user-1')).toThrow(
        InvalidRecurrenceError
      );
    });
  });

  describe('Disabling Recurrence', () => {
    it('should disable recurrence', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: true,
        recurrenceDays: 7,
      });

      task.updateRecurring(false, null, 'user-1');

      expect(task.isTaskRecurring()).toBe(false);
      expect(task.getRecurrenceDays()).toBeNull();
    });

    it('should allow disabling with null days', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: true,
        recurrenceDays: 14,
      });

      task.updateRecurring(false, null, 'user-1');

      expect(task.isTaskRecurring()).toBe(false);
      expect(task.getRecurrenceDays()).toBeNull();
    });

    it('should ignore days parameter when disabling', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: true,
        recurrenceDays: 7,
      });

      // Even if days provided, should ignore when disabling
      task.updateRecurring(false, 999, 'user-1');

      expect(task.isTaskRecurring()).toBe(false);
      expect(task.getRecurrenceDays()).toBeNull();
    });
  });

  describe('Updating Recurrence Interval', () => {
    it('should update recurrence interval from 7 to 14 days', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: true,
        recurrenceDays: 7,
      });

      task.updateRecurring(true, 14, 'user-1');

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurrenceDays()).toBe(14);
    });

    it('should allow multiple updates to recurrence settings', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: false,
        recurrenceDays: null,
      });

      task.updateRecurring(true, 7, 'user-1');
      expect(task.getRecurrenceDays()).toBe(7);

      task.updateRecurring(true, 14, 'user-1');
      expect(task.getRecurrenceDays()).toBe(14);

      task.updateRecurring(false, null, 'user-1');
      expect(task.isTaskRecurring()).toBe(false);
    });
  });

  describe('State Updates', () => {
    it('should update task timestamp when recurrence is changed', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: false,
        recurrenceDays: null,
      });

      const oldTimestamp = task.getUpdatedAt();

      task.updateRecurring(true, 7, 'user-1');

      const newTimestamp = task.getUpdatedAt();
      expect(newTimestamp.getTime()).toBeGreaterThanOrEqual(
        oldTimestamp.getTime()
      );
    });
  });

  describe('Edge Cases', () => {
    it('should work when task has multiple assignees', () => {
      const task = createTestTask({
        assignees: new Set(['user-1', 'user-2', 'user-3']),
        isRecurring: false,
        recurrenceDays: null,
      });

      task.updateRecurring(true, 7, 'user-2');

      expect(task.isTaskRecurring()).toBe(true);
    });

    it('should preserve other task properties when updating recurrence', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Weekly Report',
        priorityBucket: 5,
        isRecurring: false,
        recurrenceDays: null,
      });

      task.updateRecurring(true, 7, 'user-1');

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getTitle()).toBe('Weekly Report');
      expect(task.getPriorityBucket()).toBe(5);
    });

    it('should handle very large recurrence intervals (annual)', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        isRecurring: false,
        recurrenceDays: null,
      });

      task.updateRecurring(true, 365, 'user-1'); // Annual

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurrenceDays()).toBe(365);
    });
  });
});
