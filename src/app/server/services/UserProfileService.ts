import { BaseService } from './BaseService';
import { CreateUserProfileInput, UpdateUserProfileInput } from '../types';
import { UserRole } from '@prisma/client';

/**
 * UserProfileService
 *
 * Handles all business logic related to user profiles including:
 * - User CRUD operations
 * - Role management
 * - Department assignment
 * - User filtering and queries
 */
export class UserProfileService extends BaseService {
  /**
   * Get user profile by ID
   * @param id - User profile ID
   * @returns User profile or null
   */
  async getById(id: string) {
    try {
      this.validateId(id, 'User ID');

      return await this.prisma.userProfile.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          departmentId: true,
          isHrAdmin: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'getById');
    }
  }

  /**
   * Get user profile by email
   * @param email - User email
   * @returns User profile or null
   */
  async getByEmail(email: string) {
    try {
      if (!email || email.trim() === '') {
        throw new Error('Email is required');
      }

      return await this.prisma.userProfile.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          departmentId: true,
          isHrAdmin: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'getByEmail');
    }
  }

  /**
   * Get all users in a department
   * @param departmentId - Department ID
   * @returns Array of user profiles
   */
  async getByDepartment(departmentId: string) {
    try {
      this.validateId(departmentId, 'Department ID');

      return await this.prisma.userProfile.findMany({
        where: {
          departmentId,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          departmentId: true,
          isHrAdmin: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch (error) {
      this.handleError(error, 'getByDepartment');
    }
  }

  /**
   * Get all users with a specific role
   * @param role - User role
   * @returns Array of user profiles
   */
  async getByRole(role: UserRole) {
    try {
      return await this.prisma.userProfile.findMany({
        where: {
          role,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          departmentId: true,
          isHrAdmin: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch (error) {
      this.handleError(error, 'getByRole');
    }
  }

  /**
   * Get all active users
   * @returns Array of user profiles
   */
  async getAll() {
    try {
      return await this.prisma.userProfile.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          departmentId: true,
          isHrAdmin: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          createdAt: true,
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
   * Create a new user profile
   * @param data - User profile creation data
   * @returns Created user profile
   */
  async create(data: CreateUserProfileInput) {
    try {
      // Validate department exists
      const department = await this.prisma.department.findUnique({
        where: { id: data.departmentId },
      });

      if (!department) {
        throw new Error('Department not found');
      }

      // Check if email already exists
      const existingUser = await this.prisma.userProfile.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      return await this.prisma.userProfile.create({
        data: {
          email: data.email,
          name: data.name,
          role: data.role || 'STAFF',
          departmentId: data.departmentId,
          isHrAdmin: data.isHrAdmin || false,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          departmentId: true,
          isHrAdmin: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update user profile
   * @param id - User profile ID
   * @param data - User profile update data
   * @returns Updated user profile
   */
  async update(id: string, data: UpdateUserProfileInput) {
    try {
      this.validateId(id, 'User ID');

      // Check user exists
      const existing = await this.prisma.userProfile.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('User not found');
      }

      // Validate department if changing
      if (data.departmentId) {
        const department = await this.prisma.department.findUnique({
          where: { id: data.departmentId },
        });

        if (!department) {
          throw new Error('Department not found');
        }
      }

      // Check email uniqueness if changing
      if (data.email && data.email !== existing.email) {
        const emailExists = await this.prisma.userProfile.findUnique({
          where: { email: data.email },
        });

        if (emailExists) {
          throw new Error('User with this email already exists');
        }
      }

      return await this.prisma.userProfile.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          departmentId: true,
          isHrAdmin: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Deactivate a user (soft delete)
   * @param id - User profile ID
   * @returns Updated user profile
   */
  async deactivate(id: string) {
    try {
      this.validateId(id, 'User ID');

      return await this.prisma.userProfile.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
        },
      });
    } catch (error) {
      this.handleError(error, 'deactivate');
    }
  }

  /**
   * Assign user to a department
   * @param userId - User ID
   * @param departmentId - Department ID
   * @returns Updated user profile
   */
  async assignToDepartment(userId: string, departmentId: string) {
    try {
      this.validateId(userId, 'User ID');
      this.validateId(departmentId, 'Department ID');

      // Validate department exists
      const department = await this.prisma.department.findUnique({
        where: { id: departmentId },
      });

      if (!department) {
        throw new Error('Department not found');
      }

      return await this.prisma.userProfile.update({
        where: { id: userId },
        data: { departmentId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          departmentId: true,
          isHrAdmin: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'assignToDepartment');
    }
  }
}
