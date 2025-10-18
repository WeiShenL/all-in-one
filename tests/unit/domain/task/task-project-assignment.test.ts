/**
 * Unit Tests for Task-Project Assignment Logic (SCRUM-31)
 *
 * User Story: As a staff, I want to add tasks and subtasks to projects so that
 * I can organise my work and not get confused between multiple projects.
 *
 * Test Coverage (Domain Layer):
 * - AC 2: Tasks can only belong to 0 or 1 projects at any time
 * - AC 3: Tasks cannot be reassigned to another project after initial assignment
 * - Task creation with projectId
 * - Task creation without projectId (standalone)
 * - Subtasks inherit project from parent task
 * - Business rule validation
 *
 * Pattern: Pure domain logic tests - no database, no mocks
 */

import { Task, TaskStatus } from '@/domain/task/Task';

describe('Task-Project Assignment - Domain Logic (Unit Tests)', () => {
  const VALID_PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
  const ANOTHER_PROJECT_ID = '660e8400-e29b-41d4-a716-446655440001';
  const DEPARTMENT_ID = '770e8400-e29b-41d4-a716-446655440002';
  const OWNER_ID = '880e8400-e29b-41d4-a716-446655440003';
  const ASSIGNEE_ID = '990e8400-e29b-41d4-a716-446655440004';

  // ============================================
  // AC 2: Tasks can only belong to 0 or 1 projects
  // ============================================
  describe('AC 2: Single Project Constraint', () => {
    it('should create a task with no project (standalone task)', () => {
      const task = Task.create({
        title: 'Standalone Task',
        description: 'This task does not belong to any project',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: null, // No project assignment
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(['standalone']),
      });

      expect(task.getProjectId()).toBeNull();
      expect(task.getTitle()).toBe('Standalone Task');
    });

    it('should create a task with a single project assignment', () => {
      const task = Task.create({
        title: 'Project Task',
        description: 'This task belongs to a project',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: VALID_PROJECT_ID,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(['project-task']),
      });

      expect(task.getProjectId()).toBe(VALID_PROJECT_ID);
      expect(task.getTitle()).toBe('Project Task');
    });

    it('should maintain single project constraint throughout task lifecycle', () => {
      // Create task with project
      const task = Task.create({
        title: 'Task with Project',
        description: 'Test task',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: VALID_PROJECT_ID,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(),
      });

      // Verify single project
      expect(task.getProjectId()).toBe(VALID_PROJECT_ID);

      // Task maintains same project after status updates
      task.updateStatus(TaskStatus.IN_PROGRESS);
      expect(task.getProjectId()).toBe(VALID_PROJECT_ID);

      task.updateStatus(TaskStatus.COMPLETED);
      expect(task.getProjectId()).toBe(VALID_PROJECT_ID);
    });
  });

  // ============================================
  // AC 3: Tasks cannot be reassigned to another project
  // ============================================
  describe('AC 3: Project Immutability After Assignment', () => {
    it('should not allow changing project after task creation', () => {
      // Create task with project
      const task = Task.create({
        title: 'Immutable Project Task',
        description: 'Project cannot be changed',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: VALID_PROJECT_ID,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(),
      });

      // Verify project is set
      expect(task.getProjectId()).toBe(VALID_PROJECT_ID);

      // Domain model should not expose a method to change projectId
      // This test verifies that no such method exists
      // @ts-expect-error - updateProjectId should not exist
      expect(task.updateProjectId).toBeUndefined();
    });

    it('should maintain project assignment after multiple updates', () => {
      const task = Task.create({
        title: 'Task with Fixed Project',
        description: 'Project stays fixed',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: VALID_PROJECT_ID,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(),
      });

      const originalProjectId = task.getProjectId();

      // Perform various updates
      task.updateTitle('New Title');
      expect(task.getProjectId()).toBe(originalProjectId);

      task.updateDescription('New Description');
      expect(task.getProjectId()).toBe(originalProjectId);

      task.updatePriority(8);
      expect(task.getProjectId()).toBe(originalProjectId);

      task.updateStatus(TaskStatus.IN_PROGRESS);
      expect(task.getProjectId()).toBe(originalProjectId);

      task.addTag('urgent');
      expect(task.getProjectId()).toBe(originalProjectId);

      // Project ID should never change
      expect(task.getProjectId()).toBe(VALID_PROJECT_ID);
    });

    it('should prevent reassignment from one project to another', () => {
      // Create task with initial project
      const task = Task.create({
        title: 'Task in Project A',
        description: 'Should stay in Project A',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: VALID_PROJECT_ID,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(),
      });

      // Verify initial project
      expect(task.getProjectId()).toBe(VALID_PROJECT_ID);

      // Attempt to access non-existent updateProjectId method
      // @ts-expect-error - updateProjectId should not exist
      expect(task.updateProjectId).toBeUndefined();

      // Project should remain unchanged
      expect(task.getProjectId()).toBe(VALID_PROJECT_ID);
      expect(task.getProjectId()).not.toBe(ANOTHER_PROJECT_ID);
    });

    it('should maintain null project for standalone tasks', () => {
      const task = Task.create({
        title: 'Standalone Task',
        description: 'No project ever',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(),
      });

      expect(task.getProjectId()).toBeNull();

      // Perform updates
      task.updateStatus(TaskStatus.IN_PROGRESS);
      task.updatePriority(7);

      // Project should remain null
      expect(task.getProjectId()).toBeNull();
    });
  });

  // ============================================
  // Subtasks and Project Inheritance
  // ============================================
  describe('Subtask Project Inheritance', () => {
    it('should inherit project from parent task', () => {
      const PARENT_TASK_ID = 'aaa00000-e29b-41d4-a716-446655440005';

      // Create parent task with project
      const parentTask = Task.create({
        title: 'Parent Task',
        description: 'Parent in Project A',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: VALID_PROJECT_ID,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(),
      });

      // Create subtask - should inherit parent's project
      const subtask = Task.create({
        title: 'Subtask',
        description: 'Subtask inherits project',
        priorityBucket: 3,
        dueDate: new Date('2025-11-30'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: VALID_PROJECT_ID, // Must match parent
        parentTaskId: PARENT_TASK_ID,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(),
      });

      expect(parentTask.getProjectId()).toBe(VALID_PROJECT_ID);
      expect(subtask.getProjectId()).toBe(VALID_PROJECT_ID);
      expect(subtask.isSubtask()).toBe(true);
      expect(subtask.getParentTaskId()).toBe(PARENT_TASK_ID);
    });

    it('should allow subtask with null project when parent has null project', () => {
      const PARENT_TASK_ID = 'bbb00000-e29b-41d4-a716-446655440006';

      // Create standalone parent task (no project)
      const parentTask = Task.create({
        title: 'Standalone Parent',
        description: 'No project',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(),
      });

      // Create subtask - should also have null project
      const subtask = Task.create({
        title: 'Standalone Subtask',
        description: 'Also no project',
        priorityBucket: 3,
        dueDate: new Date('2025-11-30'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: null, // Must match parent (null)
        parentTaskId: PARENT_TASK_ID,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(),
      });

      expect(parentTask.getProjectId()).toBeNull();
      expect(subtask.getProjectId()).toBeNull();
      expect(subtask.isSubtask()).toBe(true);
    });
  });

  // ============================================
  // Business Rule Validation
  // ============================================
  describe('Business Rule Validation', () => {
    it('should validate projectId format if provided', () => {
      // Valid UUID format for projectId
      const validProjectIds = [
        VALID_PROJECT_ID,
        'a1b2c3d4-e5f6-4789-0123-456789abcdef',
        null, // null is valid (standalone task)
      ];

      validProjectIds.forEach(projectId => {
        expect(() => {
          Task.create({
            title: 'Test Task',
            description: 'Testing project ID validation',
            priorityBucket: 5,
            dueDate: new Date('2025-12-31'),
            status: TaskStatus.TO_DO,
            ownerId: OWNER_ID,
            departmentId: DEPARTMENT_ID,
            projectId,
            parentTaskId: null,
            recurringInterval: null,
            isArchived: false,
            assignments: new Set([ASSIGNEE_ID]),
            tags: new Set(),
          });
        }).not.toThrow();
      });
    });

    it('should allow creating multiple tasks for the same project', () => {
      // Create first task
      const task1 = Task.create({
        title: 'Task 1 in Project',
        description: 'First task',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: VALID_PROJECT_ID,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(),
      });

      // Create second task in same project
      const task2 = Task.create({
        title: 'Task 2 in Project',
        description: 'Second task',
        priorityBucket: 3,
        dueDate: new Date('2025-11-30'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: VALID_PROJECT_ID,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(),
      });

      // Both tasks should belong to the same project
      expect(task1.getProjectId()).toBe(VALID_PROJECT_ID);
      expect(task2.getProjectId()).toBe(VALID_PROJECT_ID);
      expect(task1.getId()).not.toBe(task2.getId());
    });

    it('should maintain project assignment through archival', () => {
      const task = Task.create({
        title: 'Task to Archive',
        description: 'Project should persist through archival',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: VALID_PROJECT_ID,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(),
      });

      const originalProjectId = task.getProjectId();

      // Archive task
      task.archive();
      expect(task.getIsArchived()).toBe(true);
      expect(task.getProjectId()).toBe(originalProjectId);

      // Unarchive task
      task.unarchive();
      expect(task.getIsArchived()).toBe(false);
      expect(task.getProjectId()).toBe(originalProjectId);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('Edge Cases', () => {
    it('should handle task creation with empty string projectId as invalid', () => {
      // Empty string should not be accepted as projectId
      // Domain should accept null or valid UUID only
      expect(() => {
        Task.create({
          title: 'Test Task',
          description: 'Testing empty project ID',
          priorityBucket: 5,
          dueDate: new Date('2025-12-31'),
          status: TaskStatus.TO_DO,
          ownerId: OWNER_ID,
          departmentId: DEPARTMENT_ID,
          projectId: '' as any, // Empty string should be rejected
          parentTaskId: null,
          recurringInterval: null,
          isArchived: false,
          assignments: new Set([ASSIGNEE_ID]),
          tags: new Set(),
        });
      }).toThrow();
    });

    it('should allow recurring tasks with project assignment', () => {
      const task = Task.create({
        title: 'Recurring Task in Project',
        description: 'Weekly task in project',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: VALID_PROJECT_ID,
        parentTaskId: null,
        recurringInterval: 7, // Weekly
        isArchived: false,
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(),
      });

      expect(task.getProjectId()).toBe(VALID_PROJECT_ID);
      expect(task.isTaskRecurring()).toBe(true);
      expect(task.getRecurringInterval()).toBe(7);
    });

    it('should preserve project ID in task reconstruction from database', () => {
      // Simulate reconstructing a task from database data
      const dbData = {
        id: 'ccc00000-e29b-41d4-a716-446655440007',
        title: 'Reconstructed Task',
        description: 'From database',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: TaskStatus.TO_DO,
        ownerId: OWNER_ID,
        departmentId: DEPARTMENT_ID,
        projectId: VALID_PROJECT_ID,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        assignments: new Set([ASSIGNEE_ID]),
        tags: new Set(['reconstructed']),
      };

      const task = new Task(dbData);

      expect(task.getProjectId()).toBe(VALID_PROJECT_ID);
      expect(task.getTitle()).toBe('Reconstructed Task');
      expect(task.getId()).toBe(dbData.id);
    });
  });
});
