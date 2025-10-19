import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client for broadcasting
const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_API_EXTERNAL_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const notificationSchema = z.object({
  type: z.enum(['info', 'success', 'warning', 'error']),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
});

export const notificationRouter = router({
  // Broadcast a notification to all connected clients
  broadcast: publicProcedure
    .input(notificationSchema)
    .mutation(async ({ input }) => {
      const supabase = getSupabaseAdmin();

      const payload = {
        type: input.type,
        title: input.title,
        message: input.message,
        broadcast_at: new Date().toISOString(),
      };

      // Send broadcast via Supabase Realtime
      const channel = supabase.channel('notifications');

      await channel.subscribe();

      const result = await channel.send({
        type: 'broadcast',
        event: 'notification',
        payload,
      });

      // Clean up
      await supabase.removeChannel(channel);

      if (result === 'ok') {
        return {
          success: true,
          message: 'Notification broadcasted successfully',
          payload,
        };
      } else {
        throw new Error('Failed to broadcast notification');
      }
    }),

  // Send a test notification
  sendTest: publicProcedure.mutation(async () => {
    const supabase = getSupabaseAdmin();

    const payload = {
      type: 'info' as const,
      title: 'Test Notification',
      message: 'This is a test notification from the server',
      broadcast_at: new Date().toISOString(),
    };

    const channel = supabase.channel('notifications');
    await channel.subscribe();

    const result = await channel.send({
      type: 'broadcast',
      event: 'notification',
      payload,
    });

    await supabase.removeChannel(channel);

    return {
      success: result === 'ok',
      message:
        result === 'ok'
          ? 'Test notification sent'
          : 'Failed to send test notification',
      payload,
    };
  }),

  getNotifications: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { userId } = input;
      const { prisma } = ctx;

      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return notifications;
    }),

  // Fetch unread notifications for display on login
  getUnreadNotifications: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { userId } = input;
      const { prisma } = ctx;

      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          isRead: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 10, // Limit to most recent 10 unread notifications
      });

      return notifications;
    }),

  // Mark notifications as read
  markAsRead: publicProcedure
    .input(z.object({ notificationIds: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      const { notificationIds } = input;
      const { prisma } = ctx;

      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
        },
        data: {
          isRead: true,
        },
      });

      return { success: true, count: notificationIds.length };
    }),

  // Get count of unread notifications (lightweight, just count)
  getUnreadCount: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { userId } = input;
      const { prisma } = ctx;

      const count = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });

      return { count };
    }),
});
