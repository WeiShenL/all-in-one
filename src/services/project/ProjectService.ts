/**
 * ProjectService - Service Layer for Project Operations
 *
 * Service orchestration layer that coordinates:
 * - Authorization validation
 * - External business rules (uniqueness checks)
 * - Domain entity creation
 * - Repository persistence
 *
 * SCRUM-30: Create New Project - Service Implementation
 */

import { Project, ProjectStatus } from '../../domain/project/Project';
import { IProjectRepository } from '../../repositories/IProjectRepository';

/**
 * Input DTO for project creation
 * (Data Transfer Object from API layer)
 */
export interface CreateProjectInput {
  name: string;
  description?: string;
  priority?: number;
}

/**
 * User context for authorization
 */
export interface UserContext {
  userId: string;
  departmentId: string;
  role: 'STAFF' | 'MANAGER' | 'ADMIN';
}

/**
 * Result DTO for project creation
 * (Returned to API layer for AC4 confirmation message)
 */
export interface CreateProjectResult {
  id: string;
  name: string;
}

export class ProjectService {
  constructor(private projectRepository: IProjectRepository) {}

  /**
   * Create a new project (AC1)
   *
   * Service Orchestration Flow:
   * 1. Authorization validation (user must have userId and departmentId)
   * 2. External validation (uniqueness check - AC2)
   * 3. Domain entity creation (business rules - AC3)
   * 4. Repository persistence
   * 5. Return result for confirmation (AC4)
   *
   * @param input - Project creation input
   * @param user - User context for authorization
   * @returns Created project ID and name
   * @throws Error if validation fails
   */
  async createProject(
    input: CreateProjectInput,
    user: UserContext
  ): Promise<CreateProjectResult> {
    // ============================================
    // STEP 1: Authorization Validation
    // ============================================
    // WHY: Ensure user is authenticated and associated with a department
    // WHEN: Before any business logic or database queries
    if (!user.userId) {
      throw new Error('User ID is required to create a project');
    }

    if (!user.departmentId) {
      throw new Error('Department ID is required to create a project');
    }

    // ============================================
    // STEP 2: Name Uniqueness Check (AC2)
    // ============================================
    // WHY: Prevent duplicate project names globally across the database
    // WHEN: Before creating the domain entity (fail fast)
    // NOTE: Name is trimmed before checking (matches domain behavior)
    const trimmedName = input.name?.trim() || '';

    const isUnique =
      await this.projectRepository.isProjectNameUnique(trimmedName);

    if (!isUnique) {
      throw new Error(
        `A project named "${trimmedName}" already exists. Please choose a different name.`
      );
    }

    // ============================================
    // STEP 3: Domain Entity Creation (AC3)
    // ============================================
    // WHY: Enforce all domain-level business rules (name validation, priority, etc.)
    // WHEN: After external validations pass
    // NOTE: Domain layer will throw InvalidProjectNameError if name is empty/invalid
    const project = Project.create({
      name: input.name,
      description: input.description,
      priority: input.priority,
      creatorId: user.userId,
      departmentId: user.departmentId,
      // status defaults to PLANNING in domain
      // priority defaults to 5 in domain
    });

    // ============================================
    // STEP 4: Repository Persistence
    // ============================================
    // WHY: Save the domain entity to the database
    // WHEN: After all validations and domain creation succeed
    const result = await this.projectRepository.createProject(project);

    // ============================================
    // STEP 5: Return Result (AC4)
    // ============================================
    // WHY: Provide data for confirmation message in UI
    // RETURN: ID for navigation, name for display
    return {
      id: result.id,
      name: project.getName(),
    };
  }

  /**
   * Get all projects in user's department
   * (For listing projects in UI)
   */
  async getDepartmentProjects(
    user: UserContext,
    includeArchived = false
  ): Promise<
    Array<{
      id: string;
      name: string;
      description: string | null;
      priority: number;
      status: string;
      creatorId: string;
      isArchived: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    if (!user.departmentId) {
      throw new Error('Department ID is required');
    }

    return this.projectRepository.getDepartmentProjects(
      user.departmentId,
      includeArchived
    );
  }

  /**
   * Get a project by ID
   * (For viewing project details)
   */
  async getProjectById(projectId: string): Promise<{
    id: string;
    name: string;
    description: string | null;
    priority: number;
    status: string;
    departmentId: string;
    creatorId: string;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    return this.projectRepository.getProjectById(projectId);
  }

  /**
   * Update a project
   * (For editing project details)
   */
  async updateProject(
    projectId: string,
    input: {
      name?: string;
      description?: string;
      priority?: number;
      status?: string;
    },
    _user: UserContext
  ): Promise<void> {
    // Get existing project
    const existingProjectData =
      await this.projectRepository.getProjectById(projectId);
    if (!existingProjectData) {
      throw new Error('Project not found');
    }

    // If name is being changed, check uniqueness
    if (input.name && input.name.trim() !== existingProjectData.name) {
      const isUnique = await this.projectRepository.isProjectNameUnique(
        input.name.trim()
      );
      if (!isUnique) {
        throw new Error(
          `A project named "${input.name.trim()}" already exists. Please choose a different name.`
        );
      }
    }

    // Reconstruct domain entity with existing data
    const project = Project.fromData({
      ...existingProjectData,
      status: existingProjectData.status as ProjectStatus,
    });

    // Update fields
    if (input.name !== undefined) {
      project.updateName(input.name);
    }
    if (input.description !== undefined) {
      project.updateDescription(input.description);
    }
    if (input.priority !== undefined) {
      project.updatePriority(input.priority);
    }
    if (input.status !== undefined) {
      project.updateStatus(input.status as any);
    }

    // Persist changes
    await this.projectRepository.updateProject(project);
  }

  /**
   * Archive a project
   */
  async archiveProject(projectId: string): Promise<void> {
    await this.projectRepository.archiveProject(projectId);
  }

  /**
   * Unarchive a project
   */
  async unarchiveProject(projectId: string): Promise<void> {
    const project = await this.projectRepository.getProjectById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const reconstructed = Project.fromData({
      ...project,
      status: project.status as ProjectStatus,
      isArchived: false,
    });

    await this.projectRepository.updateProject(reconstructed);
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.projectRepository.deleteProject(projectId);
  }

  /**
   * Get all projects with optional filters
   */
  async getAllProjects(filters?: {
    departmentId?: string;
    creatorId?: string;
    status?: string;
    isArchived?: boolean;
  }): Promise<
    Array<{
      id: string;
      name: string;
      description: string | null;
      priority: number;
      status: string;
      departmentId: string;
      creatorId: string;
      isArchived: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    return this.projectRepository.getAllProjects(filters);
  }

  /**
   * Get projects by creator
   */
  async getProjectsByCreator(creatorId: string): Promise<
    Array<{
      id: string;
      name: string;
      description: string | null;
      priority: number;
      status: string;
      creatorId: string;
      isArchived: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    return this.projectRepository.getAllProjects({ creatorId });
  }

  /**
   * Get projects by status
   */
  async getProjectsByStatus(status: string): Promise<
    Array<{
      id: string;
      name: string;
      description: string | null;
      priority: number;
      status: string;
      creatorId: string;
      isArchived: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    return this.projectRepository.getAllProjects({ status });
  }
}
