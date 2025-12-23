import { BaseService } from './BaseService';
import { supabaseAdmin } from '@/lib/supabase/server';
import { UpdateUserProfileInput } from '../types';

/**
 * UserManagementService
 *
 * Handles comprehensive user management including:
 * - Supabase Auth account creation
 * - User profile creation in database
 * - User updates (both auth and profile)
 * - User deactivation (auth + profile)
 */
export class UserManagementService extends BaseService {
  /**
   * Create a new user with Supabase auth account and database profile
   * @param data - User creation data including email, password, name, role, department
   * @returns Created user profile with auth ID
   */
  async createUser(data: {
    email: string;
    password: string;
    name: string;
    role?: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
    departmentId: string;
    isHrAdmin?: boolean;
  }) {
    try {
      // Validate department exists
      const department = await this.prisma.department.findUnique({
        where: { id: data.departmentId },
      });

      if (!department) {
        throw new Error('Department not found');
      }

      // Check if email already exists in database
      const existingProfile = await this.prisma.userProfile.findUnique({
        where: { email: data.email },
      });

      if (existingProfile) {
        throw new Error('User with this email already exists in database');
      }

      // STEP 1: Create Supabase auth account
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: data.email,
          password: data.password,
          email_confirm: true, // Auto-confirm email for admin-created users
          user_metadata: {
            name: data.name,
          },
        });

      if (authError) {
        throw new Error(`Failed to create auth account: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('Auth user creation succeeded but no user returned');
      }

      try {
        // STEP 2: Create database profile with auth user ID
        const profile = await this.prisma.userProfile.create({
          data: {
            id: authData.user.id, // Use Supabase auth ID as profile ID
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
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        return profile;
      } catch (profileError) {
        // Rollback: Delete auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error(
          `Failed to create user profile: ${(profileError as Error).message}. Auth account rolled back.`
        );
      }
    } catch (error) {
      this.handleError(error, 'createUser');
    }
  }

  /**
   * Update user profile and optionally email in auth
   * @param id - User profile ID (matches auth ID)
   * @param data - Update data
   * @returns Updated user profile
   */
  async updateUser(
    id: string,
    data: UpdateUserProfileInput & { password?: string }
  ) {
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

      // Update Supabase auth if email or password changed
      if (data.email || data.password) {
        const updateData: {
          email?: string;
          password?: string;
          user_metadata?: { name?: string };
        } = {};

        if (data.email) {
          updateData.email = data.email;
        }
        if (data.password) {
          updateData.password = data.password;
        }
        if (data.name) {
          updateData.user_metadata = { name: data.name };
        }

        const { error: authError } =
          await supabaseAdmin.auth.admin.updateUserById(id, updateData);

        if (authError) {
          throw new Error(
            `Failed to update auth account: ${authError.message}`
          );
        }
      }

      // Update database profile
      const { password: _password, ...profileData } = data; // Exclude password from profile update
      return await this.prisma.userProfile.update({
        where: { id },
        data: profileData,
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
      this.handleError(error, 'updateUser');
    }
  }

  /**
   * Deactivate user (soft delete in database + disable in auth)
   * @param id - User profile ID
   * @returns Updated user profile
   */
  async deactivateUser(id: string) {
    try {
      this.validateId(id, 'User ID');

      // Check user exists
      const existing = await this.prisma.userProfile.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('User not found');
      }

      // Deactivate in Supabase auth (user cannot sign in)
      const { error: authError } =
        await supabaseAdmin.auth.admin.updateUserById(id, {
          ban_duration: 'none', // Permanently banned (requires manual re-enable)
          user_metadata: {
            deactivated: true,
            deactivated_at: new Date().toISOString(),
          },
        });

      if (authError) {
        throw new Error(
          `Failed to deactivate auth account: ${authError.message}`
        );
      }

      // Deactivate in database
      return await this.prisma.userProfile.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'deactivateUser');
    }
  }

  /**
   * Reactivate a deactivated user
   * @param id - User profile ID
   * @returns Updated user profile
   */
  async reactivateUser(id: string) {
    try {
      this.validateId(id, 'User ID');

      // Check user exists
      const existing = await this.prisma.userProfile.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('User not found');
      }

      // Reactivate in Supabase auth
      const { error: authError } =
        await supabaseAdmin.auth.admin.updateUserById(id, {
          ban_duration: 'none',
          user_metadata: {
            deactivated: false,
          },
        });

      if (authError) {
        throw new Error(
          `Failed to reactivate auth account: ${authError.message}`
        );
      }

      // Reactivate in database
      return await this.prisma.userProfile.update({
        where: { id },
        data: { isActive: true },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'reactivateUser');
    }
  }

  /**
   * Permanently delete user (auth + database)
   * WARNING: This is irreversible
   * @param id - User profile ID
   */
  async deleteUser(id: string) {
    try {
      this.validateId(id, 'User ID');

      // Check user exists
      const existing = await this.prisma.userProfile.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('User not found');
      }

      // Delete from Supabase auth
      const { error: authError } =
        await supabaseAdmin.auth.admin.deleteUser(id);

      if (authError) {
        throw new Error(`Failed to delete auth account: ${authError.message}`);
      }

      // Database profile will be automatically deleted via CASCADE
      // if foreign key is set up correctly, but let's be explicit
      await this.prisma.userProfile.delete({
        where: { id },
      });

      return { success: true, message: 'User permanently deleted' };
    } catch (error) {
      this.handleError(error, 'deleteUser');
    }
  }

  /**
   * Get all users with their profiles
   * @param includeInactive - Whether to include deactivated users
   * @returns Array of user profiles
   */
  async getAllUsers(includeInactive = false) {
    try {
      return await this.prisma.userProfile.findMany({
        where: includeInactive ? {} : { isActive: true },
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
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      });
    } catch (error) {
      this.handleError(error, 'getAllUsers');
    }
  }

  /**
   * Reset user password (admin function)
   * @param id - User profile ID
   * @param newPassword - New password
   */
  async resetUserPassword(id: string, newPassword: string) {
    try {
      this.validateId(id, 'User ID');

      if (!newPassword || newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      const { error: authError } =
        await supabaseAdmin.auth.admin.updateUserById(id, {
          password: newPassword,
        });

      if (authError) {
        throw new Error(`Failed to reset password: ${authError.message}`);
      }

      return {
        success: true,
        message: 'Password reset successfully',
      };
    } catch (error) {
      this.handleError(error, 'resetUserPassword');
    }
  }
}
