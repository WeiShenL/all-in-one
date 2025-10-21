import { router, publicProcedure, protectedProcedure, Context } from '../trpc';
import { z } from 'zod';
import { PrismaProjectRepository } from '@/repositories/PrismaProjectRepository';
import { ProjectService } from '@/services/project/ProjectService';
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
    role: user.role as 'STAFF' | 'MANAGER' | 'HR_ADMIN',
  };
}

/**
 * Project Router - All operations using DDD architecture
 *
 * Architecture:
 * - Domain Layer: Project entity with business rules
 * - Repository Layer: PrismaProjectRepository
 * - Service Layer: ProjectService with orchestration
 */
export const projectRouter = router({
  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Get all projects with optional filters
   */
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
    .query(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.prisma);
      const service = new ProjectService(repo);
      return service.getAllProjects(input);
    }),

  /**
   * Get project by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.prisma);
      const service = new ProjectService(repo);
      return service.getProjectById(input.id);
    }),

  /**
   * Get projects by department
   */
  getByDepartment: publicProcedure
    .input(z.object({ departmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.prisma);
      const service = new ProjectService(repo);
      return service.getAllProjects({ departmentId: input.departmentId });
    }),

  /**
   * Get projects by creator
   */
  getByCreator: publicProcedure
    .input(z.object({ creatorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.prisma);
      const service = new ProjectService(repo);
      return service.getProjectsByCreator(input.creatorId);
    }),

  /**
   * Get projects by status
   */
  getByStatus: publicProcedure
    .input(z.object({ status: z.nativeEnum(ProjectStatus) }))
    .query(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.prisma);
      const service = new ProjectService(repo);
      return service.getProjectsByStatus(input.status);
    }),

  /**
   * Get projects visible to the authenticated user
   */
  getVisible: protectedProcedure
    .input(
      z
        .object({
          isArchived: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.prisma);
      const service = new ProjectService(repo);
      const user = await getUserContext(ctx);

      // Reuse department hierarchy logic from TaskService via ctx-bound helper
      const { TaskService } = await import('../services/TaskService');
      const taskService = new TaskService(ctx.prisma);

      return service.getVisibleProjectsForUser(
        user,
        {
          getSubordinateDepartments: (id: string) =>
            taskService.getSubordinateDepartments(id),
        },
        { isArchived: input?.isArchived }
      );
    }),

  // ============================================
  // CREATE OPERATION (Teammate's implementation)
  // ============================================

  /**
   * Create a new project
   * Uses DDD architecture with domain validation
   */
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
      const service = new ProjectService(repo);
      const user = await getUserContext(ctx);

      const result = await service.createProject(
        {
          name: input.name,
          description: input.description,
          priority: input.priority,
        },
        user
      );

      return result; // { id, name }
    }),

  // ============================================
  // UPDATE OPERATIONS
  // ============================================

  /**
   * Update a project
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        priority: z.number().int().min(1).max(10).optional(),
        status: z.nativeEnum(ProjectStatus).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.prisma);
      const service = new ProjectService(repo);
      const user = await getUserContext(ctx);

      const { id, ...data } = input;
      await service.updateProject(id, data, user);

      return { success: true };
    }),

  /**
   * Update project status
   */
  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(ProjectStatus),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.prisma);
      const service = new ProjectService(repo);
      const user = await getUserContext(ctx);

      await service.updateProject(input.id, { status: input.status }, user);

      return { success: true };
    }),

  /**
   * Archive a project
   */
  archive: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.prisma);
      const service = new ProjectService(repo);

      await service.archiveProject(input.id);

      return { success: true };
    }),

  /**
   * Unarchive a project
   */
  unarchive: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.prisma);
      const service = new ProjectService(repo);

      await service.unarchiveProject(input.id);

      return { success: true };
    }),

  /**
   * Delete a project
   */
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.prisma);
      const service = new ProjectService(repo);

      await service.deleteProject(input.id);

      return { success: true };
    }),
});
