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
   * Get full task by ID with all relations for domain reconstruction
   * @param taskId - Task ID
   * @returns Full task data or null
   */
  getTaskByIdFull(taskId: string): Promise<{
    id: string;
    title: string;
    description: string;
    priority: number;
    dueDate: Date;
    status: string;
    ownerId: string;
    departmentId: string;
    projectId: string | null;
    parentTaskId: string | null;
    recurringInterval: number | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
    assignments: Array<{ userId: string }>;
    tags: Array<{ tag: { name: string } }>;
    comments: Array<{
      id: string;
      content: string;
      userId: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    files: Array<{
      id: string;
      fileName: string;
      fileSize: number;
      fileType: string;
      storagePath: string;
      uploadedById: string;
      uploadedAt: Date;
    }>;
  } | null>;

  /**
   * Log a task action
   * @param taskId - Task ID
   * @param userId - User performing the action
   * @param action - Action type
   * @param field - field affected
   * @param data - Additional data including changes and metadata
   */
  logTaskAction(
    taskId: string,
    userId: string,
    action: string,
    field: string,
    data?: {
      field?: string;
      changes?: any;
      metadata?: any;
      [key: string]: any;
    }
  ): Promise<void>;

  /**
   * Get task logs for a specific task
   * @param taskId - Task ID
   * @returns Array of task logs with user details
   */
  getTaskLogs(taskId: string): Promise<
    Array<{
      id: string;
      taskId: string;
      userId: string;
      action: string;
      field: string;
      changes: any;
      metadata: any;
      timestamp: Date;
      user: {
        id: string;
        name: string;
        email: string;
      };
    }>
  >;

  /**
   * Create a new task
   * @param data - Task creation data including all required fields
   * @returns Created task ID
   */
  createTask(data: {
    id: string;
    title: string;
    description: string;
    priority: number;
    dueDate: Date;
    ownerId: string;
    departmentId: string;
    projectId?: string;
    parentTaskId?: string;
    assigneeIds: string[];
    tags?: string[];
    recurringInterval?: number; // Matches Prisma schema field
  }): Promise<{ id: string }>;

  /**
   * Validate if project exists
   * @param projectId - Project ID
   * @returns True if exists
   */
  validateProjectExists(projectId: string): Promise<boolean>;

  /**
   * Get parent task depth info for subtask validation (TGO026)
   * @param taskId - Task ID
   * @returns Parent task info or null
   */
  getParentTaskDepth(
    taskId: string
  ): Promise<{ id: string; parentTaskId: string | null } | null>;

  /**
   * Validate assignees exist and are active
   * @param userIds - Array of user IDs
   * @returns Validation result
   */
  validateAssignees(
    userIds: string[]
  ): Promise<{ allExist: boolean; allActive: boolean }>;

  /**
   * Get all tasks assigned to a user
   * @param userId - User ID
   * @param includeArchived - Include archived tasks
   * @returns Array of task data
   */
  getUserTasks(userId: string, includeArchived: boolean): Promise<any[]>;

  /**
   * Get all tasks in a department
   * @param departmentId - Department ID
   * @param includeArchived - Include archived tasks
   * @returns Array of task data
   */
  getDepartmentTasks(
    departmentId: string,
    includeArchived: boolean
  ): Promise<any[]>;

  /**
   * Update task fields (matches Prisma Task schema)
   */
  updateTask(
    taskId: string,
    data: Partial<{
      title: string;
      description: string;
      priority: number;
      dueDate: Date;
      status: string;
      recurringInterval: number | null;
      updatedAt: Date;
    }>
  ): Promise<void>;

  /**
   * Add tag to task (uses Tag.name and TaskTag bridge)
   */
  addTaskTag(taskId: string, tagName: string): Promise<void>;

  /**
   * Remove tag from task (uses Tag.name and TaskTag bridge)
   */
  removeTaskTag(taskId: string, tagName: string): Promise<void>;

  /**
   * Add assignment (matches TaskAssignment schema)
   */
  addTaskAssignment(
    taskId: string,
    userId: string,
    assignedById: string
  ): Promise<void>;

  /**
   * Create comment (matches Comment schema: taskId, userId, content)
   */
  createComment(taskId: string, content: string, userId: string): Promise<void>;

  /**
   * Update comment content
   */
  updateComment(commentId: string, newContent: string): Promise<void>;

  /**
   * Get all tasks with optional filters
   * @param filters - Filter criteria
   * @returns Array of task data
   */
  getAllTasks(filters: {
    ownerId?: string;
    projectId?: string;
    departmentId?: string;
    status?: string;
    isArchived?: boolean;
    parentTaskId?: string;
  }): Promise<any[]>;

  /**
   * Get all tasks in a project
   * @param projectId - Project ID
   * @param includeArchived - Include archived tasks
   * @returns Array of task data
   */
  getProjectTasks(projectId: string, includeArchived: boolean): Promise<any[]>;

  /**
   * Get all subtasks of a parent task
   * @param parentTaskId - Parent task ID
   * @returns Array of task data
   */
  getSubtasks(parentTaskId: string): Promise<any[]>;

  /**
   * Get all tasks owned by a user
   * @param ownerId - Owner user ID
   * @param includeArchived - Include archived tasks
   * @returns Array of task data
   */
  getOwnerTasks(ownerId: string, includeArchived: boolean): Promise<any[]>;

  /**
   * Remove assignment from task
   * @param taskId - Task ID
   * @param userId - User ID to unassign
   */
  removeTaskAssignment(taskId: string, userId: string): Promise<void>;

  /**
   * Archive a task
   * @param taskId - Task ID
   */
  archiveTask(taskId: string): Promise<void>;

  /**
   * Unarchive a task
   * @param taskId - Task ID
   */
  unarchiveTask(taskId: string): Promise<void>;

  /**
   * Delete a task (hard delete)
   * @param taskId - Task ID
   */
  deleteTask(taskId: string): Promise<void>;

  /**
   * Check if task has subtasks
   * @param taskId - Task ID
   * @returns True if has subtasks
   */
  hasSubtasks(taskId: string): Promise<boolean>;

  /**
   * Get task hierarchy (parent chain + subtask tree)
   * @param taskId - Task ID
   * @returns Task hierarchy with parent chain and subtask tree
   */
  getTaskHierarchy(taskId: string): Promise<{
    parentChain: Array<{
      id: string;
      title: string;
      status: string;
      parentTaskId: string | null;
    }>;
    currentTask: any;
    subtaskTree: any[];
  }>;

  /**
   * Create calendar event for a task
   * @param data - Calendar event data
   * @returns Created calendar event
   */
  createCalendarEvent(data: {
    taskId: string;
    userId: string;
    title: string;
    eventDate: Date;
  }): Promise<any>;

  /**
   * Get calendar events for a task
   * @param taskId - Task ID
   * @returns Array of calendar events
   */
  getCalendarEvents(taskId: string): Promise<any[]>;

  /**
   * Get department with parent information for authorization checks
   * @param departmentId - Department ID
   * @returns Department with parentId or null
   */
  getDepartmentWithParent(
    departmentId: string
  ): Promise<{ id: string; parentId: string | null } | null>;

  /**
   * Get user departments by user IDs
   * @param userIds - Array of user IDs
   * @returns Array of user departments
   */
  getUserDepartments(
    userIds: string[]
  ): Promise<Array<{ userId: string; departmentId: string | null }>>;

  // ============================================
  // PROJECT COLLABORATOR OPERATIONS
  // SCRUM-XX: Invite Collaborators to Project
  // ============================================

  /**
   * Get user profile with department information
   * Used for retrieving departmentId when creating ProjectCollaborator entries
   *
   * @param userId - User ID
   * @returns User profile with departmentId, or null if not found
   */
  getUserProfile(userId: string): Promise<{
    id: string;
    departmentId: string;
    role: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
    isActive: boolean;
  } | null>;

  /**
   * Check if a user is already a collaborator on a project
   * Used to prevent duplicate ProjectCollaborator entries
   *
   * @param projectId - Project ID
   * @param userId - User ID
   * @returns True if user is already a collaborator
   */
  isUserProjectCollaborator(
    projectId: string,
    userId: string
  ): Promise<boolean>;

  /**
   * Create a ProjectCollaborator entry
   * Links a user to a project with their department
   * Uses upsert to handle race conditions gracefully
   *
   * @param projectId - Project ID
   * @param userId - User ID
   * @param departmentId - User's department ID
   */
  createProjectCollaborator(
    projectId: string,
    userId: string,
    departmentId: string
  ): Promise<void>;

  /**
   * Remove ProjectCollaborator entry if user has no other active tasks in the project
   * Business logic: Only removes if user has ZERO active (non-archived) task assignments
   * in this project after the current removal
   *
   * @param projectId - Project ID
   * @param userId - User ID
   */
  removeProjectCollaboratorIfNoTasks(
    projectId: string,
    userId: string
  ): Promise<void>;
}
