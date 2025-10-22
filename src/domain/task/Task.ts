/**
 * Task Domain Model
 * Following OO principles - encapsulates all business logic for tasks
 *
 */

import {
  UnauthorizedError,
  InvalidPriorityError,
  MaxAssigneesReachedError,
  InvalidTitleError,
  InvalidRecurrenceError,
  InvalidSubtaskDeadlineError,
  FileSizeLimitExceededError,
  InvalidFileTypeError,
} from './errors/TaskErrors';
import { PriorityBucket } from './PriorityBucket';

/**
 * Enum matching Prisma schema
 */
export enum TaskStatus {
  TO_DO = 'TO_DO',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
}

/**
 * Constructor data for Task instantiation
 */
export interface TaskData {
  id: string;
  title: string;
  description: string;
  priorityBucket: number; // 1-10 scale
  dueDate: Date;
  status: TaskStatus;
  ownerId: string; // Creator/owner
  departmentId: string;
  projectId: string | null;
  parentTaskId: string | null;
  recurringInterval: number | null; // null = not recurring, number = days interval
  isArchived: boolean;
  createdAt: Date;
  startDate: Date | null; // When work first began (set when status → IN_PROGRESS first time)
  updatedAt: Date;
  assignments: Set<string>; // User IDs assigned to this task
  tags: Set<string>; // Tag names
  comments?: CommentData[]; // Comments from database (optional for reconstruction)
  files?: FileData[]; // Files from database (optional for reconstruction)
}

/**
 * Data for creating a new task
 */
export interface CreateTaskData {
  title: string;
  description: string;
  priority: number; // 1-10
  dueDate: Date;
  departmentId: string;
  ownerId: string; // Creator
  assignments: string[]; // Initial user IDs to assign (creator included automatically)
  projectId?: string;
  parentTaskId?: string;
  tags?: string[];
  recurringInterval?: number; // Optional: days interval (null/undefined = not recurring)
}

/**
 * File attachment data
 */
export interface FileData {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  uploadedById: string;
  uploadedAt: Date;
}

/**
 * Comment data
 */
export interface CommentData {
  id: string;
  content: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task Domain Entity
 *
 * This class contains ALL business rules for task operations.
 * Methods are organized:
 * - CREATE operations
 * - UPDATE operations
 * - QUERY operations
 */
export class Task {
  // Core properties
  private readonly id: string;
  private title: string;
  private description: string;
  private priority: PriorityBucket; // Value Object (1-10 scale)
  private dueDate: Date;
  private status: TaskStatus;
  private readonly ownerId: string; // Creator, never changes
  private readonly departmentId: string;
  private projectId: string | null;
  private readonly parentTaskId: string | null;

  // Recurring settings (Change Document - Week 6)
  private recurringInterval: number | null; // null = not recurring

  // Metadata
  private isArchived: boolean;
  private readonly createdAt: Date;
  private startDate: Date | null; // When work first began
  private updatedAt: Date;
  private completedAt?: Date; // When task was completed

  // Collections
  private assignments: Set<string>; // Max 5 assigned users (TM023)
  private tags: Set<string>; // Optional (TM016)
  private files: FileData[]; // Max 50MB total (TM044)
  private comments: CommentData[];

  /**
   * Constructor - private to force using factory methods
   */
  constructor(data: TaskData) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.priority = PriorityBucket.create(data.priorityBucket);
    this.dueDate = data.dueDate;
    this.status = data.status;
    this.ownerId = data.ownerId;
    this.departmentId = data.departmentId;
    this.projectId = data.projectId;
    this.parentTaskId = data.parentTaskId;
    this.recurringInterval = data.recurringInterval;
    this.isArchived = data.isArchived;
    this.createdAt = data.createdAt;
    this.startDate = data.startDate;
    this.updatedAt = data.updatedAt;
    this.assignments = data.assignments;
    this.tags = data.tags;
    // Initialize from data if provided (for reconstruction from DB), otherwise empty
    this.files = data.files || [];
    this.comments = data.comments || [];
  }

  // ============================================
  // CREATE OPERATIONS
  // ============================================

  /**
   * Factory method to create a new Task
   */
  static create(data: Omit<TaskData, 'id' | 'createdAt' | 'updatedAt'>): Task {
    // Generate UUID for new task
    const id = crypto.randomUUID();
    const now = new Date();

    // Validate title
    const trimmedTitle = data.title.trim();
    if (trimmedTitle.length === 0) {
      throw new InvalidTitleError();
    }

    // Validate priority
    if (data.priorityBucket < 1 || data.priorityBucket > 10) {
      throw new InvalidPriorityError();
    }

    // Validate assignments (TM016 - at least 1, TM023 - max 5)
    if (data.assignments.size === 0) {
      throw new Error('Task must have at least 1 assignee');
    }
    if (data.assignments.size > 5) {
      throw new MaxAssigneesReachedError();
    }

    // Validate recurring settings (if recurringInterval is set, must be > 0)
    if (data.recurringInterval !== null && data.recurringInterval <= 0) {
      throw new InvalidRecurrenceError();
    }

    // Validate projectId - cannot be empty string (must be null or valid string)
    if (data.projectId === '') {
      throw new Error('ProjectId cannot be an empty string, use null instead');
    }

    // Create task with validated data
    const task = new Task({
      id,
      title: trimmedTitle,
      description: data.description,
      priorityBucket: data.priorityBucket,
      dueDate: data.dueDate,
      status: TaskStatus.TO_DO, // Default status for new tasks
      ownerId: data.ownerId,
      departmentId: data.departmentId,
      projectId: data.projectId,
      parentTaskId: data.parentTaskId,
      recurringInterval: data.recurringInterval,
      isArchived: false,
      createdAt: now,
      startDate: null, // New tasks have no start date until moved to IN_PROGRESS
      updatedAt: now,
      assignments: data.assignments,
      tags: data.tags,
    });

    return task;
  }

  /**
   * Validate task data
   */
  validate(): void {
    // Title validation
    if (!this.title || this.title.trim().length === 0) {
      throw new InvalidTitleError();
    }

    // Priority validation
    if (this.priority.getLevel() < 1 || this.priority.getLevel() > 10) {
      throw new InvalidPriorityError();
    }

    // Assignments validation
    if (this.assignments.size === 0) {
      throw new Error('Task must have at least 1 assignee');
    }
    if (this.assignments.size > 5) {
      throw new MaxAssigneesReachedError();
    }

    // Recurring validation (if recurringInterval is set, must be > 0)
    if (this.recurringInterval !== null && this.recurringInterval <= 0) {
      throw new InvalidRecurrenceError();
    }
  }

  // ============================================
  // UPDATE OPERATIONS
  // ============================================

  /**
   * Update task title
   * Business rule: Title cannot be empty
   * Note: Authorization handled by service layer
   */
  updateTitle(newTitle: string): void {
    // 1. Trim and validate title not empty
    const trimmedTitle = newTitle.trim();
    if (trimmedTitle.length === 0) {
      throw new InvalidTitleError();
    }

    // 2. Update title
    this.title = trimmedTitle;

    // 3. Update updatedAt timestamp
    this.updatedAt = new Date();
  }

  /**
   * Update task description
   * Business rule: Description can be empty
   * Note: Authorization handled by service layer
   */
  updateDescription(newDescription: string): void {
    // 1. Update description (no validation - can be empty)
    this.description = newDescription;

    // 2. Update timestamp
    this.updatedAt = new Date();
  }

  /**
   * Update task priority (1-10 scale)
   * Business rule: Priority must be between 1-10
   * Note: Authorization handled by service layer
   */
  updatePriority(newPriority: number): void {
    // 1. Validate priority between 1-10 using Value Object
    if (!PriorityBucket.isValid(newPriority)) {
      throw new InvalidPriorityError();
    }

    // 2. Update priority (create new PriorityBucket - immutable)
    this.priority = PriorityBucket.create(newPriority);

    // 3. Update timestamp
    this.updatedAt = new Date();
  }

  /**
   * Update task deadline
   * Business rule: Subtask deadline must be <= parent deadline
   * Note: Authorization handled by service layer
   */
  updateDeadline(newDeadline: Date, parentDeadline?: Date): void {
    // 1. If subtask, validate deadline <= parent deadline (DST014)
    if (this.isSubtask() && parentDeadline) {
      if (newDeadline.getTime() > parentDeadline.getTime()) {
        throw new InvalidSubtaskDeadlineError();
      }
    }

    // 2. Update deadline
    this.dueDate = newDeadline;

    // 3. Update timestamp
    this.updatedAt = new Date();
  }

  /**
   * Update task status
   * Business rule: Status must be valid enum value
   * Note: Authorization handled by service layer
   */
  updateStatus(newStatus: TaskStatus): void {
    // 1. Update status (TO_DO, IN_PROGRESS, COMPLETED, BLOCKED)
    this.status = newStatus;

    // 2. Set startDate when transitioning to IN_PROGRESS for first time
    if (newStatus === TaskStatus.IN_PROGRESS && !this.startDate) {
      this.startDate = new Date();
    }

    // 3. Update timestamp
    this.updatedAt = new Date();
  }

  /**
   * Add a tag to the task
   * Business rule: Tags are optional, duplicates handled automatically
   * Note: Authorization handled by service layer
   */
  addTag(tag: string): void {
    // 1. Add tag to set (Set automatically handles duplicates)
    this.tags.add(tag);

    // 2. Update timestamp
    this.updatedAt = new Date();
  }

  /**
   * Remove a tag from the task
   * Business rule: No error if tag doesn't exist
   * Note: Authorization handled by service layer
   */
  removeTag(tag: string): void {
    // 1. Remove tag from set (no error if not exists)
    this.tags.delete(tag);

    // 2. Update timestamp
    this.updatedAt = new Date();
  }

  /**
   * Add an assignment to the task
   * AC: Assigned Staff member can add assignments, max 5 only (TM023)
   * AC: Manager can add assignments to accessible tasks (SCRUM-15)
   * Note: Cannot remove assignments per TM015
   */
  addAssignee(
    newUserId: string,
    actorId: string,
    actorRole?: 'STAFF' | 'MANAGER' | 'HR_ADMIN'
  ): void {
    // 1. Check actor authorization
    // - Staff: must be assigned to the task
    // - Manager: can add to accessible tasks (authorization checked at service layer)
    const isManager = actorRole === 'MANAGER';
    if (!isManager && !this.isUserAssigned(actorId)) {
      throw new UnauthorizedError();
    }

    // 2. Check no duplicates (Set handles this automatically, but check for max limit)
    if (this.assignments.has(newUserId)) {
      // Already assigned, no-op (don't update timestamp)
      return;
    }

    // 3. Check max 5 assignments (TM023)
    if (this.assignments.size >= 5) {
      throw new MaxAssigneesReachedError();
    }

    // 4. Add to assignments set
    this.assignments.add(newUserId);

    // 5. Update timestamp
    this.updatedAt = new Date();
  }

  /**
   * Remove an assignment from the task (SCRUM-15 AC3)
   * Business rule: Task must have at least 1 assignee (TM016)
   * Authorization: Only MANAGER can remove assignees (TM015)
   */
  removeAssignee(
    userId: string,
    _actorId: string,
    actorRole?: 'STAFF' | 'MANAGER' | 'HR_ADMIN'
  ): void {
    // 1. Check actor authorization (TM015: Only managers can remove - SCRUM-15 AC3)
    const isManager = actorRole === 'MANAGER';
    if (!isManager) {
      throw new UnauthorizedError();
    }

    // 2. Check if user is assigned
    if (!this.assignments.has(userId)) {
      throw new Error('User is not assigned to this task');
    }

    // 3. Check minimum assignee requirement (TM016: min 1 assignee)
    if (this.assignments.size === 1) {
      throw new Error('Task must have at least 1 assignee (TM016)');
    }

    // 4. Remove from assignments set
    this.assignments.delete(userId);

    // 5. Update timestamp
    this.updatedAt = new Date();
  }

  /**
   * Archive the task (soft delete)
   */
  archive(): void {
    this.isArchived = true;
    this.updatedAt = new Date();
  }

  /**
   * Unarchive the task
   */
  unarchive(): void {
    this.isArchived = false;
    this.updatedAt = new Date();
  }

  /**
   * Add a comment to the task
   * AC: Assigned Staff member OR managers with access can add comments
   * Note: Authorization is handled by the service layer (checks assignment + manager hierarchy)
   */
  addComment(content: string, userId: string): CommentData {
    // Authorization is handled by service layer (TaskService.addCommentToTask)
    // Service layer checks:
    // 1. Staff: must be assigned to task
    // 2. Manager: must have department hierarchy access

    // 1. Create comment with ID, timestamp
    const now = new Date();
    const comment: CommentData = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      authorId: userId,
      createdAt: now,
      updatedAt: now,
    };

    // 3. Add to comments array
    this.comments.push(comment);

    // 4. Update task timestamp
    this.updatedAt = new Date();

    // 5. Return comment
    return comment;
  }

  /**
   * Update a comment (only own comments - TM021)
   * AC: Staff can edit their own comments only (TM021)
   */
  updateComment(commentId: string, newContent: string, userId: string): void {
    // 1. Find comment
    const comment = this.comments.find(c => c.id === commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    // 2. Check comment author is userId (TM021)
    if (comment.authorId !== userId) {
      throw new UnauthorizedError();
    }

    // 3. Update content
    comment.content = newContent;

    // 4. Update timestamp
    comment.updatedAt = new Date();

    // 5. Update task timestamp
    this.updatedAt = new Date();
  }

  /**
   * Add a file attachment
   * AC: Assigned Staff member can add file attachments (up to 50MB total)
   */
  async addFile(file: FileData, userId: string): Promise<void> {
    // 1. Check user is assigned (authorization)
    if (!this.isUserAssigned(userId)) {
      throw new UnauthorizedError();
    }

    // 2. Validate file type (images, PDFs, docs, spreadsheets - TM005)
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (!allowedTypes.includes(file.fileType)) {
      throw new InvalidFileTypeError();
    }

    // 3. Calculate total file size
    const currentTotal = this.getTotalFileSize();
    const newTotal = currentTotal + file.fileSize;

    // 4. Check total <= 50MB (TM044)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (newTotal > maxSize) {
      throw new FileSizeLimitExceededError();
    }

    // 5. Add file
    this.files.push(file);

    // 6. Update timestamp
    this.updatedAt = new Date();
  }

  /**
   * Remove a file attachment
   * AC: Assigned Staff member can delete file attachments
   */
  removeFile(fileId: string, userId: string): void {
    // 1. Check user is assigned (authorization)
    if (!this.isUserAssigned(userId)) {
      throw new UnauthorizedError();
    }

    // 2. Remove file from array
    const index = this.files.findIndex(f => f.id === fileId);
    if (index !== -1) {
      this.files.splice(index, 1);
    }

    // 3. Update timestamp
    this.updatedAt = new Date();
  }

  /**
   * Update recurring settings
   * AC: Staff member can update recurring settings (enable/disable, change interval)
   * Requirements: Task recurrence (Change Document Week 6)
   */
  updateRecurring(enabled: boolean, recurringInterval: number | null): void {
    // If enabled, validate recurringInterval > 0 (TM057)
    if (enabled) {
      if (recurringInterval === null || recurringInterval <= 0) {
        throw new InvalidRecurrenceError();
      }
      this.recurringInterval = recurringInterval;
    } else {
      // If disabled, clear recurrence settings
      this.recurringInterval = null;
    }

    // Update timestamp
    this.updatedAt = new Date();
  }

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  getId(): string {
    return this.id;
  }

  getTitle(): string {
    return this.title;
  }

  getDescription(): string {
    return this.description;
  }

  /**
   * Get priority bucket as number (1-10)
   * For backward compatibility
   */
  getPriorityBucket(): number {
    return this.priority.getLevel();
  }

  /**
   * Get priority as Value Object
   * Provides access to label, color, description
   */
  getPriority(): PriorityBucket {
    return this.priority;
  }

  getDueDate(): Date {
    return this.dueDate;
  }

  getStatus(): TaskStatus {
    return this.status;
  }

  getOwnerId(): string {
    return this.ownerId;
  }

  getDepartmentId(): string {
    return this.departmentId;
  }

  getProjectId(): string | null {
    return this.projectId;
  }

  getParentTaskId(): string | null {
    return this.parentTaskId;
  }

  isTaskRecurring(): boolean {
    return this.recurringInterval !== null;
  }

  getRecurringInterval(): number | null {
    return this.recurringInterval;
  }

  getAssignees(): Set<string> {
    return new Set(this.assignments); // Return copy to prevent mutation
  }

  getTags(): Set<string> {
    return new Set(this.tags); // Return copy
  }

  getFiles(): FileData[] {
    return [...this.files]; // Return copy
  }

  getComments(): CommentData[] {
    return [...this.comments]; // Return copy
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getStartDate(): Date | null {
    return this.startDate;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  /**
   * Check if a user is assigned to this task
   * Note: this is different from the service layer authorization check, cuz this is a biz rule.
   * This checks whether a user is assigned to the task. NOT whether the user is a Manager/Staff.
   */
  isUserAssigned(userId: string): boolean {
    return this.assignments.has(userId);
  }

  /**
   * Get total file size in bytes
   */
  getTotalFileSize(): number {
    return this.files.reduce((sum, file) => sum + file.fileSize, 0);
  }

  /**
   * Check if this is a subtask
   */
  isSubtask(): boolean {
    return this.parentTaskId !== null;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Check if task is overdue
   * A task is overdue if:
   * - Current time > due date
   * - AND status is not COMPLETED
   */
  isOverdue(): boolean {
    const now = new Date();
    return now > this.dueDate && this.status !== TaskStatus.COMPLETED;
  }

  /**
   * Mark task as complete
   * Sets status to COMPLETED and records completion timestamp
   * @param userId - User completing the task (for authorization)
   */
  complete(userId: string): void {
    // 1. Check user is assigned (authorization)
    if (!this.isUserAssigned(userId)) {
      throw new UnauthorizedError();
    }

    // 2. Set status to COMPLETED
    this.status = TaskStatus.COMPLETED;

    // 3. Record completion timestamp
    this.completedAt = new Date();

    // 4. Update timestamp
    this.updatedAt = new Date();
  }

  /**
   * Get completion timestamp
   */
  getCompletedAt(): Date | undefined {
    return this.completedAt;
  }

  /**
   * Check if task is archived
   */
  getIsArchived(): boolean {
    return this.isArchived;
  }
}
