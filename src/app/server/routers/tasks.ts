import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TaskService } from '../services/TaskService';

export const taskRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().min(1, 'Description is required'),
        priority: z.number().min(1).max(10),
        dueDate: z.date(),
        assigneeIds: z.array(z.string()).min(1).max(5), // Mandatory: 1-5 assignees
        projectId: z.string().optional(),
        tags: z.array(z.string()).optional(),
        recurringInterval: z.number().positive().optional(),
        parentTaskId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const taskService = new TaskService(ctx.prisma);

      // Get user's profile to fetch department
      const userProfile = await ctx.prisma.userProfile.findUnique({
        where: { id: ctx.session.user.id },
        select: { departmentId: true },
      });

      if (!userProfile) {
        throw new Error('User profile not found');
      }

      return await taskService.create({
        ...input,
        ownerId: ctx.session.user.id,
        departmentId: userProfile.departmentId,
      });
    }),

  getMyTasks: protectedProcedure.query(async ({ ctx }) => {
    const taskService = new TaskService(ctx.prisma);
    return await taskService.getByOwner(ctx.session.user.id);
  }),

  getDepartmentTasks: protectedProcedure
    .input(z.object({ departmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const taskService = new TaskService(ctx.prisma);
      return await taskService.getByDepartment(input.departmentId);
    }),
});
