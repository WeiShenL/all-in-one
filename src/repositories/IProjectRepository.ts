/**
 * IProjectRepository Interface
 *
 * Repository pattern interface for Project persistence
 * This defines the contract that any Project repository implementation must follow
 *
 * SCRUM-30: Create New Project - Repository Layer
 */

import { Project } from '../domain/project/Project';

export interface IProjectRepository {
  // ============================================
  // CORE PROJECT OPERATIONS (Domain-driven)
  // ============================================

  /**
   * Create a new project in the database
   * @param project - Domain Project entity
   * @returns Created project ID
   */
  createProject(project: Project): Promise<{ id: string }>;

  /**
   * Check if a project name is unique globally (AC2)
   * @param name - Project name to check (case-insensitive)
   * @returns True if name is unique
   */
  isProjectNameUnique(name: string): Promise<boolean>;

  /**
   * Find a project by ID
   * @param id - Project ID
   * @returns Project or null if not found
   */
  getProjectById(id: string): Promise<{
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
  } | null>;

  /**
   * Get all projects in a department
   * @param departmentId - Department ID
   * @param includeArchived - Include archived projects
   * @returns Array of projects
   */
  getDepartmentProjects(
    departmentId: string,
    includeArchived?: boolean
  ): Promise<
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
  >;

  /**
   * Update an existing project
   * @param project - Domain Project entity with updated values
   */
  updateProject(project: Project): Promise<void>;

  /**
   * Delete a project (hard delete)
   * @param id - Project ID
   */
  deleteProject(id: string): Promise<void>;

  /**
   * Archive a project
   * @param id - Project ID
   */
  archiveProject(id: string): Promise<void>;

  /**
   * Get all projects with optional filters
   * @param filters - Optional filters for querying projects
   */
  getAllProjects(filters?: {
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
  >;

  /**
   * Get projects visible to a set of departments
   * A project is visible if project.departmentId is in the set OR there exists
   * a ProjectDepartmentAccess row linking the project to any department in the set.
   */
  getProjectsVisibleToDepartments(
    departmentIds: string[],
    options?: { isArchived?: boolean }
  ): Promise<
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
  >;

  /**
   * Get all collaborators of a project (SCRUM-33)
   * Collaborators are users assigned to tasks in the project
   * @param projectId - Project ID
   * @returns Array of unique users assigned to project tasks
   */
  getProjectCollaborators(projectId: string): Promise<
    Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      departmentId: string;
      isHrAdmin: boolean;
      isActive: boolean;
    }>
  >;

  /**
   * Remove a collaborator from all project tasks (SCRUM-33)
   * @param projectId - Project ID
   * @param userId - User ID to remove
   */
  removeProjectCollaborator(projectId: string, userId: string): Promise<void>;
}
