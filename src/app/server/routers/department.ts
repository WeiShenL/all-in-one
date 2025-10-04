import { router, publicProcedure } from '../trpc';
import { DepartmentService } from '../services/DepartmentService';
import { z } from 'zod';

/**
 * Department Router
 *
 * Thin tRPC wrapper that delegates to DepartmentService
 */
export const departmentRouter = router({
  getAll: publicProcedure.query(({ ctx }) => {
    const service = new DepartmentService(ctx.prisma);
    return service.getAll();
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const service = new DepartmentService(ctx.prisma);
      return service.getById(input.id);
    }),

  getChildren: publicProcedure
    .input(z.object({ parentId: z.string().nullable() }))
    .query(({ ctx, input }) => {
      const service = new DepartmentService(ctx.prisma);
      return service.getChildren(input.parentId);
    }),

  getByManager: publicProcedure
    .input(z.object({ managerId: z.string() }))
    .query(({ ctx, input }) => {
      const service = new DepartmentService(ctx.prisma);
      return service.getByManager(input.managerId);
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string(),
        parentId: z.string().optional(),
        managerId: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new DepartmentService(ctx.prisma);
      return service.create(input);
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        parentId: z.string().nullable().optional(),
        managerId: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new DepartmentService(ctx.prisma);
      const { id, ...data } = input;
      return service.update(id, data);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const service = new DepartmentService(ctx.prisma);
      return service.delete(input.id);
    }),
});
