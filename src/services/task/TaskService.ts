/**
 * TaskService - Application Service Layer
 *
 * Handles:
 * - Authorization logic (manager permissions)
 * - Orchestration between domain and infrastructure
 * - Transaction management
 * - Cross-aggregate operations
 */

import { Task, TaskStatus } from '../../domain/task/Task';
import { ITaskRepository } from '../../repositories/ITaskRepository';
import { UnauthorizedError } from '../../domain/task/errors/TaskErrors';
import { SupabaseStorageService } from '../storage/SupabaseStorageService';

export interface CreateTaskDTO {
  title: string;
  description: string;
  priorityBucket: number;
  dueDate: Date;
  ownerId: string;
  departmentId: string;
  projectId: string | null;
  parentTaskId?: string | null;
  isRecurring?: boolean;
  recurrenceDays?: number | null;
  assignments?: string[];
  tags?: string[];
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  priorityBucket?: number;
  dueDate?: Date;
  status?: TaskStatus;
  isRecurring?: boolean;
  recurrenceDays?: number | null;
}

export interface UserContext {
  userId: string;
  role: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
  departmentId: string;
}

export class TaskService {
  private storageService = new SupabaseStorageService();

  constructor(
    private readonly taskRepository: ITaskRepository
    // Add other repositories as needed (UserRepository, ProjectRepository, etc.)
  ) {}

  // ============================================
  // CREATE OPERATIONS
  // ============================================

  /**
   * Create a new task
   * Create task dev will implement this based on CREATE user story
   */
  async createTask(_dto: CreateTaskDTO, _user: UserContext): Promise<Task> {
    // TODO: Create task dev will implement
    // 1. Validate user has permission to create task in department
    // 2. Validate project exists and user has access
    // 3. If parentTaskId provided, validate parent task exists
    // 4. Create Task using Task.create() factory method
    // 5. Save to repository
    // 6. Return created task
    throw new Error(
      'Not implemented - Create task dev will implement CREATE story'
    );
  }

  /**
   * Create a subtask under a parent task
   */
  async createSubtask(
    _parentTaskId: string,
    _dto: CreateTaskDTO,
    _user: UserContext
  ): Promise<Task> {
    // TODO: Create task dev will implement
    // Similar to createTask but with parent validation
    throw new Error(
      'Not implemented - Create task dev will implement CREATE story'
    );
  }

  // ============================================
  // UPDATE OPERATIONS - With Manager Authorization
  // ============================================

  /**
   * Update task title
   * Managers can update any task in their department
   * Staff must be assigned to the task
   */
  async updateTaskTitle(
    taskId: string,
    newTitle: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Authorization check: Manager of department OR assigned user
    const isManagerOfDept =
      user.role === 'MANAGER' && task.getDepartmentId() === user.departmentId;
    const isAssigned = task.isUserAssigned(user.userId);

    if (!isManagerOfDept && !isAssigned) {
      throw new UnauthorizedError('User is not authorized to update this task');
    }

    // Apply business logic (domain method)
    task.updateTitle(newTitle);

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Update task description
   */
  async updateTaskDescription(
    taskId: string,
    newDescription: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Authorization check: Manager of department OR assigned user
    const isManagerOfDept =
      user.role === 'MANAGER' && task.getDepartmentId() === user.departmentId;
    const isAssigned = task.isUserAssigned(user.userId);

    if (!isManagerOfDept && !isAssigned) {
      throw new UnauthorizedError('User is not authorized to update this task');
    }

    // Apply business logic (domain method)
    task.updateDescription(newDescription);

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Update task priority
   */
  async updateTaskPriority(
    taskId: string,
    newPriority: number,
    user: UserContext
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Authorization check: Manager of department OR assigned user
    const isManagerOfDept =
      user.role === 'MANAGER' && task.getDepartmentId() === user.departmentId;
    const isAssigned = task.isUserAssigned(user.userId);

    if (!isManagerOfDept && !isAssigned) {
      throw new UnauthorizedError('User is not authorized to update this task');
    }

    // Apply business logic (domain method)
    task.updatePriority(newPriority);

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Update task deadline
   */
  async updateTaskDeadline(
    taskId: string,
    newDeadline: Date,
    user: UserContext
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Authorization check: Manager of department OR assigned user
    const isManagerOfDept =
      user.role === 'MANAGER' && task.getDepartmentId() === user.departmentId;
    const isAssigned = task.isUserAssigned(user.userId);

    if (!isManagerOfDept && !isAssigned) {
      throw new UnauthorizedError('User is not authorized to update this task');
    }

    // If it's a subtask, need to check parent deadline
    let parentDeadline: Date | undefined;
    if (task.getParentTaskId()) {
      const parentTask = await this.taskRepository.findById(
        task.getParentTaskId()!
      );
      parentDeadline = parentTask?.getDueDate();
    }

    // Apply business logic (domain method)
    task.updateDeadline(newDeadline, parentDeadline);

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    user: UserContext
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Authorization check: Manager of department OR assigned user
    const isManagerOfDept =
      user.role === 'MANAGER' && task.getDepartmentId() === user.departmentId;
    const isAssigned = task.isUserAssigned(user.userId);

    if (!isManagerOfDept && !isAssigned) {
      throw new UnauthorizedError('User is not authorized to update this task');
    }

    // Apply business logic (domain method)
    task.updateStatus(newStatus);

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Update task recurring settings
   */
  async updateTaskRecurring(
    taskId: string,
    enabled: boolean,
    days: number | null,
    user: UserContext
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Authorization check: Manager of department OR assigned user
    const isManagerOfDept =
      user.role === 'MANAGER' && task.getDepartmentId() === user.departmentId;
    const isAssigned = task.isUserAssigned(user.userId);

    if (!isManagerOfDept && !isAssigned) {
      throw new UnauthorizedError('User is not authorized to update this task');
    }

    // Apply business logic (domain method)
    task.updateRecurring(enabled, days);

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Add tag to task
   */
  async addTagToTask(
    taskId: string,
    tag: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Authorization check: Manager of department OR assigned user
    const isManagerOfDept =
      user.role === 'MANAGER' && task.getDepartmentId() === user.departmentId;
    const isAssigned = task.isUserAssigned(user.userId);

    if (!isManagerOfDept && !isAssigned) {
      throw new UnauthorizedError('User is not authorized to update this task');
    }

    // Apply business logic (domain method)
    task.addTag(tag);

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Remove tag from task
   */
  async removeTagFromTask(
    taskId: string,
    tag: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Authorization check: Manager of department OR assigned user
    const isManagerOfDept =
      user.role === 'MANAGER' && task.getDepartmentId() === user.departmentId;
    const isAssigned = task.isUserAssigned(user.userId);

    if (!isManagerOfDept && !isAssigned) {
      throw new UnauthorizedError('User is not authorized to update this task');
    }

    // Apply business logic (domain method)
    task.removeTag(tag);

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Add assignee to task
   * Only managers can add assignees from other departments
   */
  async addAssigneeToTask(
    taskId: string,
    assigneeUserId: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Use regular method (it already handles authorization)
    task.addAssignee(assigneeUserId, user.userId);

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string, user: UserContext): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    task.complete(user.userId);

    await this.taskRepository.save(task);

    // Handle recurring task creation if needed
    if (task.isTaskRecurring()) {
      await this.createRecurringTask(task, user);
    }

    return task;
  }

  /**
   * Archive a task
   */
  async archiveTask(taskId: string, user: UserContext): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    task.archive(user.userId);

    await this.taskRepository.save(task);
    return task;
  }

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  /**
   * Get task by ID
   * Checks viewing permissions based on department/assignment
   */
  async getTaskById(taskId: string, user: UserContext): Promise<Task | null> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      return null;
    }

    // Check viewing permissions
    if (!this.canUserViewTask(task, user)) {
      throw new UnauthorizedError(
        'You do not have permission to view this task'
      );
    }

    return task;
  }

  /**
   * Get tasks for a user (assigned tasks)
   */
  async getUserTasks(
    userId: string,
    includeArchived: boolean = false
  ): Promise<Task[]> {
    return this.taskRepository.findByAssignee(userId, includeArchived);
  }

  /**
   * Get tasks by department
   * Managers can see all, staff can see where colleagues are assigned
   */
  async getDepartmentTasks(
    departmentId: string,
    user: UserContext,
    includeArchived: boolean = false
  ): Promise<Task[]> {
    if (user.role === 'MANAGER' && user.departmentId === departmentId) {
      // Managers see all tasks in their department
      return this.taskRepository.findByDepartment(
        departmentId,
        includeArchived
      );
    } else {
      // Staff see tasks where department colleagues are assigned
      // This would need a more complex query
      return this.taskRepository.findByDepartmentWithAssignees(
        departmentId,
        includeArchived
      );
    }
  }

  /**
   * Get tasks by project
   */
  async getProjectTasks(
    projectId: string,
    user: UserContext,
    includeArchived: boolean = false
  ): Promise<Task[]> {
    const tasks = await this.taskRepository.findByProject(
      projectId,
      includeArchived
    );

    // Filter based on viewing permissions
    return tasks.filter(task => this.canUserViewTask(task, user));
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(user: UserContext): Promise<Task[]> {
    let tasks: Task[];

    if (user.role === 'HR_ADMIN') {
      tasks = await this.taskRepository.findAll();
    } else if (user.role === 'MANAGER') {
      tasks = await this.taskRepository.findByDepartment(user.departmentId);
    } else {
      tasks = await this.taskRepository.findByAssignee(user.userId);
    }

    return tasks.filter(task => task.isOverdue());
  }

  /**
   * Get tasks owned by a user
   */
  async getByOwner(ownerId: string, user: UserContext): Promise<Task[]> {
    const tasks = await this.taskRepository.findByCriteria({
      creatorId: ownerId,
    });

    return tasks.filter(task => this.canUserViewTask(task, user));
  }

  /**
   * Get subtasks of a parent task
   */
  async getSubtasks(parentTaskId: string, user: UserContext): Promise<Task[]> {
    const subtasks = await this.taskRepository.findSubtasks(parentTaskId);

    return subtasks.filter(task => this.canUserViewTask(task, user));
  }

  /**
   * Get all tasks with optional filters
   * Note: Authorization should be handled at the route level for this method
   */
  async getAll(
    user: UserContext,
    includeArchived: boolean = false
  ): Promise<Task[]> {
    let tasks: Task[];

    if (user.role === 'HR_ADMIN') {
      tasks = await this.taskRepository.findAll(includeArchived);
    } else if (user.role === 'MANAGER') {
      tasks = await this.taskRepository.findByDepartment(
        user.departmentId,
        includeArchived
      );
    } else {
      tasks = await this.taskRepository.findByAssignee(
        user.userId,
        includeArchived
      );
    }

    return tasks;
  }

  // ============================================
  // COMMENT OPERATIONS
  // ============================================

  /**
   * Add a comment to a task
   * AC: Assigned Staff member can add comments (TM021)
   *
   * Authorization: Manager of department OR assigned user
   */
  async addCommentToTask(
    taskId: string,
    content: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Authorization check: Manager of department OR assigned user
    const isManagerOfDept =
      user.role === 'MANAGER' && task.getDepartmentId() === user.departmentId;
    const isAssigned = task.isUserAssigned(user.userId);

    if (!isManagerOfDept && !isAssigned) {
      throw new UnauthorizedError(
        'User is not authorized to comment on this task'
      );
    }

    // Apply business logic (domain method creates comment)
    task.addComment(content, user.userId);

    await this.taskRepository.save(task);
    return task;
  }

  /**
   * Edit a comment
   * AC: Staff member can edit their own comments only (TM021)
   *
   * Authorization: Only the comment author can edit
   */
  async updateComment(
    taskId: string,
    commentId: string,
    newContent: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // The domain method will check if user is the author
    // No need for manager override - users can only edit their own comments
    task.updateComment(commentId, newContent, user.userId);

    await this.taskRepository.save(task);
    return task;
  }

  // ============================================
  // FILE ATTACHMENT OPERATIONS
  // ============================================

  /**
   * Upload a file to a task
   *
   * Authorization: User must be assigned to the task
   * Validation:
   * - Individual file max 10MB (TM005)
   * - Task total max 50MB (TM044)
   * - Allowed file types only
   *
   * @param taskId - Task ID
   * @param file - File buffer
   * @param fileName - Original filename
   * @param fileType - MIME type
   * @param user - User context for authorization
   * @returns Created file record
   */
  async uploadFileToTask(
    taskId: string,
    file: Buffer,
    fileName: string,
    fileType: string,
    user: UserContext
  ) {
    // 1. Authorization: Check if user is assigned to task
    const task = await this.taskRepository.getTaskById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const isAssigned = task.assignments.some(
      assignment => assignment.userId === user.userId
    );

    if (!isAssigned) {
      throw new Error(
        'Unauthorized: You must be assigned to this task to upload files'
      );
    }

    // 2. Validate individual file (size and type)
    const fileValidation = this.storageService.validateFile(
      fileName,
      file.length,
      fileType
    );
    if (!fileValidation.valid) {
      throw new Error(fileValidation.error);
    }

    // 3. Check task-level 50MB limit
    const existingFiles = await this.taskRepository.getTaskFiles(taskId);
    const currentTotalSize = existingFiles.reduce(
      (sum, f) => sum + f.fileSize,
      0
    );

    const taskLimitValidation = this.storageService.validateTaskFileLimit(
      currentTotalSize,
      file.length
    );
    if (!taskLimitValidation.valid) {
      throw new Error(taskLimitValidation.error);
    }

    // 4. Upload to Supabase Storage
    const { storagePath, fileSize } = await this.storageService.uploadFile(
      taskId,
      file,
      fileName,
      fileType
    );

    // 5. Save metadata to database
    const fileRecord = await this.taskRepository.createTaskFile({
      taskId,
      fileName,
      fileSize,
      fileType,
      storagePath,
      uploadedById: user.userId,
    });

    // 6. Log action
    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'FILE_UPLOADED',
      {
        fileName,
        fileSize,
        fileId: fileRecord.id,
      }
    );

    return fileRecord;
  }

  /**
   * Get download URL for a file
   *
   * Authorization: User must be assigned to the task
   *
   * @param fileId - File ID
   * @param user - User context for authorization
   * @returns Signed download URL (expires in 1 hour)
   */
  async getFileDownloadUrl(fileId: string, user: UserContext): Promise<string> {
    // 1. Get file metadata
    const fileRecord = await this.taskRepository.getTaskFileById(fileId);
    if (!fileRecord) {
      throw new Error('File not found');
    }

    // 2. Authorization: Check if user is assigned to the task
    const task = await this.taskRepository.getTaskById(fileRecord.taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const isAssigned = task.assignments.some(
      assignment => assignment.userId === user.userId
    );

    if (!isAssigned) {
      throw new Error(
        'Unauthorized: You must be assigned to this task to download files'
      );
    }

    // 3. Generate signed URL (valid for 1 hour)
    return await this.storageService.getFileDownloadUrl(fileRecord.storagePath);
  }

  /**
   * Delete a file attachment
   *
   * Authorization: Only the uploader or task owner can delete
   *
   * @param fileId - File ID
   * @param user - User context for authorization
   */
  async deleteFile(fileId: string, user: UserContext): Promise<void> {
    // 1. Get file metadata
    const fileRecord = await this.taskRepository.getTaskFileById(fileId);
    if (!fileRecord) {
      throw new Error('File not found');
    }

    // 2. Get task details
    const task = await this.taskRepository.getTaskById(fileRecord.taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // 3. Authorization: Only uploader or task owner can delete
    const canDelete =
      fileRecord.uploadedById === user.userId || task.ownerId === user.userId;

    if (!canDelete) {
      throw new Error(
        'Unauthorized: Only the uploader or task owner can delete files'
      );
    }

    // 4. Delete from Supabase Storage
    await this.storageService.deleteFile(fileRecord.storagePath);

    // 5. Delete from database
    await this.taskRepository.deleteTaskFile(fileId);

    // 6. Log action
    await this.taskRepository.logTaskAction(
      fileRecord.taskId,
      user.userId,
      'FILE_UPLOADED', // Using FILE_UPLOADED enum, add metadata to indicate deletion
      {
        fileName: fileRecord.fileName,
        action: 'deleted',
        fileId: fileId,
      }
    );
  }

  /**
   * Get all files for a task
   *
   * Authorization: User must be assigned to the task
   *
   * @param taskId - Task ID
   * @param user - User context for authorization
   * @returns Array of file records
   */
  async getTaskFiles(taskId: string, user: UserContext) {
    // 1. Authorization: Check if user is assigned to task
    const task = await this.taskRepository.getTaskById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const isAssigned = task.assignments.some(
      assignment => assignment.userId === user.userId
    );

    if (!isAssigned) {
      throw new Error(
        'Unauthorized: You must be assigned to this task to view files'
      );
    }

    // 2. Get files
    return await this.taskRepository.getTaskFiles(taskId);
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Check if user can view a task based on business rules
   */
  private canUserViewTask(task: Task, user: UserContext): boolean {
    // HR_ADMIN can view everything
    if (user.role === 'HR_ADMIN') {
      return true;
    }

    // User is assigned to the task
    if (task.isUserAssigned(user.userId)) {
      return true;
    }

    // Manager can view all tasks in their department
    if (
      user.role === 'MANAGER' &&
      task.getDepartmentId() === user.departmentId
    ) {
      return true;
    }

    // Staff can view tasks in their department where colleagues are assigned
    if (task.getDepartmentId() === user.departmentId) {
      // Would need to check if any assignee is from same department
      // This requires UserRepository to check assignee departments
      return true; // Simplified for now
    }

    return false;
  }

  /**
   * Create recurring task after completion
   */
  private async createRecurringTask(
    _completedTask: Task,
    _user: UserContext
  ): Promise<Task> {
    // TODO: Implement recurring task logic
    // 1. Calculate new due date based on recurrence days
    // 2. Create new task with same properties except:
    //    - New ID
    //    - New due date
    //    - Status = TO_DO
    //    - Clear comments
    //    - Keep or clear attachments based on requirements
    throw new Error('Recurring task creation not yet implemented');
  }
}
