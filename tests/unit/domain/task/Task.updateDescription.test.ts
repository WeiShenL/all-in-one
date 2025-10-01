/**
 * TDD Tests for Task.updateDescription()
 *
 * AC: Assigned Staff member can update task description
 * Note: Description can be empty (unlike title)
 */

import { TaskStatus } from '../../../../src/domain/task/Task';
import { UnauthorizedError } from '../../../../src/domain/task/errors/TaskErrors';
import { createTestTask } from '../../../helpers/taskTestHelpers';

describe('Task - updateDescription()', () => {
  describe('Authorization', () => {
    it('should allow assigned user to update description', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        description: 'Old description',
      });

      task.updateDescription('New description', 'user-1');

      expect(task.getDescription()).toBe('New description');
    });

    it('should throw UnauthorizedError when user is not assigned', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        description: 'Old description',
      });

      expect(() =>
        task.updateDescription('New description', 'user-999')
      ).toThrow(UnauthorizedError);
    });
  });

  describe('Description Validation', () => {
    it('should accept valid non-empty description', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        description: 'Old description',
      });

      task.updateDescription('Valid new description', 'user-1');

      expect(task.getDescription()).toBe('Valid new description');
    });

    it('should accept empty description (unlike title)', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        description: 'Old description',
      });

      task.updateDescription('', 'user-1');

      expect(task.getDescription()).toBe('');
    });

    it('should accept multiline description', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        description: 'Old description',
      });

      const multilineDesc = `Line 1
Line 2
Line 3`;

      task.updateDescription(multilineDesc, 'user-1');

      expect(task.getDescription()).toBe(multilineDesc);
    });

    it('should accept description with special characters and markdown', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        description: 'Old description',
      });

      const markdownDesc = `# Task Details
- Item 1
- Item 2
**Bold text** and *italic*`;

      task.updateDescription(markdownDesc, 'user-1');

      expect(task.getDescription()).toBe(markdownDesc);
    });
  });

  describe('State Updates', () => {
    it('should update description from default to new value', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        description: 'Original description',
      });

      task.updateDescription('Updated description', 'user-1');

      expect(task.getDescription()).toBe('Updated description');
    });

    it('should allow updating description multiple times', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        description: 'Version 1',
      });

      task.updateDescription('Version 2', 'user-1');
      expect(task.getDescription()).toBe('Version 2');

      task.updateDescription('Version 3', 'user-1');
      expect(task.getDescription()).toBe('Version 3');
    });

    it('should update timestamp when description is changed', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        description: 'Old description',
      });

      const oldTimestamp = task.getUpdatedAt();

      task.updateDescription('New description', 'user-1');

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
        description: 'Old description',
      });

      task.updateDescription('Updated by user-3', 'user-3');

      expect(task.getDescription()).toBe('Updated by user-3');
    });

    it('should preserve other task properties when updating description', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Important Task',
        description: 'Old description',
        priorityBucket: 9,
        status: TaskStatus.BLOCKED,
      });

      task.updateDescription('New description', 'user-1');

      expect(task.getDescription()).toBe('New description');
      expect(task.getTitle()).toBe('Important Task');
      expect(task.getPriorityBucket()).toBe(9);
      expect(task.getStatus()).toBe(TaskStatus.BLOCKED);
    });

    it('should accept very long descriptions', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        description: 'Old description',
      });

      const longDescription = 'A'.repeat(5000); // 5000 character description
      task.updateDescription(longDescription, 'user-1');

      expect(task.getDescription()).toBe(longDescription);
    });
  });
});
