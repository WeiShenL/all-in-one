import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const userProfileRouter = router({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.prisma.userProfile.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          departmentId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return profile;
    }),
});
