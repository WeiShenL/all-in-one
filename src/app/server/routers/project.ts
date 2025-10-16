import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { ProjectService } from '../services/ProjectService';
import { ProjectStatus } from '@prisma/client';

/**
 * Project Router
 *
 * Thin tRPC wrapper that delegates to ProjectService
 */
export const projectRouter = router({
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
      const service = new ProjectService(ctx.prisma);
      return service.getAll(input);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const service = new ProjectService(ctx.prisma);
      return service.getById(input.id);
    }),

  getByDepartment: publicProcedure
    .input(z.object({ departmentId: z.string() }))
    .query(({ ctx, input }) => {
      const service = new ProjectService(ctx.prisma);
      return service.getByDepartment(input.departmentId);
    }),

  getByCreator: publicProcedure
    .input(z.object({ creatorId: z.string() }))
    .query(({ ctx, input }) => {
      const service = new ProjectService(ctx.prisma);
      return service.getByCreator(input.creatorId);
    }),

  getByStatus: publicProcedure
    .input(z.object({ status: z.nativeEnum(ProjectStatus) }))
    .query(({ ctx, input }) => {
      const service = new ProjectService(ctx.prisma);
      return service.getByStatus(input.status);
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string(),
        priority: z.number().int().min(1).max(10).optional(),
        dueDate: z.string().datetime(),
        departmentId: z.string(),
        creatorId: z.string(),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new ProjectService(ctx.prisma);
      return service.create({
        ...input,
        dueDate: new Date(input.dueDate),
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        priority: z.number().int().min(1).max(10).optional(),
        dueDate: z.string().datetime().optional(),
        status: z.nativeEnum(ProjectStatus).optional(),
        isArchived: z.boolean().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new ProjectService(ctx.prisma);
      const { id, dueDate, ...data } = input;
      return service.update(id, {
        ...data,
        ...(dueDate && { dueDate: new Date(dueDate) }),
      });
    }),

  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(ProjectStatus),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new ProjectService(ctx.prisma);
      return service.updateStatus(input.id, input.status);
    }),

  archive: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const service = new ProjectService(ctx.prisma);
      return service.archive(input.id);
    }),

  unarchive: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const service = new ProjectService(ctx.prisma);
      return service.unarchive(input.id);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const service = new ProjectService(ctx.prisma);
      return service.delete(input.id);
    }),
});
