import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { UserManagementService } from '../services/UserManagementService';

/**
 * User Management Router
 *
 * Handles full user lifecycle including Supabase auth and database profiles
 */
export const userManagementRouter = router({
  /**
   * Create a new user with auth account and profile
   */
  createUser: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        name: z.string().min(1, 'Name is required'),
        role: z.enum(['STAFF', 'MANAGER', 'HR_ADMIN']).optional(),
        departmentId: z.string(),
        isHrAdmin: z.boolean().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new UserManagementService(ctx.prisma);
      return service.createUser(input);
    }),

  /**
   * Update existing user (profile and/or auth)
   */
  updateUser: publicProcedure
    .input(
      z.object({
        id: z.string(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
        name: z.string().optional(),
        role: z.enum(['STAFF', 'MANAGER', 'HR_ADMIN']).optional(),
        departmentId: z.string().optional(),
        isActive: z.boolean().optional(),
        isHrAdmin: z.boolean().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new UserManagementService(ctx.prisma);
      const { id, ...data } = input;
      return service.updateUser(id, data);
    }),

  /**
   * Deactivate user (soft delete)
   */
  deactivateUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const service = new UserManagementService(ctx.prisma);
      return service.deactivateUser(input.id);
    }),

  /**
   * Reactivate a deactivated user
   */
  reactivateUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const service = new UserManagementService(ctx.prisma);
      return service.reactivateUser(input.id);
    }),

  /**
   * Permanently delete user (irreversible)
   */
  deleteUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const service = new UserManagementService(ctx.prisma);
      return service.deleteUser(input.id);
    }),

  /**
   * Get all users
   */
  getAllUsers: publicProcedure
    .input(z.object({ includeInactive: z.boolean().optional() }))
    .query(({ ctx, input }) => {
      const service = new UserManagementService(ctx.prisma);
      return service.getAllUsers(input.includeInactive);
    }),

  /**
   * Reset user password (admin function)
   */
  resetUserPassword: publicProcedure
    .input(
      z.object({
        id: z.string(),
        newPassword: z.string().min(6),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new UserManagementService(ctx.prisma);
      return service.resetUserPassword(input.id, input.newPassword);
    }),
});
