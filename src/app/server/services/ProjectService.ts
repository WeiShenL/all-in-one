import { BaseService } from './BaseService';
import {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectFilters,
} from '../types';
import { ProjectStatus } from '@prisma/client';

/**
 * ProjectService
 *
 * Handles all business logic related to projects including:
 * - Project CRUD operations
 * - Project status management
 * - Project filtering and queries
 */
export class ProjectService extends BaseService {
  /**
   * Get all projects with optional filters
   * @param filters - Optional filters for projects
   * @returns Array of projects
   */
  async getAll(filters?: ProjectFilters) {
    try {
      return await this.prisma.project.findMany({
        where: {
          departmentId: filters?.departmentId,
          creatorId: filters?.creatorId,
          status: filters?.status,
          isArchived: filters?.isArchived ?? false,
        },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          tasks: {
            where: {
              isArchived: false,
            },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      this.handleError(error, 'getAll');
    }
  }

  /**
   * Get project by ID with full details
   * @param id - Project ID
   * @returns Project or null
   */
  async getById(id: string) {
    try {
      this.validateId(id, 'Project ID');

      return await this.prisma.project.findUnique({
        where: { id },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          tasks: {
            where: {
              isArchived: false,
            },
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              assignments: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              dueDate: 'asc',
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'getById');
    }
  }

  /**
   * Get all projects in a department
   * @param departmentId - Department ID
   * @returns Array of projects
   */
  async getByDepartment(departmentId: string) {
    try {
      this.validateId(departmentId, 'Department ID');

      return await this.getAll({ departmentId });
    } catch (error) {
      this.handleError(error, 'getByDepartment');
    }
  }

  /**
   * Get all projects created by a user
   * @param creatorId - Creator user ID
   * @returns Array of projects
   */
  async getByCreator(creatorId: string) {
    try {
      this.validateId(creatorId, 'Creator ID');

      return await this.getAll({ creatorId });
    } catch (error) {
      this.handleError(error, 'getByCreator');
    }
  }

  /**
   * Get projects by status
   * @param status - Project status
   * @returns Array of projects
   */
  async getByStatus(status: ProjectStatus) {
    try {
      return await this.getAll({ status });
    } catch (error) {
      this.handleError(error, 'getByStatus');
    }
  }

  /**
   * Create a new project
   * @param data - Project creation data
   * @returns Created project
   */
  async create(data: CreateProjectInput) {
    try {
      // Validate department exists
      const department = await this.prisma.department.findUnique({
        where: { id: data.departmentId },
      });

      if (!department) {
        throw new Error('Department not found');
      }

      // Validate creator exists
      const creator = await this.prisma.userProfile.findUnique({
        where: { id: data.creatorId },
      });

      if (!creator || !creator.isActive) {
        throw new Error('Creator not found or inactive');
      }

      return await this.prisma.project.create({
        data: {
          name: data.name,
          description: data.description,
          priority: data.priority ?? 5,
          dueDate: data.dueDate,
          departmentId: data.departmentId,
          creatorId: data.creatorId,
        },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update a project
   * @param id - Project ID
   * @param data - Project update data
   * @returns Updated project
   */
  async update(id: string, data: UpdateProjectInput) {
    try {
      this.validateId(id, 'Project ID');

      // Check project exists
      const existing = await this.prisma.project.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('Project not found');
      }

      return await this.prisma.project.update({
        where: { id },
        data,
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Update project status
   * @param id - Project ID
   * @param status - New status
   * @returns Updated project
   */
  async updateStatus(id: string, status: ProjectStatus) {
    try {
      this.validateId(id, 'Project ID');

      return await this.update(id, { status });
    } catch (error) {
      this.handleError(error, 'updateStatus');
    }
  }

  /**
   * Archive a project
   * @param id - Project ID
   * @returns Updated project
   */
  async archive(id: string) {
    try {
      this.validateId(id, 'Project ID');

      return await this.update(id, { isArchived: true });
    } catch (error) {
      this.handleError(error, 'archive');
    }
  }

  /**
   * Unarchive a project
   * @param id - Project ID
   * @returns Updated project
   */
  async unarchive(id: string) {
    try {
      this.validateId(id, 'Project ID');

      return await this.update(id, { isArchived: false });
    } catch (error) {
      this.handleError(error, 'unarchive');
    }
  }

  /**
   * Delete a project (hard delete)
   * @param id - Project ID
   * @returns Deleted project
   */
  async delete(id: string) {
    try {
      this.validateId(id, 'Project ID');

      // Check if project has tasks
      const tasks = await this.prisma.task.findMany({
        where: { projectId: id },
      });

      if (tasks.length > 0) {
        throw new Error(
          'Cannot delete project with existing tasks. Archive it instead.'
        );
      }

      return await this.prisma.project.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }
}
