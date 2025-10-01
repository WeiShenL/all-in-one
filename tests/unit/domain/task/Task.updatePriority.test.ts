/**
 * Unit Tests for Task.updatePriority()
 *
 * TDD Approach:
 * 1. Write failing tests (RED)
 * 2. Implement method to pass tests (GREEN)
 * 3. Refactor (REFACTOR)
 *
 * Acceptance Criteria:
 * - Assigned Staff member can update task priority (1-10 scale)
 */

import { TaskStatus } from '@/domain/task/Task';
import {
  UnauthorizedError,
  InvalidPriorityError,
} from '@/domain/task/errors/TaskErrors';
import { createTestTask } from '../../../helpers/taskTestHelpers';

describe('Task - updatePriority()', () => {
  describe('Authorization', () => {
    it('should allow assigned user to update priority', () => {
      // Arrange
      const task = createTestTask({
        assignees: new Set(['user-1']),
        priorityBucket: 5,
      });

      // Act
      task.updatePriority(8, 'user-1');

      // Assert
      expect(task.getPriorityBucket()).toBe(8);
    });

    it('should throw UnauthorizedError when user is not assigned', () => {
      // Arrange
      const task = createTestTask({
        assignees: new Set(['user-1']),
        priorityBucket: 5,
      });

      // Act & Assert
      expect(() => {
        task.updatePriority(8, 'user-2'); // user-2 not assigned
      }).toThrow(UnauthorizedError);
    });
  });

  describe('Priority Validation (1-10 scale - Change Document)', () => {
    it('should accept priority = 1 (minimum)', () => {
      // Arrange
      const task = createTestTask({ assignees: new Set(['user-1']) });

      // Act
      task.updatePriority(1, 'user-1');

      // Assert
      expect(task.getPriorityBucket()).toBe(1);
    });

    it('should accept priority = 10 (maximum)', () => {
      // Arrange
      const task = createTestTask({ assignees: new Set(['user-1']) });

      // Act
      task.updatePriority(10, 'user-1');

      // Assert
      expect(task.getPriorityBucket()).toBe(10);
    });

    it('should accept all valid priorities (1-10)', () => {
      // Arrange
      const task = createTestTask({ assignees: new Set(['user-1']) });

      // Act & Assert
      for (let priority = 1; priority <= 10; priority++) {
        task.updatePriority(priority, 'user-1');
        expect(task.getPriorityBucket()).toBe(priority);
      }
    });

    it('should throw InvalidPriorityError when priority < 1', () => {
      // Arrange
      const task = createTestTask({ assignees: new Set(['user-1']) });

      // Act & Assert
      expect(() => {
        task.updatePriority(0, 'user-1');
      }).toThrow(InvalidPriorityError);
    });

    it('should throw InvalidPriorityError when priority > 10', () => {
      // Arrange
      const task = createTestTask({ assignees: new Set(['user-1']) });

      // Act & Assert
      expect(() => {
        task.updatePriority(11, 'user-1');
      }).toThrow(InvalidPriorityError);
    });

    it('should throw InvalidPriorityError for negative priority', () => {
      // Arrange
      const task = createTestTask({ assignees: new Set(['user-1']) });

      // Act & Assert
      expect(() => {
        task.updatePriority(-5, 'user-1');
      }).toThrow(InvalidPriorityError);
    });
  });

  describe('State Updates', () => {
    it('should update priority from default to new value', () => {
      // Arrange
      const task = createTestTask({
        assignees: new Set(['user-1']),
        priorityBucket: 5,
      });

      // Act
      task.updatePriority(9, 'user-1');

      // Assert
      expect(task.getPriorityBucket()).toBe(9);
    });

    it('should allow updating priority multiple times', () => {
      // Arrange
      const task = createTestTask({
        assignees: new Set(['user-1']),
        priorityBucket: 5,
      });

      // Act & Assert
      task.updatePriority(3, 'user-1');
      expect(task.getPriorityBucket()).toBe(3);

      task.updatePriority(7, 'user-1');
      expect(task.getPriorityBucket()).toBe(7);

      task.updatePriority(1, 'user-1');
      expect(task.getPriorityBucket()).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should work when task has multiple assignees', () => {
      // Arrange
      const task = createTestTask({
        assignees: new Set(['user-1', 'user-2', 'user-3']),
        priorityBucket: 5,
      });

      // Act - any assigned user should be able to update
      task.updatePriority(8, 'user-2');

      // Assert
      expect(task.getPriorityBucket()).toBe(8);
    });

    it('should preserve other task properties when updating priority', () => {
      // Arrange
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Important Task',
        description: 'Description',
        status: TaskStatus.IN_PROGRESS,
        priorityBucket: 5,
      });

      // Act
      task.updatePriority(9, 'user-1');

      // Assert - priority changed, everything else same
      expect(task.getPriorityBucket()).toBe(9);
      expect(task.getTitle()).toBe('Important Task');
      expect(task.getDescription()).toBe('Description');
      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);
    });
  });
});
