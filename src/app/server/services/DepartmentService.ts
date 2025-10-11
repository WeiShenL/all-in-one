import { BaseService } from './BaseService';
import {
  DepartmentWithLevel,
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from '../types';

/**
 * DepartmentService
 *
 * Handles all business logic related to departments including:
 * - Department CRUD operations
 * - Hierarchical department tree building
 * - Department filtering and queries
 */
export class DepartmentService extends BaseService {
  /**
   * Get all active departments with hierarchical structure
   * @returns Array of departments with level information
   */
  async getAll(): Promise<DepartmentWithLevel[]> {
    try {
      const departments = await this.prisma.department.findMany({
        select: {
          id: true,
          name: true,
          parentId: true,
        },
        where: {
          isActive: true,
        },
      });

      return this.buildHierarchy(departments);
    } catch (error) {
      throw this.handleError(error, 'getAll');
    }
  }

  /**
   * Get department by ID with full details
   * @param id - Department ID
   * @returns Department with related data or null
   */
  async getById(id: string) {
    try {
      this.validateId(id, 'Department ID');

      return await this.prisma.department.findUnique({
        where: { id },
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          children: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
            },
          },
          members: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'getById');
    }
  }

  /**
   * Get all child departments of a parent department
   * @param parentId - Parent department ID (null for root departments)
   * @returns Array of child departments
   */
  async getChildren(parentId: string | null) {
    try {
      return await this.prisma.department.findMany({
        where: {
          parentId: parentId,
          isActive: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch (error) {
      this.handleError(error, 'getChildren');
    }
  }

  /**
   * Get departments managed by a specific user
   * @param managerId - Manager user ID
   * @returns Array of departments
   */
  async getByManager(managerId: string) {
    try {
      this.validateId(managerId, 'Manager ID');

      return await this.prisma.department.findMany({
        where: {
          managerId: managerId,
          isActive: true,
        },
        include: {
          members: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'getByManager');
    }
  }

  /**
   * Create a new department
   * @param data - Department creation data
   * @returns Created department
   */
  async create(data: CreateDepartmentInput) {
    try {
      // Validate parent department exists if provided
      if (data.parentId) {
        const parent = await this.prisma.department.findUnique({
          where: { id: data.parentId },
        });

        if (!parent) {
          throw new Error('Parent department not found');
        }
      }

      // Validate manager exists if provided
      if (data.managerId) {
        const manager = await this.prisma.userProfile.findUnique({
          where: { id: data.managerId },
        });

        if (!manager) {
          throw new Error('Manager not found');
        }
      }

      return await this.prisma.department.create({
        data: {
          name: data.name,
          parentId: data.parentId,
          managerId: data.managerId,
        },
      });
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update an existing department
   * @param id - Department ID
   * @param data - Department update data
   * @returns Updated department
   */
  async update(id: string, data: UpdateDepartmentInput) {
    try {
      this.validateId(id, 'Department ID');

      // Check department exists
      const existing = await this.prisma.department.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('Department not found');
      }

      // Validate parent department if changing
      if (data.parentId !== undefined && data.parentId !== null) {
        // Prevent circular reference
        if (data.parentId === id) {
          throw new Error('Department cannot be its own parent');
        }

        const parent = await this.prisma.department.findUnique({
          where: { id: data.parentId },
        });

        if (!parent) {
          throw new Error('Parent department not found');
        }
      }

      return await this.prisma.department.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Soft delete a department (set isActive to false)
   * @param id - Department ID
   * @returns Updated department
   */
  async delete(id: string) {
    try {
      this.validateId(id, 'Department ID');

      // Check if department has active children
      const children = await this.prisma.department.findMany({
        where: {
          parentId: id,
          isActive: true,
        },
      });

      if (children.length > 0) {
        throw new Error(
          'Cannot delete department with active child departments'
        );
      }

      return await this.prisma.department.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Build hierarchical department tree with level information
   * @param departments - Flat array of departments
   * @returns Hierarchical array with level information
   * @private
   */
  private buildHierarchy(
    departments: Array<{ id: string; name: string; parentId: string | null }>
  ): DepartmentWithLevel[] {
    const result: DepartmentWithLevel[] = [];

    const addDepartmentAndChildren = (
      parentId: string | null,
      level: number
    ) => {
      const children = departments
        .filter(d => d.parentId === parentId)
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const child of children) {
        result.push({
          id: child.id,
          name: child.name,
          parentId: child.parentId,
          level,
        });
        addDepartmentAndChildren(child.id, level + 1);
      }
    };

    // Start from root departments (parentId = null)
    addDepartmentAndChildren(null, 0);

    return result;
  }
}
