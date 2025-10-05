/**
 * Test Helper Functions for Task Domain
 *
 * These helpers allow you to create test tasks easily
 * without depending on the CREATE endpoint (which your teammate is building)
 */

import { Task, TaskData, TaskStatus } from '@/domain/task/Task';

/**
 * Create a test task with sensible defaults
 * You can override any fields for specific tests
 *
 * Usage:
 *   const task = createTestTask({ assignments: new Set(['user-1']) });
 */
export function createTestTask(overrides: Partial<TaskData> = {}): Task {
  const defaultData: TaskData = {
    id: 'test-task-123',
    title: 'Test Task',
    description: 'This is a test task description',
    priorityBucket: 5, // Default middle priority
    dueDate: new Date('2025-10-15'),
    status: TaskStatus.TO_DO,
    ownerId: 'owner-1',
    departmentId: 'dept-1',
    projectId: 'project-1',
    parentTaskId: null,
    isRecurring: false,
    recurrenceDays: null,
    isArchived: false,
    createdAt: new Date('2025-10-01'),
    updatedAt: new Date('2025-10-01'),
    assignments: new Set(['owner-1']), // Owner is always assigned by default
    tags: new Set(),
    ...overrides,
  };

  return new Task(defaultData);
}

/**
 * Create a test subtask (has parentTaskId)
 */
export function createTestSubtask(
  parentTaskId: string,
  overrides: Partial<TaskData> = {}
): Task {
  return createTestTask({
    id: 'test-subtask-123',
    title: 'Test Subtask',
    parentTaskId,
    ...overrides,
  });
}

/**
 * Create a test task with max assignments (5)
 */
export function createTestTaskWithMaxAssignees(
  overrides: Partial<TaskData> = {}
): Task {
  return createTestTask({
    assignments: new Set(['user-1', 'user-2', 'user-3', 'user-4', 'user-5']),
    ...overrides,
  });
}

/**
 * Create a recurring test task
 */
export function createTestRecurringTask(
  recurrenceDays: number,
  overrides: Partial<TaskData> = {}
): Task {
  return createTestTask({
    isRecurring: true,
    recurrenceDays,
    ...overrides,
  });
}

/**
 * Create a test task with specific priority
 */
export function createTestTaskWithPriority(
  priority: number,
  overrides: Partial<TaskData> = {}
): Task {
  return createTestTask({
    priorityBucket: priority,
    ...overrides,
  });
}

/**
 * Mock file data for testing file attachments
 */
export function createMockFile(
  fileName: string,
  fileSize: number,
  fileType = 'application/pdf'
) {
  return {
    id: `file-${Date.now()}`,
    fileName,
    fileSize,
    fileType,
    storagePath: `/storage/${fileName}`,
    uploadedById: 'user-1',
    uploadedAt: new Date(),
  };
}
