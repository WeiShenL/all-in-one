import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Service for handling file storage operations with Supabase Storage
 * Implements file upload, download, deletion, and validation
 *
 * Storage structure: task-attachments/{taskId}/{uuid}-{filename}
 *
 * Limits (as per TM005, TM044):
 * - Max 10MB per file
 * - Max 50MB total per task
 */
export class SupabaseStorageService {
  private readonly bucketName = 'task-attachments';
  private readonly supabaseAdmin: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_API_EXTERNAL_URL!;
    const supabaseServiceKey = process.env.SERVICE_ROLE_KEY!;

    // Service client with elevated permissions for server-side operations
    this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Upload file to Supabase Storage
   * @param taskId - The task this file belongs to
   * @param file - File buffer/data
   * @param fileName - Original filename
   * @param fileType - MIME type
   * @returns Storage path and file size
   */
  async uploadFile(
    taskId: string,
    file: Buffer,
    fileName: string,
    fileType: string
  ): Promise<{ storagePath: string; fileSize: number }> {
    // Generate unique file path: task-attachments/{taskId}/{uuid}-{filename}
    // Sanitize filename: replace spaces and special chars with underscores
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileId = crypto.randomUUID();
    const storagePath = `${taskId}/${fileId}-${sanitizedFileName}`;

    const { data, error } = await this.supabaseAdmin.storage
      .from(this.bucketName)
      .upload(storagePath, file, {
        contentType: fileType,
        upsert: false, // Prevent overwriting
      });

    if (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }

    return {
      storagePath: data.path,
      fileSize: file.length,
    };
  }

  /**
   * Generate signed URL for file download (expires in 1 hour)
   * @param storagePath - Path to file in storage
   * @returns Signed URL for downloading the file
   */
  async getFileDownloadUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.supabaseAdmin.storage
      .from(this.bucketName)
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (error) {
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Delete file from storage
   * @param storagePath - Path to file in storage
   */
  async deleteFile(storagePath: string): Promise<void> {
    const { error } = await this.supabaseAdmin.storage
      .from(this.bucketName)
      .remove([storagePath]);

    if (error) {
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  /**
   * Validate individual file before upload
   * Checks file size (max 10MB) and file type
   *
   * @param fileName - Name of the file
   * @param fileSize - Size in bytes
   * @param fileType - MIME type
   * @returns Validation result
   */
  validateFile(
    fileName: string,
    fileSize: number,
    fileType: string
  ): { valid: boolean; error?: string } {
    // File size limit: 10MB per file (as per TM005)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    // Allowed file types (as per TM005: images, pdfs, doc, spreadsheets)
    const ALLOWED_TYPES = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/zip',
    ];

    if (fileSize > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds 10MB limit. Current size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB`,
      };
    }

    if (!ALLOWED_TYPES.includes(fileType)) {
      return {
        valid: false,
        error: `File type '${fileType}' is not allowed. Allowed types: PDF, images, Word docs, Excel sheets, text files, ZIP`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate total file size for a task (50MB limit per task as per TM044)
   * @param currentTotalSize - Current total size of all files for the task
   * @param newFileSize - Size of the new file to be uploaded
   * @returns Validation result
   */
  validateTaskFileLimit(
    currentTotalSize: number,
    newFileSize: number
  ): { valid: boolean; error?: string } {
    const MAX_TOTAL_SIZE_PER_TASK = 50 * 1024 * 1024; // 50MB in bytes

    if (currentTotalSize + newFileSize > MAX_TOTAL_SIZE_PER_TASK) {
      return {
        valid: false,
        error: `Task file limit exceeded. Current total: ${(currentTotalSize / (1024 * 1024)).toFixed(2)}MB, New file: ${(newFileSize / (1024 * 1024)).toFixed(2)}MB, Maximum allowed per task: 50MB`,
      };
    }

    return { valid: true };
  }
}
