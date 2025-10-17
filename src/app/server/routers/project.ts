import { router, publicProcedure, Context } from '../trpc';
import { z } from 'zod';
import { PrismaProjectRepository } from '@/repositories/PrismaProjectRepository';
import { ProjectService as NewProjectService } from '@/services/project/ProjectService';
import { ProjectService as OldProjectService } from '../services/ProjectService';
import { ProjectStatus } from '@prisma/client';

async function getUserContext(ctx: Context) {
  if (!ctx.userId) {
    throw new Error('User not authenticated');
  }
  const user = await ctx.prisma.userProfile.findUnique({
    where: { id: ctx.userId },
  });
  if (!user) {
    throw new Error('User profile not found');
  }
  return {
    userId: ctx.userId,
    departmentId: user.departmentId,
    role: user.role as 'STAFF' | 'MANAGER' | 'ADMIN',
  };
}

/**
 * Project Router
 *
 * Combines:
 * - Create operation using new DDD architecture (from teammate)
 * - Read operations using existing service layer (your code)
 * - Update operations using existing service layer (your code)
 */
export const projectRouter = router({
  // ============================================
  // READ OPERATIONS (Your code - using old service)
  // ============================================
  getAll: publicProcedure
    .input(
      z
        .object({
          departmentId: z.string().optional(),
          creatorId: z.string().optional(),
          status: z.nativeEnum(ProjectStatus).optional(),
          isArchived: z.boolean().optional(),
        })
        .optional()
    )
    .query(({ ctx, input }) => {
      const service = new OldProjectService(ctx.prisma);
      return service.getAll(input);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const service = new OldProjectService(ctx.prisma);
      return service.getById(input.id);
    }),

  getByDepartment: publicProcedure
    .input(z.object({ departmentId: z.string() }))
    .query(({ ctx, input }) => {
      const service = new OldProjectService(ctx.prisma);
      return service.getByDepartment(input.departmentId);
    }),

  getByCreator: publicProcedure
    .input(z.object({ creatorId: z.string() }))
    .query(({ ctx, input }) => {
      const service = new OldProjectService(ctx.prisma);
      return service.getByCreator(input.creatorId);
    }),

  getByStatus: publicProcedure
    .input(z.object({ status: z.nativeEnum(ProjectStatus) }))
    .query(({ ctx, input }) => {
      const service = new OldProjectService(ctx.prisma);
      return service.getByStatus(input.status);
    }),

  // ============================================
  // CREATE OPERATION (Teammate's DDD architecture)
  // ============================================
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        priority: z.number().min(1).max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.prisma);
      const service = new NewProjectService(repo);
      const user = await getUserContext(ctx);

      const result = await service.createProject(
        {
          name: input.name,
          description: input.description,
          priority: input.priority,
        },
        user
      );

      // Return minimal data for confirmation message
      return result; // { id, name }
    }),

  // ============================================
  // UPDATE OPERATIONS (Your code - using old service)
  // ============================================
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        priority: z.number().int().min(1).max(10).optional(),
        status: z.nativeEnum(ProjectStatus).optional(),
        isArchived: z.boolean().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new OldProjectService(ctx.prisma);
      const { id, ...data } = input;
      return service.update(id, data);
    }),

  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(ProjectStatus),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new OldProjectService(ctx.prisma);
      return service.updateStatus(input.id, input.status);
    }),

  archive: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const service = new OldProjectService(ctx.prisma);
      return service.archive(input.id);
    }),

  unarchive: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const service = new OldProjectService(ctx.prisma);
      return service.unarchive(input.id);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const service = new OldProjectService(ctx.prisma);
      return service.delete(input.id);
    }),
});
