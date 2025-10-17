import { router, publicProcedure, Context } from '../trpc';
import { z } from 'zod';
import { PrismaProjectRepository } from '@/repositories/PrismaProjectRepository';
import { ProjectService } from '@/services/project/ProjectService';

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

export const projectRouter = router({
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

      // Return minimal data for confirmation message
      return result; // { id, name }
    }),
});
