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
    const accessRows = await (
      this.prisma as any
    ).projectDepartmentAccess.findMany({
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
}
