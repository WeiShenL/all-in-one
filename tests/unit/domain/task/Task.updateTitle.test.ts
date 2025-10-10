/**
 * TDD Tests for Task.updateTitle()
 *
 * Business Rules: Title cannot be empty (TM016)
 * Note: Authorization is now handled in TaskService layer
 */

import { TaskStatus } from '../../../../src/domain/task/Task';
import { InvalidTitleError } from '../../../../src/domain/task/errors/TaskErrors';
import { createTestTask } from '../../../helpers/taskTestHelpers';

describe('Task - updateTitle()', () => {
  // No authorization tests - moved to TaskService tests

  describe('Title Validation', () => {
    it('should accept valid non-empty title', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        title: 'Old Title',
      });

      task.updateTitle('Valid New Title');

      expect(task.getTitle()).toBe('Valid New Title');
    });

    it('should throw InvalidTitleError when title is empty string', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        title: 'Old Title',
      });

      expect(() => task.updateTitle('')).toThrow(InvalidTitleError);
    });

    it('should throw InvalidTitleError when title is only whitespace', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        title: 'Old Title',
      });

      expect(() => task.updateTitle('   ')).toThrow(InvalidTitleError);
    });

    it('should accept title with special characters', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        title: 'Old Title',
      });

      task.updateTitle('Task #1: Update API [URGENT]!');

      expect(task.getTitle()).toBe('Task #1: Update API [URGENT]!');
    });

    it('should trim whitespace from title', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        title: 'Old Title',
      });

      task.updateTitle('  New Title  ');

      expect(task.getTitle()).toBe('New Title');
    });
  });

  describe('State Updates', () => {
    it('should update title from default to new value', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        title: 'Original Task',
      });

      task.updateTitle('Updated Task');

      expect(task.getTitle()).toBe('Updated Task');
    });

    it('should allow updating title multiple times', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        title: 'Version 1',
      });

      task.updateTitle('Version 2');
      expect(task.getTitle()).toBe('Version 2');

      task.updateTitle('Version 3');
      expect(task.getTitle()).toBe('Version 3');
    });

    it('should update timestamp when title is changed', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        title: 'Old Title',
      });

      const oldTimestamp = task.getUpdatedAt();

      // Wait a bit to ensure timestamp changes
      task.updateTitle('New Title');

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
        title: 'Old Title',
      });

      // No authorization check in domain layer anymore
      task.updateTitle('Updated title');

      expect(task.getTitle()).toBe('Updated title');
    });

    it('should preserve other task properties when updating title', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        title: 'Old Title',
        description: 'Important description',
        priorityBucket: 7,
        status: TaskStatus.IN_PROGRESS,
      });

      task.updateTitle('New Title');

      expect(task.getTitle()).toBe('New Title');
      expect(task.getDescription()).toBe('Important description');
      expect(task.getPriorityBucket()).toBe(7);
      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should accept very long titles', () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        title: 'Old Title',
      });

      const longTitle = 'A'.repeat(500); // 500 character title
      task.updateTitle(longTitle);

      expect(task.getTitle()).toBe(longTitle);
    });
  });
});
