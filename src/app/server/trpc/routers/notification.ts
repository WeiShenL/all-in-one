import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc';
import { prisma } from '@/app/lib/prisma';

const getNotificationsInput = z.object({
  userId: z.string(),
});

export const notificationRouter = router({
  getNotifications: protectedProcedure
    .input(getNotificationsInput)
    .query(
      async ({ input }: { input: z.infer<typeof getNotificationsInput> }) => {
        const notifications = await prisma.notification.findMany({
          where: {
            userId: input.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        return notifications;
      }
    ),
});
