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
    metadata?: Record<string, unknown>
  ): Promise<void>;
}
