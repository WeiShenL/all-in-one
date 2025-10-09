/**
 * Task Repository Interface
 * Defines data access methods for task-related operations
 */

export interface ITaskRepository {
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

  /**
   * Get task by ID (needed for authorization checks - simple version)
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
   * @param metadata - Additional metadata
   */
  logTaskAction(
    taskId: string,
    userId: string,
    action: string,
    metadata?: Record<string, string | number | boolean | null>
  ): Promise<void>;

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
}
