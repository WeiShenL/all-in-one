import { ITaskRepository } from '../../repositories/ITaskRepository';
import { SupabaseStorageService } from '../storage/SupabaseStorageService';

/**
 * User context for authorization
 */
export interface UserContext {
  userId: string;
  role: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
  departmentId: string;
}

/**
 * Task Service
 * Business logic for task file operations
 */
export class TaskService {
  private storageService = new SupabaseStorageService();

  constructor(private taskRepository: ITaskRepository) {}

  /**
   * Upload a file to a task
   *
   * Authorization: Task owner can always upload, otherwise must be assigned
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
    // 1. Authorization: Check if user is task owner or assigned to task
    const task = await this.taskRepository.getTaskById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const isOwner = task.ownerId === user.userId;
    const isAssigned = task.assignments.some(
      assignment => assignment.userId === user.userId
    );

    if (!isOwner && !isAssigned) {
      throw new Error(
        'Unauthorized: You must be the task owner or assigned to this task to upload files'
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
}
