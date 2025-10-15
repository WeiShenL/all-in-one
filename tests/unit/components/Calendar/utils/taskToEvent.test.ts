/**
 * Unit Tests for taskToEvent Utility
 *
 * TDD Cycle 1: Task to Calendar Event Transformation
 *
 * Testing transformation of Task domain entity to CalendarEvent presentation model
 */

import { taskToEvent } from '@/app/components/Calendar/utils/taskToEvent';
import { CalendarEvent } from '@/app/components/Calendar/types';

describe('taskToEvent', () => {
  describe('Basic transformation', () => {
    it('should convert task to calendar event with title and date', () => {
      const mockTask = {
        id: 'task-123',
        title: 'Complete project proposal',
        description: 'Write and submit proposal',
        dueDate: '2025-10-20T10:00:00.000Z',
        status: 'TO_DO' as const,
        priority: 5,
        departmentId: 'dept-1',
        assignments: [{ userId: 'user-1' }, { userId: 'user-2' }],
      };

      const event: CalendarEvent = taskToEvent(mockTask);

      expect(event.id).toBe('task-123');
      expect(event.title).toBe('Complete project proposal');
      expect(event.start).toEqual(new Date('2025-10-20T10:00:00.000Z'));
      expect(event.end).toEqual(new Date('2025-10-20T10:00:00.000Z'));
      expect(event.resource.taskId).toBe('task-123');
      expect(event.resource.status).toBe('TO_DO');
      expect(event.resource.priority).toBe(5);
      expect(event.resource.departmentId).toBe('dept-1');
      expect(event.resource.assignees).toEqual(['user-1', 'user-2']);
    });

    it('should handle task with single assignee', () => {
      const mockTask = {
        id: 'task-456',
        title: 'Review code',
        description: 'Review PR',
        dueDate: '2025-10-21T14:00:00.000Z',
        status: 'IN_PROGRESS' as const,
        priority: 8,
        departmentId: 'dept-2',
        assignments: [{ userId: 'user-5' }],
      };

      const event = taskToEvent(mockTask);

      expect(event.resource.assignees).toEqual(['user-5']);
    });

    it('should handle task with no assignees', () => {
      const mockTask = {
        id: 'task-789',
        title: 'Unassigned task',
        description: 'No one assigned',
        dueDate: '2025-10-22T09:00:00.000Z',
        status: 'TO_DO' as const,
        priority: 3,
        departmentId: 'dept-3',
        assignments: [],
      };

      const event = taskToEvent(mockTask);

      expect(event.resource.assignees).toEqual([]);
    });
  });

  describe('Completed status handling', () => {
    it('should mark event as completed when status is COMPLETED', () => {
      const mockTask = {
        id: 'task-completed',
        title: 'Finished task',
        description: 'All done',
        dueDate: '2025-10-15T10:00:00.000Z',
        status: 'COMPLETED' as const,
        priority: 7,
        departmentId: 'dept-1',
        assignments: [{ userId: 'user-1' }],
      };

      const event = taskToEvent(mockTask);

      expect(event.resource.isCompleted).toBe(true);
      expect(event.resource.status).toBe('COMPLETED');
    });

    it('should mark event as not completed when status is TO_DO', () => {
      const mockTask = {
        id: 'task-todo',
        title: 'Todo task',
        description: 'Not done',
        dueDate: '2025-10-25T10:00:00.000Z',
        status: 'TO_DO' as const,
        priority: 5,
        departmentId: 'dept-1',
        assignments: [{ userId: 'user-1' }],
      };

      const event = taskToEvent(mockTask);

      expect(event.resource.isCompleted).toBe(false);
    });

    it('should mark event as not completed when status is IN_PROGRESS', () => {
      const mockTask = {
        id: 'task-progress',
        title: 'In progress task',
        description: 'Working on it',
        dueDate: '2025-10-25T10:00:00.000Z',
        status: 'IN_PROGRESS' as const,
        priority: 6,
        departmentId: 'dept-1',
        assignments: [{ userId: 'user-1' }],
      };

      const event = taskToEvent(mockTask);

      expect(event.resource.isCompleted).toBe(false);
    });

    it('should mark event as not completed when status is BLOCKED', () => {
      const mockTask = {
        id: 'task-blocked',
        title: 'Blocked task',
        description: 'Waiting',
        dueDate: '2025-10-25T10:00:00.000Z',
        status: 'BLOCKED' as const,
        priority: 9,
        departmentId: 'dept-1',
        assignments: [{ userId: 'user-1' }],
      };

      const event = taskToEvent(mockTask);

      expect(event.resource.isCompleted).toBe(false);
    });
  });

  describe('Date handling', () => {
    it('should handle ISO 8601 date strings', () => {
      const mockTask = {
        id: 'task-iso',
        title: 'ISO date task',
        description: 'Testing ISO dates',
        dueDate: '2025-12-31T23:59:59.999Z',
        status: 'TO_DO' as const,
        priority: 5,
        departmentId: 'dept-1',
        assignments: [{ userId: 'user-1' }],
      };

      const event = taskToEvent(mockTask);

      expect(event.start).toEqual(new Date('2025-12-31T23:59:59.999Z'));
      expect(event.end).toEqual(new Date('2025-12-31T23:59:59.999Z'));
    });

    it('should set start and end to the same date (same-day event)', () => {
      const mockTask = {
        id: 'task-same-day',
        title: 'Same day event',
        description: 'All day task',
        dueDate: '2025-10-18T12:00:00.000Z',
        status: 'TO_DO' as const,
        priority: 5,
        departmentId: 'dept-1',
        assignments: [{ userId: 'user-1' }],
      };

      const event = taskToEvent(mockTask);

      expect(event.start.getTime()).toBe(event.end.getTime());
    });
  });

  describe('Edge cases', () => {
    it('should handle task with high priority (10)', () => {
      const mockTask = {
        id: 'task-high-priority',
        title: 'Critical task',
        description: 'Urgent',
        dueDate: '2025-10-16T08:00:00.000Z',
        status: 'TO_DO' as const,
        priority: 10,
        departmentId: 'dept-1',
        assignments: [{ userId: 'user-1' }],
      };

      const event = taskToEvent(mockTask);

      expect(event.resource.priority).toBe(10);
    });

    it('should handle task with low priority (1)', () => {
      const mockTask = {
        id: 'task-low-priority',
        title: 'Low priority task',
        description: 'Not urgent',
        dueDate: '2025-11-01T10:00:00.000Z',
        status: 'TO_DO' as const,
        priority: 1,
        departmentId: 'dept-1',
        assignments: [{ userId: 'user-1' }],
      };

      const event = taskToEvent(mockTask);

      expect(event.resource.priority).toBe(1);
    });

    it('should preserve all task metadata in resource', () => {
      const mockTask = {
        id: 'task-metadata',
        title: 'Metadata task',
        description: 'Testing metadata',
        dueDate: '2025-10-20T10:00:00.000Z',
        status: 'IN_PROGRESS' as const,
        priority: 7,
        departmentId: 'dept-engineering',
        assignments: [
          { userId: 'user-a' },
          { userId: 'user-b' },
          { userId: 'user-c' },
        ],
      };

      const event = taskToEvent(mockTask);

      // Ensure all resource fields are populated
      expect(event.resource).toHaveProperty('taskId');
      expect(event.resource).toHaveProperty('status');
      expect(event.resource).toHaveProperty('priority');
      expect(event.resource).toHaveProperty('isCompleted');
      expect(event.resource).toHaveProperty('departmentId');
      expect(event.resource).toHaveProperty('assignees');
    });
  });
});
