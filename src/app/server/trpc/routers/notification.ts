import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { prisma } from '@/app/lib/prisma';

export const notificationRouter = router({
  getNotifications: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const notifications = await prisma.notification.findMany({
        where: {
          userId: input.userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      return notifications;
    }),
});