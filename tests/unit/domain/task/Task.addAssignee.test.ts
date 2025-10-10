/**
 * TDD Tests for Task.addAssignee()
 *
 * AC: Assigned Staff member can add assignees, max 5 only (TM023)
 * Note: Cannot remove assignees per TM015
 */

import {
  UnauthorizedError,
  MaxAssigneesReachedError,
} from '../../../../src/domain/task/errors/TaskErrors';
import { createTestTask } from '../../../helpers/taskTestHelpers';

describe('Task - addAssignee()', () => {
  describe('Authorization', () => {
    it('should allow assigned user to add new assignee', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      task.addAssignee('user-2', 'user-1');

      const assignees = task.getAssignees();
      expect(assignees.size).toBe(2);
      expect(assignees).toContain('user-1');
      expect(assignees).toContain('user-2');
    });

    it('should throw UnauthorizedError when actor is not assigned', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      expect(() => task.addAssignee('user-2', 'user-999')).toThrow(
        UnauthorizedError
      );
    });
  });

  describe('Adding Assignees', () => {
    it('should add a new assignee to task with 1 assignee', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      task.addAssignee('user-2', 'user-1');

      const assignees = task.getAssignees();
      expect(assignees.size).toBe(2);
      expect(assignees).toContain('user-2');
    });

    it('should add multiple assignees up to 5 total', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      task.addAssignee('user-2', 'user-1');
      task.addAssignee('user-3', 'user-1');
      task.addAssignee('user-4', 'user-1');
      task.addAssignee('user-5', 'user-1');

      const assignees = task.getAssignees();
      expect(assignees.size).toBe(5);
    });

    it('should not add duplicate assignee', () => {
      const task = createTestTask({
        assignments: new Set(['user-1', 'user-2']),
      });

      task.addAssignee('user-2', 'user-1'); // Try to add existing

      const assignees = task.getAssignees();
      expect(assignees.size).toBe(2); // Still only 2
    });

    it('should preserve existing assignees when adding new one', () => {
      const task = createTestTask({
        assignments: new Set(['user-1', 'user-2']),
      });

      task.addAssignee('user-3', 'user-1');

      const assignees = task.getAssignees();
      expect(assignees).toContain('user-1');
      expect(assignees).toContain('user-2');
      expect(assignees).toContain('user-3');
    });
  });

  describe('Max 5 Assignees Constraint (TM023)', () => {
    it('should throw MaxAssigneesReachedError when trying to add 6th assignee', () => {
      const task = createTestTask({
        assignments: new Set([
          'user-1',
          'user-2',
          'user-3',
          'user-4',
          'user-5',
        ]),
      });

      expect(() => task.addAssignee('user-6', 'user-1')).toThrow(
        MaxAssigneesReachedError
      );
    });

    it('should accept 5th assignee (boundary)', () => {
      const task = createTestTask({
        assignments: new Set(['user-1', 'user-2', 'user-3', 'user-4']),
      });

      task.addAssignee('user-5', 'user-1'); // Should succeed

      expect(task.getAssignees().size).toBe(5);
    });

    it('should not increase count when adding duplicate at max capacity', () => {
      const task = createTestTask({
        assignments: new Set([
          'user-1',
          'user-2',
          'user-3',
          'user-4',
          'user-5',
        ]),
      });

      task.addAssignee('user-3', 'user-1'); // Re-add existing (should be no-op)

      expect(task.getAssignees().size).toBe(5); // Still 5
    });
  });

  describe('State Updates', () => {
    it('should update timestamp when assignee is added', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const oldTimestamp = task.getUpdatedAt();

      task.addAssignee('user-2', 'user-1');

      const newTimestamp = task.getUpdatedAt();
      expect(newTimestamp.getTime()).toBeGreaterThanOrEqual(
        oldTimestamp.getTime()
      );
    });
  });

  describe('Edge Cases', () => {
    it('should allow any current assignee to add new assignees', () => {
      const task = createTestTask({
        assignments: new Set(['user-1', 'user-2', 'user-3']),
      });

      // user-2 (not creator) can add user-4
      task.addAssignee('user-4', 'user-2');

      expect(task.getAssignees()).toContain('user-4');
    });

    it('should preserve other task properties when adding assignee', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        title: 'Important Task',
        priorityBucket: 8,
        tags: new Set(['urgent']),
      });

      task.addAssignee('user-2', 'user-1');

      expect(task.getAssignees()).toContain('user-2');
      expect(task.getTitle()).toBe('Important Task');
      expect(task.getPriorityBucket()).toBe(8);
      expect(task.getTags()).toContain('urgent');
    });
  });
});
