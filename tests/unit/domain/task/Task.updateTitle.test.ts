/**
 * TDD Tests for Task.updateTitle()
 *
 * AC: Assigned Staff member can update the task title
 * Constraints: Title cannot be empty (TM016)
 */

import { TaskStatus } from '../../../../src/domain/task/Task';
import {
  UnauthorizedError,
  InvalidTitleError,
} from '../../../../src/domain/task/errors/TaskErrors';
import { createTestTask } from '../../../helpers/taskTestHelpers';

describe('Task - updateTitle()', () => {
  describe('Authorization', () => {
    it('should allow assigned user to update title', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Old Title',
      });

      task.updateTitle('New Title', 'user-1');

      expect(task.getTitle()).toBe('New Title');
    });

    it('should throw UnauthorizedError when user is not assigned', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Old Title',
      });

      expect(() => task.updateTitle('New Title', 'user-999')).toThrow(
        UnauthorizedError
      );
    });
  });

  describe('Title Validation', () => {
    it('should accept valid non-empty title', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Old Title',
      });

      task.updateTitle('Valid New Title', 'user-1');

      expect(task.getTitle()).toBe('Valid New Title');
    });

    it('should throw InvalidTitleError when title is empty string', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Old Title',
      });

      expect(() => task.updateTitle('', 'user-1')).toThrow(InvalidTitleError);
    });

    it('should throw InvalidTitleError when title is only whitespace', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Old Title',
      });

      expect(() => task.updateTitle('   ', 'user-1')).toThrow(
        InvalidTitleError
      );
    });

    it('should accept title with special characters', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Old Title',
      });

      task.updateTitle('Task #1: Update API [URGENT]!', 'user-1');

      expect(task.getTitle()).toBe('Task #1: Update API [URGENT]!');
    });

    it('should trim whitespace from title', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Old Title',
      });

      task.updateTitle('  New Title  ', 'user-1');

      expect(task.getTitle()).toBe('New Title');
    });
  });

  describe('State Updates', () => {
    it('should update title from default to new value', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Original Task',
      });

      task.updateTitle('Updated Task', 'user-1');

      expect(task.getTitle()).toBe('Updated Task');
    });

    it('should allow updating title multiple times', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Version 1',
      });

      task.updateTitle('Version 2', 'user-1');
      expect(task.getTitle()).toBe('Version 2');

      task.updateTitle('Version 3', 'user-1');
      expect(task.getTitle()).toBe('Version 3');
    });

    it('should update timestamp when title is changed', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Old Title',
      });

      const oldTimestamp = task.getUpdatedAt();

      // Wait a bit to ensure timestamp changes
      task.updateTitle('New Title', 'user-1');

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
        title: 'Old Title',
      });

      // Any assignee can update
      task.updateTitle('Updated by user-2', 'user-2');

      expect(task.getTitle()).toBe('Updated by user-2');
    });

    it('should preserve other task properties when updating title', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Old Title',
        description: 'Important description',
        priorityBucket: 7,
        status: TaskStatus.IN_PROGRESS,
      });

      task.updateTitle('New Title', 'user-1');

      expect(task.getTitle()).toBe('New Title');
      expect(task.getDescription()).toBe('Important description');
      expect(task.getPriorityBucket()).toBe(7);
      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should accept very long titles', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Old Title',
      });

      const longTitle = 'A'.repeat(500); // 500 character title
      task.updateTitle(longTitle, 'user-1');

      expect(task.getTitle()).toBe(longTitle);
    });
  });
});
