import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { UserProfileService } from '../services/UserProfileService';

/**
 * UserProfile Router
 *
 * Thin tRPC wrapper that delegates to UserProfileService
 */
export const userProfileRouter = router({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const service = new UserProfileService(ctx.prisma);
      return service.getById(input.id);
    }),

  getByEmail: publicProcedure
    .input(z.object({ email: z.string() }))
    .query(({ ctx, input }) => {
      const service = new UserProfileService(ctx.prisma);
      return service.getByEmail(input.email);
    }),

  findByEmails: publicProcedure
    .input(z.object({ emails: z.array(z.string().email()) }))
    .mutation(async ({ ctx, input }) => {
      // Find all users with the given emails
      const users = await ctx.prisma.userProfile.findMany({
        where: {
          email: { in: input.emails },
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });
      return users.map(u => u.id);
    }),

  getByDepartment: publicProcedure
    .input(z.object({ departmentId: z.string() }))
    .query(({ ctx, input }) => {
      const service = new UserProfileService(ctx.prisma);
      return service.getByDepartment(input.departmentId);
    }),

  getByRole: publicProcedure
    .input(z.object({ role: z.enum(['STAFF', 'MANAGER', 'HR_ADMIN']) }))
    .query(({ ctx, input }) => {
      const service = new UserProfileService(ctx.prisma);
      return service.getByRole(input.role);
    }),

  getAll: publicProcedure.query(({ ctx }) => {
    const service = new UserProfileService(ctx.prisma);
    return service.getAll();
  }),

  create: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        role: z.enum(['STAFF', 'MANAGER', 'HR_ADMIN']).optional(),
        departmentId: z.string(),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new UserProfileService(ctx.prisma);
      return service.create(input);
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        email: z.string().email().optional(),
        name: z.string().optional(),
        role: z.enum(['STAFF', 'MANAGER', 'HR_ADMIN']).optional(),
        departmentId: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new UserProfileService(ctx.prisma);
      const { id, ...data } = input;
      return service.update(id, data);
    }),

  deactivate: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const service = new UserProfileService(ctx.prisma);
      return service.deactivate(input.id);
    }),

  assignToDepartment: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        departmentId: z.string(),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new UserProfileService(ctx.prisma);
      return service.assignToDepartment(input.userId, input.departmentId);
    }),
});
