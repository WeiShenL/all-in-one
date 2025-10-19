/**
 * Unit Tests for taskToEvent Utility
 *
 * Testing transformation of Task API response to CalendarEvent presentation model
 * Updated to test startDate logic and new standardized API structure
 */

import { taskToEvent } from '@/app/components/Calendar/utils/taskToEvent';
import { CalendarEvent } from '@/app/components/Calendar/types';

describe('taskToEvent', () => {
  describe('Basic transformation with standardized API structure', () => {
    it('should convert task to calendar event with all required fields', () => {
      const mockTask = {
        id: 'task-123',
        title: 'Complete project proposal',
        description: 'Write and submit proposal',
        dueDate: '2025-10-20T10:00:00.000Z',
        createdAt: '2025-10-15T08:00:00.000Z',
        startDate: null,
        status: 'TO_DO' as const,
        priorityBucket: 5,
        owner: {
          id: 'owner-1',
          name: 'John Manager',
          email: 'john@example.com',
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
          },
          {
            userId: 'user-2',
            user: { id: 'user-2', name: 'Bob', email: 'bob@example.com' },
          },
        ],
        tags: ['urgent', 'frontend'],
        recurringInterval: null,
        parentTaskId: null,
      };

      const event: CalendarEvent = taskToEvent(mockTask);

      expect(event.id).toBe('task-123');
      expect(event.title).toBe('Complete project proposal');
      expect(event.start).toEqual(new Date('2025-10-15T08:00:00.000Z')); // Uses createdAt
      expect(event.end).toEqual(new Date('2025-10-20T10:00:00.000Z')); // Uses dueDate
      expect(event.resource.taskId).toBe('task-123');
      expect(event.resource.status).toBe('TO_DO');
      expect(event.resource.priority).toBe(5);
      expect(event.resource.isCompleted).toBe(false);
      expect(event.resource.isStarted).toBe(false); // No startDate
      expect(event.resource.departmentName).toBe('Engineering');
      expect(event.resource.ownerName).toBe('John Manager');
      expect(event.resource.ownerEmail).toBe('john@example.com');
      expect(event.resource.assigneeDetails).toEqual([
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob', email: 'bob@example.com' },
      ]);
      expect(event.resource.tags).toEqual(['urgent', 'frontend']);
      expect(event.resource.recurringInterval).toBe(null);
    });

    it('should handle task with single assignee', () => {
      const mockTask = {
        id: 'task-456',
        title: 'Review code',
        description: 'Review PR',
        dueDate: '2025-10-21T14:00:00.000Z',
        createdAt: '2025-10-20T09:00:00.000Z',
        startDate: null,
        status: 'IN_PROGRESS' as const,
        priorityBucket: 8,
        owner: {
          id: 'owner-2',
          name: 'Jane Lead',
          email: 'jane@example.com',
        },
        department: {
          id: 'dept-2',
          name: 'Backend',
        },
        assignments: [
          {
            userId: 'user-5',
            user: {
              id: 'user-5',
              name: 'Charlie',
              email: 'charlie@example.com',
            },
          },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
      };

      const event = taskToEvent(mockTask);

      expect(event.resource.assigneeDetails).toEqual([
        { name: 'Charlie', email: 'charlie@example.com' },
      ]);
    });

    it('should handle task with no assignees', () => {
      const mockTask = {
        id: 'task-789',
        title: 'Unassigned task',
        description: 'No one assigned',
        dueDate: '2025-10-22T09:00:00.000Z',
        createdAt: '2025-10-21T10:00:00.000Z',
        startDate: null,
        status: 'TO_DO' as const,
        priorityBucket: 3,
        owner: {
          id: 'owner-3',
          name: 'Sarah Admin',
          email: 'sarah@example.com',
        },
        department: {
          id: 'dept-3',
          name: 'HR',
        },
        assignments: [],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
      };

      const event = taskToEvent(mockTask);

      expect(event.resource.assigneeDetails).toEqual([]);
    });
  });

  describe('startDate handling', () => {
    it('should use createdAt as start when startDate is null (TO_DO task)', () => {
      const mockTask = {
        id: 'task-todo',
        title: 'Todo task',
        description: 'Not started yet',
        dueDate: '2025-10-25T10:00:00.000Z',
        createdAt: '2025-10-20T08:00:00.000Z',
        startDate: null, // Not started
        status: 'TO_DO' as const,
        priorityBucket: 5,
        owner: {
          id: 'owner-1',
          name: 'Manager',
          email: 'manager@example.com',
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: 'Dev', email: 'dev@example.com' },
          },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
      };

      const event = taskToEvent(mockTask);

      expect(event.start).toEqual(new Date('2025-10-20T08:00:00.000Z')); // Uses createdAt
      expect(event.end).toEqual(new Date('2025-10-25T10:00:00.000Z')); // Uses dueDate
      expect(event.resource.isStarted).toBe(false);
    });

    it('should use startDate as start when work has begun (IN_PROGRESS task)', () => {
      const mockTask = {
        id: 'task-progress',
        title: 'In progress task',
        description: 'Work has begun',
        dueDate: '2025-10-25T10:00:00.000Z',
        createdAt: '2025-10-20T08:00:00.000Z',
        startDate: '2025-10-22T09:30:00.000Z', // Work started here
        status: 'IN_PROGRESS' as const,
        priorityBucket: 6,
        owner: {
          id: 'owner-1',
          name: 'Manager',
          email: 'manager@example.com',
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: 'Dev', email: 'dev@example.com' },
          },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
      };

      const event = taskToEvent(mockTask);

      expect(event.start).toEqual(new Date('2025-10-22T09:30:00.000Z')); // Uses startDate
      expect(event.end).toEqual(new Date('2025-10-25T10:00:00.000Z')); // Uses dueDate
      expect(event.resource.isStarted).toBe(true);
    });

    it('should use startDate for COMPLETED tasks', () => {
      const mockTask = {
        id: 'task-completed',
        title: 'Completed task',
        description: 'All done',
        dueDate: '2025-10-15T10:00:00.000Z',
        createdAt: '2025-10-10T08:00:00.000Z',
        startDate: '2025-10-12T09:00:00.000Z', // Work started
        status: 'COMPLETED' as const,
        priorityBucket: 7,
        owner: {
          id: 'owner-1',
          name: 'Manager',
          email: 'manager@example.com',
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: 'Dev', email: 'dev@example.com' },
          },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
      };

      const event = taskToEvent(mockTask);

      expect(event.start).toEqual(new Date('2025-10-12T09:00:00.000Z')); // Uses startDate
      expect(event.resource.isCompleted).toBe(true);
      expect(event.resource.isStarted).toBe(true);
    });

    it('should use startDate for BLOCKED tasks', () => {
      const mockTask = {
        id: 'task-blocked',
        title: 'Blocked task',
        description: 'Waiting for dependencies',
        dueDate: '2025-10-25T10:00:00.000Z',
        createdAt: '2025-10-20T08:00:00.000Z',
        startDate: '2025-10-21T10:00:00.000Z', // Work started before blocking
        status: 'BLOCKED' as const,
        priorityBucket: 9,
        owner: {
          id: 'owner-1',
          name: 'Manager',
          email: 'manager@example.com',
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: 'Dev', email: 'dev@example.com' },
          },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
      };

      const event = taskToEvent(mockTask);

      expect(event.start).toEqual(new Date('2025-10-21T10:00:00.000Z')); // Uses startDate
      expect(event.resource.isStarted).toBe(true);
    });
  });

  describe('Completed status handling', () => {
    it('should mark event as completed when status is COMPLETED', () => {
      const mockTask = {
        id: 'task-completed',
        title: 'Finished task',
        description: 'All done',
        dueDate: '2025-10-15T10:00:00.000Z',
        createdAt: '2025-10-10T08:00:00.000Z',
        startDate: null,
        status: 'COMPLETED' as const,
        priorityBucket: 7,
        owner: {
          id: 'owner-1',
          name: 'Manager',
          email: 'manager@example.com',
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: 'Dev', email: 'dev@example.com' },
          },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
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
        createdAt: '2025-10-20T08:00:00.000Z',
        startDate: null,
        status: 'TO_DO' as const,
        priorityBucket: 5,
        owner: {
          id: 'owner-1',
          name: 'Manager',
          email: 'manager@example.com',
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: 'Dev', email: 'dev@example.com' },
          },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
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
        createdAt: '2025-10-20T08:00:00.000Z',
        startDate: null,
        status: 'IN_PROGRESS' as const,
        priorityBucket: 6,
        owner: {
          id: 'owner-1',
          name: 'Manager',
          email: 'manager@example.com',
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: 'Dev', email: 'dev@example.com' },
          },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
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
        createdAt: '2025-10-20T08:00:00.000Z',
        startDate: null,
        status: 'BLOCKED' as const,
        priorityBucket: 9,
        owner: {
          id: 'owner-1',
          name: 'Manager',
          email: 'manager@example.com',
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: 'Dev', email: 'dev@example.com' },
          },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
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
        createdAt: '2025-12-01T00:00:00.000Z',
        startDate: null,
        status: 'TO_DO' as const,
        priorityBucket: 5,
        owner: {
          id: 'owner-1',
          name: 'Manager',
          email: 'manager@example.com',
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: 'Dev', email: 'dev@example.com' },
          },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
      };

      const event = taskToEvent(mockTask);

      expect(event.start).toEqual(new Date('2025-12-01T00:00:00.000Z'));
      expect(event.end).toEqual(new Date('2025-12-31T23:59:59.999Z'));
    });
  });

  describe('Edge cases', () => {
    it('should handle task with high priority (10)', () => {
      const mockTask = {
        id: 'task-high-priority',
        title: 'Critical task',
        description: 'Urgent',
        dueDate: '2025-10-16T08:00:00.000Z',
        createdAt: '2025-10-15T08:00:00.000Z',
        startDate: null,
        status: 'TO_DO' as const,
        priorityBucket: 10,
        owner: {
          id: 'owner-1',
          name: 'Manager',
          email: 'manager@example.com',
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: 'Dev', email: 'dev@example.com' },
          },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
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
        createdAt: '2025-10-20T08:00:00.000Z',
        startDate: null,
        status: 'TO_DO' as const,
        priorityBucket: 1,
        owner: {
          id: 'owner-1',
          name: 'Manager',
          email: 'manager@example.com',
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: 'Dev', email: 'dev@example.com' },
          },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
      };

      const event = taskToEvent(mockTask);

      expect(event.resource.priority).toBe(1);
    });

    it('should handle null values in owner and assignee details', () => {
      const mockTask = {
        id: 'task-null-details',
        title: 'Task with null details',
        description: 'Testing null handling',
        dueDate: '2025-10-20T10:00:00.000Z',
        createdAt: '2025-10-15T08:00:00.000Z',
        startDate: null,
        status: 'TO_DO' as const,
        priorityBucket: 5,
        owner: {
          id: 'owner-1',
          name: null,
          email: null,
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: null, email: null },
          },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
      };

      const event = taskToEvent(mockTask);

      expect(event.resource.ownerName).toBe('Unknown Owner');
      expect(event.resource.ownerEmail).toBe('noreply@example.com');
      expect(event.resource.assigneeDetails).toEqual([
        { name: 'Unknown', email: 'noreply@example.com' },
      ]);
    });

    it('should handle recurring tasks', () => {
      const mockTask = {
        id: 'task-recurring',
        title: 'Recurring task',
        description: 'Repeats every 7 days',
        dueDate: '2025-10-20T10:00:00.000Z',
        createdAt: '2025-10-15T08:00:00.000Z',
        startDate: null,
        status: 'TO_DO' as const,
        priorityBucket: 5,
        owner: {
          id: 'owner-1',
          name: 'Manager',
          email: 'manager@example.com',
        },
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-1',
            user: { id: 'user-1', name: 'Dev', email: 'dev@example.com' },
          },
        ],
        tags: ['recurring'],
        recurringInterval: 7,
        parentTaskId: null,
      };

      const event = taskToEvent(mockTask);

      expect(event.resource.recurringInterval).toBe(7);
      expect(event.resource.tags).toEqual(['recurring']);
    });

    it('should preserve all task metadata in resource', () => {
      const mockTask = {
        id: 'task-metadata',
        title: 'Metadata task',
        description: 'Testing metadata',
        dueDate: '2025-10-20T10:00:00.000Z',
        createdAt: '2025-10-15T08:00:00.000Z',
        startDate: '2025-10-16T09:00:00.000Z',
        status: 'IN_PROGRESS' as const,
        priorityBucket: 7,
        owner: {
          id: 'owner-1',
          name: 'Manager',
          email: 'manager@example.com',
        },
        department: {
          id: 'dept-engineering',
          name: 'Engineering',
        },
        assignments: [
          {
            userId: 'user-a',
            user: { id: 'user-a', name: 'Alice', email: 'alice@example.com' },
          },
          {
            userId: 'user-b',
            user: { id: 'user-b', name: 'Bob', email: 'bob@example.com' },
          },
          {
            userId: 'user-c',
            user: {
              id: 'user-c',
              name: 'Charlie',
              email: 'charlie@example.com',
            },
          },
        ],
        tags: ['backend', 'api'],
        recurringInterval: null,
        parentTaskId: null,
      };

      const event = taskToEvent(mockTask);

      // Ensure all resource fields are populated
      expect(event.resource).toHaveProperty('taskId');
      expect(event.resource).toHaveProperty('status');
      expect(event.resource).toHaveProperty('priority');
      expect(event.resource).toHaveProperty('isCompleted');
      expect(event.resource).toHaveProperty('isStarted');
      expect(event.resource).toHaveProperty('description');
      expect(event.resource).toHaveProperty('createdAt');
      expect(event.resource).toHaveProperty('departmentName');
      expect(event.resource).toHaveProperty('ownerName');
      expect(event.resource).toHaveProperty('ownerEmail');
      expect(event.resource).toHaveProperty('assigneeDetails');
      expect(event.resource).toHaveProperty('tags');
      expect(event.resource).toHaveProperty('recurringInterval');
    });
  });
});
