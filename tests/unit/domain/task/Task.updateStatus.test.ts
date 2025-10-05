/**
 * TDD Tests for Task.updateStatus()
 *
 * Business Rules: can update the task status
 * Statuses: TO_DO, IN_PROGRESS, COMPLETED, BLOCKED
 * Note: Authorization is now handled in TaskService layer
 */

import { TaskStatus } from '../../../../src/domain/task/Task';
import { createTestTask } from '../../../helpers/taskTestHelpers';

describe('Task - updateStatus()', () => {
  // No authorization tests - moved to TaskService tests

  describe('Status Transitions', () => {
    it('should update from TO_DO to IN_PROGRESS', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        status: TaskStatus.TO_DO,
      });

      task.updateStatus(TaskStatus.IN_PROGRESS);

      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should update from IN_PROGRESS to COMPLETED', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        status: TaskStatus.IN_PROGRESS,
      });

      task.updateStatus(TaskStatus.COMPLETED);

      expect(task.getStatus()).toBe(TaskStatus.COMPLETED);
    });

    it('should update from IN_PROGRESS to BLOCKED', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        status: TaskStatus.IN_PROGRESS,
      });

      task.updateStatus(TaskStatus.BLOCKED);

      expect(task.getStatus()).toBe(TaskStatus.BLOCKED);
    });

    it('should update from BLOCKED back to IN_PROGRESS', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        status: TaskStatus.BLOCKED,
      });

      task.updateStatus(TaskStatus.IN_PROGRESS);

      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should update from COMPLETED back to IN_PROGRESS (reopen)', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        status: TaskStatus.COMPLETED,
      });

      task.updateStatus(TaskStatus.IN_PROGRESS);

      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should allow updating to same status (idempotent)', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        status: TaskStatus.IN_PROGRESS,
      });

      task.updateStatus(TaskStatus.IN_PROGRESS);

      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);
    });
  });

  describe('All Status Values', () => {
    it('should accept TO_DO status', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        status: TaskStatus.IN_PROGRESS,
      });

      task.updateStatus(TaskStatus.TO_DO);

      expect(task.getStatus()).toBe(TaskStatus.TO_DO);
    });

    it('should accept IN_PROGRESS status', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        status: TaskStatus.TO_DO,
      });

      task.updateStatus(TaskStatus.IN_PROGRESS);

      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should accept COMPLETED status', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        status: TaskStatus.IN_PROGRESS,
      });

      task.updateStatus(TaskStatus.COMPLETED);

      expect(task.getStatus()).toBe(TaskStatus.COMPLETED);
    });

    it('should accept BLOCKED status', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        status: TaskStatus.TO_DO,
      });

      task.updateStatus(TaskStatus.BLOCKED);

      expect(task.getStatus()).toBe(TaskStatus.BLOCKED);
    });
  });

  describe('State Updates', () => {
    it('should allow updating status multiple times', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        status: TaskStatus.TO_DO,
      });

      task.updateStatus(TaskStatus.IN_PROGRESS);
      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);

      task.updateStatus(TaskStatus.BLOCKED);
      expect(task.getStatus()).toBe(TaskStatus.BLOCKED);

      task.updateStatus(TaskStatus.IN_PROGRESS);
      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);

      task.updateStatus(TaskStatus.COMPLETED);
      expect(task.getStatus()).toBe(TaskStatus.COMPLETED);
    });

    it('should update timestamp when status is changed', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        status: TaskStatus.TO_DO,
      });

      const oldTimestamp = task.getUpdatedAt();

      task.updateStatus(TaskStatus.IN_PROGRESS);

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
        status: TaskStatus.TO_DO,
      });

      task.updateStatus(TaskStatus.IN_PROGRESS);

      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should preserve other task properties when updating status', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Important Task',
        description: 'Critical work',
        status: TaskStatus.TO_DO,
        priorityBucket: 9,
      });

      task.updateStatus(TaskStatus.IN_PROGRESS);

      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);
      expect(task.getTitle()).toBe('Important Task');
      expect(task.getDescription()).toBe('Critical work');
      expect(task.getPriorityBucket()).toBe(9);
    });
  });
});
