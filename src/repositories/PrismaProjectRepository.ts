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
   * Get projects visible to a set of departments.
   * Visible if project.departmentId in departmentIds OR has access row.
   */
  async getProjectsVisibleToDepartments(
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
  > {
    if (!departmentIds || departmentIds.length === 0) {
      return [];
    }

    // Step 1: Find projectIds that have explicit access via bridge table
    // Note: ProjectCollaborator may have multiple rows for same (projectId, departmentId)
    // because multiple users from same department can collaborate on same project
    // We use Set to deduplicate projectIds
    const accessRows = await (this.prisma as any).projectCollaborator.findMany({
      where: { departmentId: { in: departmentIds } },
      select: { projectId: true },
    });
    const accessProjectIds = Array.from(
      new Set(accessRows.map((r: { projectId: string }) => r.projectId))
    );

    // Step 2: Fetch projects where either primary department matches or explicit access exists
    const projects = await this.prisma.project.findMany({
      where: {
        OR: [
          { departmentId: { in: departmentIds } },
          accessProjectIds.length > 0
            ? { id: { in: accessProjectIds } }
            : undefined,
        ].filter(Boolean) as any,
        ...(options?.isArchived === undefined
          ? { isArchived: false }
          : { isArchived: options.isArchived }),
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
   * Get comprehensive project report data for export
   * Fetches project with all required relations: department, creator, tasks, collaborators
   *
   * Note: This is a read-heavy operation for reporting purposes
   * - Fetches project with department and creator
   * - Fetches all non-archived tasks with owners and assignments
   * - Fetches all collaborators with user and department info
   * - Can add stats in the future if needed (other user stories)
   */
  async getProjectReportData(projectId: string): Promise<{
    project: {
      id: string;
      name: string;
      description: string | null;
      priority: number;
      status: string;
      departmentName: string;
      creatorName: string;
      creatorEmail: string;
      createdAt: Date;
      updatedAt: Date;
    };
    tasks: Array<{
      id: string;
      title: string;
      description: string;
      status: string;
      priority: number;
      dueDate: Date;
      createdAt: Date;
      ownerName: string;
      ownerEmail: string;
      assignees: string[];
    }>;
    collaborators: Array<{
      name: string;
      email: string;
      departmentName: string;
      addedAt: Date;
    }>;
  }> {
    // Fetch project with department and creator relations
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        department: {
          select: { id: true, name: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Fetch all active tasks with owner and assignments
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        isArchived: false,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Fetch all collaborators with user and department info
    const collaborators = await this.prisma.projectCollaborator.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        addedAt: 'asc',
      },
    });

    // Transform and return formatted data
    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        priority: project.priority,
        status: project.status,
        departmentName: project.department.name,
        creatorName: project.creator.name,
        creatorEmail: project.creator.email,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        ownerName: task.owner.name,
        ownerEmail: task.owner.email,
        assignees: task.assignments.map(a => a.user.name),
      })),
      collaborators: collaborators.map(c => ({
        name: c.user.name,
        email: c.user.email,
        departmentName: c.department.name,
        addedAt: c.addedAt,
      })),
    };
  }
}
