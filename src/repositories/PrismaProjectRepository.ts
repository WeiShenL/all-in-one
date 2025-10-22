/**
 * PrismaProjectRepository Implementation
 *
 * This repository bridges the domain Project model and Prisma database layer.
 * It implements the IProjectRepository interface to provide database persistence
 * while keeping the domain layer clean and independent of infrastructure concerns.
 *
 * SCRUM-30: Create New Project - Prisma Repository Implementation
 */

import { PrismaClient, ProjectStatus } from '@prisma/client';
import { Project } from '../domain/project/Project';
import { IProjectRepository } from './IProjectRepository';

export class PrismaProjectRepository implements IProjectRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new project in the database
   * Persistence implementation for AC1
   */
  async createProject(project: Project): Promise<{ id: string }> {
    const result = await this.prisma.project.create({
      data: {
        id: project.getId(),
        name: project.getName(),
        description: project.getDescription(),
        priority: project.getPriority(),
        status: project.getStatus(),
        departmentId: project.getDepartmentId(),
        creatorId: project.getCreatorId(),
        isArchived: project.isArchived(),
        createdAt: project.getCreatedAt(),
        updatedAt: project.getUpdatedAt(),
      },
      select: {
        id: true,
      },
    });

    return { id: result.id };
  }

  /**
   * Check if project name is unique globally (AC2)
   *
   * WHY CASE-INSENSITIVE:
   * Business requirement - prevent confusion with similar names like
   * "Customer Portal" vs "customer portal"
   *
   * WHY GLOBAL UNIQUENESS:
   * Project names must be unique across the entire database
   * to avoid confusion and maintain clear project identification
   */
  async isProjectNameUnique(name: string): Promise<boolean> {
    const existingProject = await this.prisma.project.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive', // Case-insensitive comparison
        },
        isArchived: false, // Only check active projects
      },
    });

    return existingProject === null;
  }

  /**
   * Find a project by ID
   */
  async getProjectById(id: string): Promise<{
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
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        priority: true,
        status: true,
        departmentId: true,
        creatorId: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return project;
  }

  /**
   * Get all projects in a department
   */
  async getDepartmentProjects(
    departmentId: string,
    includeArchived = false
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
  > {
    const projects = await this.prisma.project.findMany({
      where: {
        departmentId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        priority: true,
        status: true,
        departmentId: true,
        creatorId: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return projects;
  }

  /**
   * Update an existing project
   */
  async updateProject(project: Project): Promise<void> {
    await this.prisma.project.update({
      where: { id: project.getId() },
      data: {
        name: project.getName(),
        description: project.getDescription(),
        priority: project.getPriority(),
        status: project.getStatus(),
        isArchived: project.isArchived(),
        updatedAt: project.getUpdatedAt(),
      },
    });
  }

  /**
   * Delete a project (hard delete)
   */
  async deleteProject(id: string): Promise<void> {
    await this.prisma.project.delete({
      where: { id },
    });
  }

  /**
   * Archive a project
   */
  async archiveProject(id: string): Promise<void> {
    await this.prisma.project.update({
      where: { id },
      data: {
        isArchived: true,
        updatedAt: new Date(),
      },
    });
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
    const projects = await this.prisma.project.findMany({
      where: {
        departmentId: filters?.departmentId,
        creatorId: filters?.creatorId,
        status: filters?.status as ProjectStatus | undefined,
        isArchived: filters?.isArchived ?? false,
      },
      select: {
        id: true,
        name: true,
        description: true,
        priority: true,
        status: true,
        departmentId: true,
        creatorId: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return projects;
  }

  /**
   * Get all collaborators of a project (SCRUM-33)
   * Returns unique users who are assigned to tasks in the project
   */
  async getProjectCollaborators(projectId: string): Promise<
    Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      departmentId: string;
      isHrAdmin: boolean;
      isActive: boolean;
    }>
  > {
    // Get all unique users assigned to tasks in this project
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId: projectId,
        isArchived: false,
      },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                departmentId: true,
                isHrAdmin: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    // Extract unique users from all task assignments
    const userMap = new Map();
    for (const task of tasks) {
      for (const assignment of task.assignments) {
        if (!userMap.has(assignment.user.id)) {
          userMap.set(assignment.user.id, assignment.user);
        }
      }
    }

    return Array.from(userMap.values());
  }

  /**
   * Remove a collaborator from all project tasks (SCRUM-33)
   * Removes user from all task assignments in the project
   */
  async removeProjectCollaborator(
    projectId: string,
    userId: string
  ): Promise<void> {
    // Get all tasks in the project where the user is assigned
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId: projectId,
        assignments: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        assignments: true,
      },
    });

    // For each task, check if it would have at least 1 assignee after removal
    for (const task of tasks) {
      const remainingAssignees = task.assignments.filter(
        a => a.userId !== userId
      );

      if (remainingAssignees.length === 0) {
        throw new Error(
          `Cannot remove user from task "${task.title}" - it must have at least one assignee`
        );
      }
    }

    // Remove the user from all task assignments in this project
    await this.prisma.taskAssignment.deleteMany({
      where: {
        userId: userId,
        task: {
          projectId: projectId,
        },
      },
    });

    // Notification is handled by the service/router layer
  }
}
