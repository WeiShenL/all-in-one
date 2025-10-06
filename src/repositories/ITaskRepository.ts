/**
 * ITaskRepository Interface
 *
 * Repository pattern interface for Task persistence
 * This defines the contract that any Task repository implementation must follow
 */

import { Task, TaskStatus } from '../domain/task/Task';

export interface ITaskRepository {
  // ============================================
  // CORE TASK OPERATIONS (Domain-driven)
  // ============================================

  /**
   * Save a task (create or update)
   */
  save(task: Task): Promise<Task>;

  /**
   * Find a task by ID
   */
  findById(id: string): Promise<Task | null>;

  /**
   * Find all tasks in a department
   */
  findByDepartment(
    departmentId: string,
    includeArchived?: boolean
  ): Promise<Task[]>;

  /**
   * Find all tasks assigned to a user
   */
  findByAssignee(userId: string, includeArchived?: boolean): Promise<Task[]>;

  /**
   * Find tasks in department with assignees (for staff visibility)
   */
  findByDepartmentWithAssignees(
    departmentId: string,
    includeArchived?: boolean
  ): Promise<Task[]>;

  /**
   * Find subtasks of a parent task
   */
  findSubtasks(parentTaskId: string): Promise<Task[]>;

  /**
   * Find parent task
   */
  findParentTask(taskId: string): Promise<Task | null>;

  /**
   * Delete a task
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a task exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Find tasks by criteria
   */
  findByCriteria(criteria: {
    departmentId?: string;
    status?: TaskStatus;
    assigneeId?: string;
    creatorId?: string;
    tag?: string;
  }): Promise<Task[]>;

  /**
   * Find all tasks by project
   */
  findByProject(projectId: string, includeArchived?: boolean): Promise<Task[]>;

  /**
   * Find all tasks (admin only)
   */
  findAll(includeArchived?: boolean): Promise<Task[]>;

  // ============================================
  // FILE ATTACHMENT OPERATIONS
  // ============================================

  /**
   * Create a new task file record in the database
   * @param data - File metadata
   * @returns Created file record
   */
  createTaskFile(data: {
    taskId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    storagePath: string;
    uploadedById: string;
  }): Promise<{
    id: string;
    taskId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    storagePath: string;
    uploadedById: string;
    uploadedAt: Date;
  }>;

  /**
   * Get all files for a specific task
   * @param taskId - Task ID
   * @returns Array of file records
   */
  getTaskFiles(taskId: string): Promise<
    Array<{
      id: string;
      taskId: string;
      fileName: string;
      fileSize: number;
      fileType: string;
      storagePath: string;
      uploadedById: string;
      uploadedAt: Date;
    }>
  >;

  /**
   * Get a specific file by ID
   * @param fileId - File ID
   * @returns File record or null
   */
  getTaskFileById(fileId: string): Promise<{
    id: string;
    taskId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    storagePath: string;
    uploadedById: string;
    uploadedAt: Date;
  } | null>;

  /**
   * Delete a file record from the database
   * @param fileId - File ID
   */
  deleteTaskFile(fileId: string): Promise<void>;

  // ============================================
  // AUTHORIZATION & LOGGING HELPERS
  // ============================================

  /**
   * Get task by ID (needed for authorization checks)
   * @param taskId - Task ID
   */
  getTaskById(taskId: string): Promise<{
    id: string;
    assignments: Array<{ userId: string }>;
    ownerId: string;
  } | null>;

  /**
   * Log a task action
   * @param taskId - Task ID
   * @param userId - User performing the action
   * @param action - Action type
   * @param metadata - Additional metadata
   */
  logTaskAction(
    taskId: string,
    userId: string,
    action: string,
    metadata?: Record<string, string | number | boolean | null>
  ): Promise<void>;
}
