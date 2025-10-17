/**
 * Project Domain Model
 * Following OO principles - encapsulates all business logic for projects
 * SCRUM-30: Create New Project
 */

import {
  InvalidProjectNameError,
  InvalidPriorityError,
  InvalidProjectDataError,
} from './errors/ProjectErrors';

/**
 * Enum matching Prisma schema
 */
export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
  CANCELLED = 'CANCELLED',
}

/**
 * Constructor data for Project reconstruction from database
 */
export interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  status: ProjectStatus;
  departmentId: string;
  creatorId: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data for creating a new project
 */
export interface CreateProjectData {
  name: string;
  description?: string;
  priority?: number; // 1-10, defaults to 5
  status?: ProjectStatus; // Defaults to ACTIVE (matches Prisma schema)
  creatorId: string;
  departmentId: string;
}

/**
 * Project Domain Entity
 *
 * This class contains ALL business rules for project operations.
 * Business Rules:
 * - AC3: Project name must be given (required)
 * - BR1: Name cannot be empty or whitespace
 * - BR2: Name max length 100 characters
 * - BR3: Priority 1-10
 * - Default status: PLANNING
 * - Default priority: 5
 */
export class Project {
  private readonly id: string;
  private name: string;
  private description: string | null;
  private priority: number;
  private status: ProjectStatus;
  private readonly departmentId: string;
  private readonly creatorId: string;
  private isArchivedFlag: boolean;
  private readonly createdAt: Date;
  private updatedAt: Date;

  /**
   * Private constructor - use factory method Project.create()
   * Ensures all projects go through validation
   */
  private constructor(data: ProjectData) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.priority = data.priority;
    this.status = data.status;
    this.departmentId = data.departmentId;
    this.creatorId = data.creatorId;
    this.isArchivedFlag = data.isArchived;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Factory method for creating new projects
   * Enforces all business rules (AC3, BR1, BR2, BR3)
   *
   * @param input - Project creation data
   * @returns New Project instance
   * @throws InvalidProjectNameError if name validation fails
   * @throws InvalidPriorityError if priority is out of range
   * @throws InvalidProjectDataError if required fields missing
   */
  static create(input: CreateProjectData): Project {
    // Validate required fields
    if (!input.creatorId) {
      throw new InvalidProjectDataError('Creator ID is required');
    }
    if (!input.departmentId) {
      throw new InvalidProjectDataError('Department ID is required');
    }

    // AC3 & BR1: Project name must be given and not empty/whitespace
    if (!input.name) {
      throw new InvalidProjectNameError('Project name is required');
    }

    const trimmedName = input.name.trim();
    if (trimmedName.length === 0) {
      throw new InvalidProjectNameError(
        'Project name cannot be empty or whitespace'
      );
    }

    // BR2: Name max length validation
    if (trimmedName.length > 100) {
      throw new InvalidProjectNameError(
        'Project name must not exceed 100 characters'
      );
    }

    // BR3: Priority validation (1-10)
    const priority = input.priority ?? 5; // Default to 5
    if (priority < 1 || priority > 10) {
      throw new InvalidPriorityError('Priority must be between 1 and 10');
    }

    // Process description (trim or null)
    let description: string | null = null;
    if (input.description && input.description.trim().length > 0) {
      description = input.description.trim();
    }

    // Default status to ACTIVE (matches Prisma schema default)
    const status = input.status ?? ProjectStatus.ACTIVE;

    const now = new Date();

    return new Project({
      id: crypto.randomUUID(),
      name: trimmedName,
      description,
      priority,
      status,
      departmentId: input.departmentId,
      creatorId: input.creatorId,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstruct Project from database data
   * Used by repository when fetching from database
   */
  static fromData(data: ProjectData): Project {
    return new Project(data);
  }

  // ============================================
  // GETTERS - Public API for accessing project data
  // ============================================

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string | null {
    return this.description;
  }

  getPriority(): number {
    return this.priority;
  }

  getStatus(): ProjectStatus {
    return this.status;
  }

  getDepartmentId(): string {
    return this.departmentId;
  }

  getCreatorId(): string {
    return this.creatorId;
  }

  isArchived(): boolean {
    return this.isArchivedFlag;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  // ============================================
  // DOMAIN METHODS - Business logic operations
  // ============================================

  /**
   * Update project name
   * Validates name requirements
   */
  updateName(newName: string): void {
    const trimmedName = newName.trim();

    if (trimmedName.length === 0) {
      throw new InvalidProjectNameError(
        'Project name cannot be empty or whitespace'
      );
    }

    if (trimmedName.length > 100) {
      throw new InvalidProjectNameError(
        'Project name must not exceed 100 characters'
      );
    }

    this.name = trimmedName;
    this.updatedAt = new Date();
  }

  /**
   * Update project description
   */
  updateDescription(newDescription: string | null): void {
    if (newDescription && newDescription.trim().length > 0) {
      this.description = newDescription.trim();
    } else {
      this.description = null;
    }
    this.updatedAt = new Date();
  }

  /**
   * Update project priority
   */
  updatePriority(newPriority: number): void {
    if (newPriority < 1 || newPriority > 10) {
      throw new InvalidPriorityError('Priority must be between 1 and 10');
    }
    this.priority = newPriority;
    this.updatedAt = new Date();
  }

  /**
   * Update project status
   */
  updateStatus(newStatus: ProjectStatus): void {
    this.status = newStatus;
    this.updatedAt = new Date();
  }

  /**
   * Archive the project
   */
  archive(): void {
    this.isArchivedFlag = true;
    this.updatedAt = new Date();
  }

  /**
   * Unarchive the project
   */
  unarchive(): void {
    this.isArchivedFlag = false;
    this.updatedAt = new Date();
  }
}
