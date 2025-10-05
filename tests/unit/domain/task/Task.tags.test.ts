/**
 * TDD Tests for Task.addTag() and Task.removeTag()
 *
 * Business Rules: Tags are optional, duplicates handled automatically
 * Note: Authorization is now handled in TaskService layer
 */

import { createTestTask } from '../../../helpers/taskTestHelpers';

describe('Task - Tags', () => {
  // No authorization tests - moved to TaskService tests

  describe('addTag() - Adding Tags', () => {
    it('should add a single tag to empty set', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(),
      });

      task.addTag('bug');

      const tags = task.getTags();
      expect(tags.size).toBe(1);
      expect(tags).toContain('bug');
    });

    it('should add multiple tags sequentially', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(),
      });

      task.addTag('bug');
      task.addTag('urgent');
      task.addTag('backend');

      const tags = task.getTags();
      expect(tags.size).toBe(3);
      expect(tags).toContain('bug');
      expect(tags).toContain('urgent');
      expect(tags).toContain('backend');
    });

    it('should not add duplicate tags', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['urgent']),
      });

      task.addTag('urgent'); // Try to add again

      const tags = task.getTags();
      expect(tags.size).toBe(1); // Still only 1 tag
      expect(tags).toContain('urgent');
    });

    it('should preserve existing tags when adding new one', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['bug', 'urgent']),
      });

      task.addTag('backend');

      const tags = task.getTags();
      expect(tags.size).toBe(3);
      expect(tags).toContain('bug');
      expect(tags).toContain('urgent');
      expect(tags).toContain('backend');
    });

    it('should update timestamp when tag is added', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(),
      });

      const oldTimestamp = task.getUpdatedAt();

      task.addTag('new-tag');

      const newTimestamp = task.getUpdatedAt();
      expect(newTimestamp.getTime()).toBeGreaterThanOrEqual(
        oldTimestamp.getTime()
      );
    });
  });

  // No authorization tests for removeTag - moved to TaskService tests

  describe('removeTag() - Removing Tags', () => {
    it('should remove an existing tag', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['bug', 'urgent', 'backend']),
      });

      task.removeTag('urgent');

      const tags = task.getTags();
      expect(tags.size).toBe(2);
      expect(tags).not.toContain('urgent');
      expect(tags).toContain('bug');
      expect(tags).toContain('backend');
    });

    it('should handle removing non-existent tag gracefully', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['bug']),
      });

      task.removeTag('nonexistent'); // Should not throw

      const tags = task.getTags();
      expect(tags.size).toBe(1);
      expect(tags).toContain('bug');
    });

    it('should remove all tags individually', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['bug', 'urgent']),
      });

      task.removeTag('bug');
      task.removeTag('urgent');

      const tags = task.getTags();
      expect(tags.size).toBe(0);
    });

    it('should update timestamp when tag is removed', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['urgent']),
      });

      const oldTimestamp = task.getUpdatedAt();

      task.removeTag('urgent');

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
        tags: new Set(['bug']),
      });

      task.addTag('urgent');

      expect(task.getTags()).toContain('urgent');
    });

    it('should preserve other task properties when managing tags', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Important Task',
        tags: new Set(['bug']),
        priorityBucket: 7,
      });

      task.addTag('urgent');

      expect(task.getTags()).toContain('urgent');
      expect(task.getTitle()).toBe('Important Task');
      expect(task.getPriorityBucket()).toBe(7);
    });
  });
});
