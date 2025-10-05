/**
 * TDD Tests for Task.updateDeadline()
 *
 * Business Rules: can update the task deadline
 * Constraint: If subtask, deadline must be <= parent deadline (DST014)
 * Note: Authorization is now handled in TaskService layer
 */

import { TaskStatus } from '../../../../src/domain/task/Task';
import { InvalidSubtaskDeadlineError } from '../../../../src/domain/task/errors/TaskErrors';
import { createTestTask } from '../../../helpers/taskTestHelpers';

describe('Task - updateDeadline()', () => {
  // No authorization tests - moved to TaskService tests

  describe('Deadline Validation - Regular Tasks', () => {
    it('should accept future deadline', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        dueDate: new Date('2025-01-15'),
        parentTaskId: null, // Regular task, not subtask
      });

      const futureDate = new Date('2026-12-31');
      task.updateDeadline(futureDate);

      expect(task.getDueDate()).toEqual(futureDate);
    });

    it('should accept past deadline (no validation on past dates)', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        dueDate: new Date('2025-06-01'),
        parentTaskId: null,
      });

      const pastDate = new Date('2020-01-01');
      task.updateDeadline(pastDate);

      expect(task.getDueDate()).toEqual(pastDate);
    });

    it('should accept same day deadline', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        dueDate: new Date('2025-06-01'),
        parentTaskId: null,
      });

      const sameDate = new Date('2025-06-01');
      task.updateDeadline(sameDate);

      expect(task.getDueDate()).toEqual(sameDate);
    });
  });

  describe('Deadline Validation - Subtasks (DST014)', () => {
    it('should accept subtask deadline equal to parent deadline', () => {
      const parentDeadline = new Date('2025-12-31');
      const task = createTestTask({
        assignees: new Set(['user-1']),
        dueDate: new Date('2025-11-01'),
        parentTaskId: 'parent-123',
      });

      // Mock getParentDeadline to return parent deadline
      // For now, we'll pass parent deadline as context
      // NOTE: This will need Repository in real implementation
      task.updateDeadline(parentDeadline, parentDeadline);

      expect(task.getDueDate()).toEqual(parentDeadline);
    });

    it('should accept subtask deadline before parent deadline', () => {
      const parentDeadline = new Date('2025-12-31');
      const subtaskDeadline = new Date('2025-11-15');
      const task = createTestTask({
        assignees: new Set(['user-1']),
        dueDate: new Date('2025-10-01'),
        parentTaskId: 'parent-123',
      });

      task.updateDeadline(subtaskDeadline, parentDeadline);

      expect(task.getDueDate()).toEqual(subtaskDeadline);
    });

    it('should throw InvalidSubtaskDeadlineError when subtask deadline after parent', () => {
      const parentDeadline = new Date('2025-12-31');
      const invalidDeadline = new Date('2026-01-15'); // After parent!

      const task = createTestTask({
        assignees: new Set(['user-1']),
        dueDate: new Date('2025-11-01'),
        parentTaskId: 'parent-123',
      });

      expect(() =>
        task.updateDeadline(invalidDeadline, parentDeadline)
      ).toThrow(InvalidSubtaskDeadlineError);
    });
  });

  describe('State Updates', () => {
    it('should update deadline from default to new value', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        dueDate: new Date('2025-06-01'),
      });

      const newDeadline = new Date('2025-09-15');
      task.updateDeadline(newDeadline);

      expect(task.getDueDate()).toEqual(newDeadline);
    });

    it('should allow updating deadline multiple times', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        dueDate: new Date('2025-01-01'),
      });

      const deadline1 = new Date('2025-02-01');
      task.updateDeadline(deadline1);
      expect(task.getDueDate()).toEqual(deadline1);

      const deadline2 = new Date('2025-03-01');
      task.updateDeadline(deadline2);
      expect(task.getDueDate()).toEqual(deadline2);
    });

    it('should update timestamp when deadline is changed', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        dueDate: new Date('2025-06-01'),
      });

      const oldTimestamp = task.getUpdatedAt();

      const newDeadline = new Date('2025-08-01');
      task.updateDeadline(newDeadline);

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
        dueDate: new Date('2025-06-01'),
      });

      const newDeadline = new Date('2025-07-15');
      task.updateDeadline(newDeadline);

      expect(task.getDueDate()).toEqual(newDeadline);
    });

    it('should preserve other task properties when updating deadline', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Important Task',
        description: 'Critical work',
        dueDate: new Date('2025-06-01'),
        priorityBucket: 8,
        status: TaskStatus.IN_PROGRESS,
      });

      const newDeadline = new Date('2025-08-01');
      task.updateDeadline(newDeadline);

      expect(task.getDueDate()).toEqual(newDeadline);
      expect(task.getTitle()).toBe('Important Task');
      expect(task.getDescription()).toBe('Critical work');
      expect(task.getPriorityBucket()).toBe(8);
      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);
    });
  });
});
