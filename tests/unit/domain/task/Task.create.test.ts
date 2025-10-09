/**
 * Unit Tests for Task Domain Model - create() Factory Method
 * Testing Domain-Level Business Logic for Task Creation - SCRUM-12
 *
 * DDD Layer: DOMAIN
 * Tests: Task.create() factory with all business rule validations
 *
 * Acceptance Criteria Tested:
 * - TM016: Mandatory fields (title, description, priority 1-10, deadline, assignees)
 * - TM023: Max 5 assignees
 * - Recurring interval validation
 * - Default status TO_DO
 * - Title trimming and validation
 */

import { Task, TaskStatus } from '@/domain/task/Task';
import {
  InvalidTitleError,
  InvalidPriorityError,
  MaxAssigneesReachedError,
  InvalidRecurrenceError,
} from '@/domain/task/errors/TaskErrors';

describe('Task.create() - Domain Factory Method', () => {
  const validTaskData = {
    title: 'Implement Login Feature',
    description: 'Create login functionality with email and password',
    priorityBucket: 5,
    dueDate: new Date('2025-12-31'),
    status: TaskStatus.TO_DO,
    ownerId: 'user-123',
    departmentId: 'dept-456',
    projectId: null,
    parentTaskId: null,
    recurringInterval: null,
    isArchived: false,
    assignments: new Set<string>(['assignee-1']),
    tags: new Set<string>(),
  };

  describe('Successful Task Creation', () => {
    it('should create task with all valid mandatory fields', () => {
      const task = Task.create(validTaskData);

      expect(task).toBeDefined();
      expect(task.getTitle()).toBe('Implement Login Feature');
      expect(task.getDescription()).toBe(
        'Create login functionality with email and password'
      );
      expect(task.getPriorityBucket()).toBe(5);
      expect(task.getStatus()).toBe(TaskStatus.TO_DO);
      expect(task.getOwnerId()).toBe('user-123');
      expect(task.getDepartmentId()).toBe('dept-456');
      expect(task.getAssignees()).toEqual(new Set(['assignee-1']));
      expect(task.getId()).toBeDefined();
      expect(task.getCreatedAt()).toBeInstanceOf(Date);
      expect(task.getUpdatedAt()).toBeInstanceOf(Date);
    });

    it('should trim whitespace from title', () => {
      const task = Task.create({
        ...validTaskData,
        title: '  Spaced Title  ',
      });

      expect(task.getTitle()).toBe('Spaced Title');
    });

    it('should set default status to TO_DO', () => {
      const task = Task.create(validTaskData);

      expect(task.getStatus()).toBe(TaskStatus.TO_DO);
    });

    it('should generate unique UUID for task ID', () => {
      const task1 = Task.create(validTaskData);
      const task2 = Task.create(validTaskData);

      expect(task1.getId()).not.toBe(task2.getId());
      expect(task1.getId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should set isArchived to false by default', () => {
      const task = Task.create(validTaskData);

      expect(task.getIsArchived()).toBe(false);
    });
  });

  describe('TM016: Title Validation', () => {
    it('should reject empty title', () => {
      expect(() =>
        Task.create({
          ...validTaskData,
          title: '',
        })
      ).toThrow(InvalidTitleError);
    });

    it('should reject whitespace-only title', () => {
      expect(() =>
        Task.create({
          ...validTaskData,
          title: '   ',
        })
      ).toThrow(InvalidTitleError);
    });

    it('should accept title with length 1', () => {
      const task = Task.create({
        ...validTaskData,
        title: 'A',
      });

      expect(task.getTitle()).toBe('A');
    });
  });

  describe('TM016: Priority Validation (1-10 scale)', () => {
    it('should accept priority 1 (minimum)', () => {
      const task = Task.create({
        ...validTaskData,
        priorityBucket: 1,
      });

      expect(task.getPriorityBucket()).toBe(1);
    });

    it('should accept priority 10 (maximum)', () => {
      const task = Task.create({
        ...validTaskData,
        priorityBucket: 10,
      });

      expect(task.getPriorityBucket()).toBe(10);
    });

    it('should accept priority 5 (medium)', () => {
      const task = Task.create({
        ...validTaskData,
        priorityBucket: 5,
      });

      expect(task.getPriorityBucket()).toBe(5);
    });

    it('should reject priority 0 (below minimum)', () => {
      expect(() =>
        Task.create({
          ...validTaskData,
          priorityBucket: 0,
        })
      ).toThrow(InvalidPriorityError);
    });

    it('should reject priority 11 (above maximum)', () => {
      expect(() =>
        Task.create({
          ...validTaskData,
          priorityBucket: 11,
        })
      ).toThrow(InvalidPriorityError);
    });

    it('should reject negative priority', () => {
      expect(() =>
        Task.create({
          ...validTaskData,
          priorityBucket: -1,
        })
      ).toThrow(InvalidPriorityError);
    });
  });

  describe('TM016 & TM023: Assignee Validation', () => {
    it('should accept exactly 1 assignee (minimum)', () => {
      const task = Task.create({
        ...validTaskData,
        assignments: new Set(['user-1']),
      });

      expect(task.getAssignees().size).toBe(1);
      expect(task.getAssignees()).toEqual(new Set(['user-1']));
    });

    it('should accept exactly 5 assignees (maximum - TM023)', () => {
      const task = Task.create({
        ...validTaskData,
        assignments: new Set([
          'user-1',
          'user-2',
          'user-3',
          'user-4',
          'user-5',
        ]),
      });

      expect(task.getAssignees().size).toBe(5);
    });

    it('should reject 0 assignees (TM016)', () => {
      expect(() =>
        Task.create({
          ...validTaskData,
          assignments: new Set(),
        })
      ).toThrow('Task must have at least 1 assignee');
    });

    it('should reject more than 5 assignees (TM023)', () => {
      expect(() =>
        Task.create({
          ...validTaskData,
          assignments: new Set([
            'user-1',
            'user-2',
            'user-3',
            'user-4',
            'user-5',
            'user-6',
          ]),
        })
      ).toThrow(MaxAssigneesReachedError);
    });
  });

  describe('Recurring Task Validation', () => {
    it('should create recurring task with valid interval', () => {
      const task = Task.create({
        ...validTaskData,
        recurringInterval: 7,
      });

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurringInterval()).toBe(7);
    });

    it('should create non-recurring task', () => {
      const task = Task.create({
        ...validTaskData,
        recurringInterval: null,
      });

      expect(task.isTaskRecurring()).toBe(false);
      expect(task.getRecurringInterval()).toBeNull();
    });

    it('should reject recurring task with 0 interval', () => {
      expect(() =>
        Task.create({
          ...validTaskData,
          recurringInterval: 0,
        })
      ).toThrow(InvalidRecurrenceError);
    });

    it('should reject recurring task with negative interval', () => {
      expect(() =>
        Task.create({
          ...validTaskData,
          recurringInterval: -7,
        })
      ).toThrow(InvalidRecurrenceError);
    });

    it('should accept recurring task with interval 1 (minimum)', () => {
      const task = Task.create({
        ...validTaskData,
        recurringInterval: 1,
      });

      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurringInterval()).toBe(1);
    });
  });

  describe('Optional Fields', () => {
    it('should create task with project ID', () => {
      const task = Task.create({
        ...validTaskData,
        projectId: 'project-789',
      });

      expect(task.getProjectId()).toBe('project-789');
    });

    it('should create task without project ID', () => {
      const task = Task.create({
        ...validTaskData,
        projectId: null,
      });

      expect(task.getProjectId()).toBeNull();
    });

    it('should create task with parent task ID (subtask)', () => {
      const task = Task.create({
        ...validTaskData,
        parentTaskId: 'parent-task-123',
      });

      expect(task.getParentTaskId()).toBe('parent-task-123');
      expect(task.isSubtask()).toBe(true);
    });

    it('should create task without parent task ID', () => {
      const task = Task.create({
        ...validTaskData,
        parentTaskId: null,
      });

      expect(task.getParentTaskId()).toBeNull();
      expect(task.isSubtask()).toBe(false);
    });

    it('should create task with tags', () => {
      const task = Task.create({
        ...validTaskData,
        tags: new Set(['urgent', 'frontend', 'bug']),
      });

      expect(task.getTags().size).toBe(3);
      expect(task.getTags()).toEqual(new Set(['urgent', 'frontend', 'bug']));
    });

    it('should create task without tags', () => {
      const task = Task.create({
        ...validTaskData,
        tags: new Set(),
      });

      expect(task.getTags().size).toBe(0);
    });
  });

  describe('Timestamps', () => {
    it('should set createdAt and updatedAt to same time', () => {
      const beforeCreate = Date.now();
      const task = Task.create(validTaskData);
      const afterCreate = Date.now();

      const createdAt = task.getCreatedAt().getTime();
      const updatedAt = task.getUpdatedAt().getTime();

      expect(createdAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(createdAt).toBeLessThanOrEqual(afterCreate);
      expect(updatedAt).toBe(createdAt);
    });
  });

  describe('Domain Invariants', () => {
    it('should maintain all required fields after creation', () => {
      const task = Task.create(validTaskData);

      // All getters should return valid values
      expect(task.getId()).toBeTruthy();
      expect(task.getTitle()).toBeTruthy();
      expect(task.getDescription()).toBeTruthy();
      expect(task.getPriorityBucket()).toBeGreaterThanOrEqual(1);
      expect(task.getPriorityBucket()).toBeLessThanOrEqual(10);
      expect(task.getDueDate()).toBeInstanceOf(Date);
      expect(task.getStatus()).toBeTruthy();
      expect(task.getOwnerId()).toBeTruthy();
      expect(task.getDepartmentId()).toBeTruthy();
      expect(task.getAssignees().size).toBeGreaterThanOrEqual(1);
      expect(task.getAssignees().size).toBeLessThanOrEqual(5);
      expect(task.getIsArchived()).toBe(false);
    });

    it('should validate business rules on creation', () => {
      // This test ensures that Task.create() performs validation
      // and throws appropriate domain errors for invalid data

      const invalidCases = [
        {
          name: 'empty title',
          data: { ...validTaskData, title: '' },
          error: InvalidTitleError,
        },
        {
          name: 'priority too low',
          data: { ...validTaskData, priorityBucket: 0 },
          error: InvalidPriorityError,
        },
        {
          name: 'priority too high',
          data: { ...validTaskData, priorityBucket: 11 },
          error: InvalidPriorityError,
        },
        {
          name: 'no assignees',
          data: { ...validTaskData, assignments: new Set() },
          error: Error,
        },
        {
          name: 'too many assignees',
          data: {
            ...validTaskData,
            assignments: new Set(['u1', 'u2', 'u3', 'u4', 'u5', 'u6']),
          },
          error: MaxAssigneesReachedError,
        },
        {
          name: 'recurring with invalid interval (0 days)',
          data: { ...validTaskData, recurringInterval: 0 },
          error: InvalidRecurrenceError,
        },
        {
          name: 'recurring with negative interval',
          data: { ...validTaskData, recurringInterval: -5 },
          error: InvalidRecurrenceError,
        },
      ];

      invalidCases.forEach(({ data, error }) => {
        expect(() => Task.create(data)).toThrow(error);
      });
    });
  });
});
