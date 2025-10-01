/**
 * TDD Tests for Task Utility Methods
 * Priority 1 - OOP.ts compliance
 *
 * Methods tested:
 * - isOverdue()
 * - complete()
 * - archive()
 */

import { TaskStatus } from '../../../../src/domain/task/Task';
import { UnauthorizedError } from '../../../../src/domain/task/errors/TaskErrors';
import { createTestTask } from '../../../helpers/taskTestHelpers';

describe('Task - Utility Methods', () => {
  describe('isOverdue()', () => {
    it('should return true when task is past due date and not completed', () => {
      const pastDate = new Date('2020-01-01'); // Way in the past
      const task = createTestTask({
        dueDate: pastDate,
        status: TaskStatus.TO_DO,
      });

      expect(task.isOverdue()).toBe(true);
    });

    it('should return false when task is completed even if past due', () => {
      const pastDate = new Date('2020-01-01');
      const task = createTestTask({
        dueDate: pastDate,
        status: TaskStatus.COMPLETED,
      });

      expect(task.isOverdue()).toBe(false);
    });

    it('should return false when task is not yet due', () => {
      const futureDate = new Date('2099-12-31');
      const task = createTestTask({
        dueDate: futureDate,
        status: TaskStatus.IN_PROGRESS,
      });

      expect(task.isOverdue()).toBe(false);
    });

    it('should return true for in-progress overdue tasks', () => {
      const pastDate = new Date('2020-01-01');
      const task = createTestTask({
        dueDate: pastDate,
        status: TaskStatus.IN_PROGRESS,
      });

      expect(task.isOverdue()).toBe(true);
    });

    it('should return true for blocked overdue tasks', () => {
      const pastDate = new Date('2020-01-01');
      const task = createTestTask({
        dueDate: pastDate,
        status: TaskStatus.BLOCKED,
      });

      expect(task.isOverdue()).toBe(true);
    });
  });

  describe('complete()', () => {
    describe('Authorization', () => {
      it('should allow assigned user to complete task', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          status: TaskStatus.IN_PROGRESS,
        });

        task.complete('user-1');

        expect(task.getStatus()).toBe(TaskStatus.COMPLETED);
      });

      it('should throw UnauthorizedError when user is not assigned', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          status: TaskStatus.IN_PROGRESS,
        });

        expect(() => task.complete('user-999')).toThrow(UnauthorizedError);
      });
    });

    describe('Status Changes', () => {
      it('should change status from TO_DO to COMPLETED', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          status: TaskStatus.TO_DO,
        });

        task.complete('user-1');

        expect(task.getStatus()).toBe(TaskStatus.COMPLETED);
      });

      it('should change status from IN_PROGRESS to COMPLETED', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          status: TaskStatus.IN_PROGRESS,
        });

        task.complete('user-1');

        expect(task.getStatus()).toBe(TaskStatus.COMPLETED);
      });

      it('should change status from BLOCKED to COMPLETED', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          status: TaskStatus.BLOCKED,
        });

        task.complete('user-1');

        expect(task.getStatus()).toBe(TaskStatus.COMPLETED);
      });
    });

    describe('Completion Timestamp', () => {
      it('should set completedAt timestamp', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          status: TaskStatus.IN_PROGRESS,
        });

        const beforeComplete = new Date();
        task.complete('user-1');
        const afterComplete = new Date();

        const completedAt = task.getCompletedAt();
        expect(completedAt).toBeDefined();
        expect(completedAt!.getTime()).toBeGreaterThanOrEqual(
          beforeComplete.getTime()
        );
        expect(completedAt!.getTime()).toBeLessThanOrEqual(
          afterComplete.getTime()
        );
      });

      it('should update updatedAt timestamp', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          status: TaskStatus.IN_PROGRESS,
        });

        const oldTimestamp = task.getUpdatedAt();

        task.complete('user-1');

        const newTimestamp = task.getUpdatedAt();
        expect(newTimestamp.getTime()).toBeGreaterThanOrEqual(
          oldTimestamp.getTime()
        );
      });
    });

    describe('Edge Cases', () => {
      it('should allow completing already completed task (idempotent)', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          status: TaskStatus.COMPLETED,
        });

        task.complete('user-1'); // Complete again

        expect(task.getStatus()).toBe(TaskStatus.COMPLETED);
      });

      it('should work with multiple assignees', () => {
        const task = createTestTask({
          assignees: new Set(['user-1', 'user-2', 'user-3']),
          status: TaskStatus.IN_PROGRESS,
        });

        task.complete('user-2'); // Any assignee can complete

        expect(task.getStatus()).toBe(TaskStatus.COMPLETED);
      });

      it('should preserve other task properties', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          title: 'Important Task',
          priorityBucket: 9,
          status: TaskStatus.IN_PROGRESS,
        });

        task.complete('user-1');

        expect(task.getTitle()).toBe('Important Task');
        expect(task.getPriorityBucket()).toBe(9);
      });
    });
  });

  describe('archive()', () => {
    describe('Authorization', () => {
      it('should allow assigned user to archive task', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
        });

        task.archive('user-1');

        expect(task.getIsArchived()).toBe(true);
      });

      it('should throw UnauthorizedError when user is not assigned', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
        });

        expect(() => task.archive('user-999')).toThrow(UnauthorizedError);
      });
    });

    describe('Archive Behavior', () => {
      it('should set isArchived to true', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
        });

        expect(task.getIsArchived()).toBe(false);

        task.archive('user-1');

        expect(task.getIsArchived()).toBe(true);
      });

      it('should allow archiving completed tasks', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          status: TaskStatus.COMPLETED,
        });

        task.archive('user-1');

        expect(task.getIsArchived()).toBe(true);
      });

      it('should allow archiving in-progress tasks', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          status: TaskStatus.IN_PROGRESS,
        });

        task.archive('user-1');

        expect(task.getIsArchived()).toBe(true);
      });

      it('should update updatedAt timestamp', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
        });

        const oldTimestamp = task.getUpdatedAt();

        task.archive('user-1');

        const newTimestamp = task.getUpdatedAt();
        expect(newTimestamp.getTime()).toBeGreaterThanOrEqual(
          oldTimestamp.getTime()
        );
      });
    });

    describe('Edge Cases', () => {
      it('should allow archiving already archived task (idempotent)', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          isArchived: true,
        });

        task.archive('user-1'); // Archive again

        expect(task.getIsArchived()).toBe(true);
      });

      it('should work with multiple assignees', () => {
        const task = createTestTask({
          assignees: new Set(['user-1', 'user-2', 'user-3']),
        });

        task.archive('user-3'); // Any assignee can archive

        expect(task.getIsArchived()).toBe(true);
      });

      it('should preserve status when archiving', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          status: TaskStatus.IN_PROGRESS,
        });

        task.archive('user-1');

        expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);
        expect(task.getIsArchived()).toBe(true);
      });

      it('should preserve other task properties', () => {
        const task = createTestTask({
          assignees: new Set(['user-1']),
          title: 'Important Task',
          priorityBucket: 8,
        });

        task.archive('user-1');

        expect(task.getTitle()).toBe('Important Task');
        expect(task.getPriorityBucket()).toBe(8);
      });
    });
  });
});
