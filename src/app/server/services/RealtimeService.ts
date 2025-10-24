import { createClient } from '@supabase/supabase-js';
import type { RealtimeNotification } from '@/types/notification';

export interface RealtimeTaskUpdate {
  type: 'task_assigned' | 'task_updated' | 'task_deleted';
  taskId: string;
  userId: string;
  broadcast_at?: string;
}

export class RealtimeService {
  private supabase;

  constructor() {
    if (
      !process.env.NEXT_PUBLIC_API_EXTERNAL_URL ||
      !process.env.NEXT_PUBLIC_ANON_KEY
    ) {
      throw new Error(
        'Supabase URL and/or Anon Key are not defined in environment variables'
      );
    }
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_API_EXTERNAL_URL,
      process.env.NEXT_PUBLIC_ANON_KEY,
      {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      }
    );
  }

  /**
   * Send notification to user-specific channel
   * Matches frontend channel: `notifications:${userId}`
   */
  async sendNotification(userId: string, notification: RealtimeNotification) {
    try {
      // Create user-specific channel to match frontend subscription
      const channelName = `notifications:${userId}`;
      const channel = this.supabase.channel(channelName, {
        config: {
          broadcast: {
            self: true,
          },
        },
      });

      // Subscribe to channel
      await new Promise<void>((resolve, reject) => {
        channel.subscribe(status => {
          if (status === 'SUBSCRIBED') {
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            console.error(
              `❌ RealtimeService: Failed to subscribe to ${channelName}`
            );
            reject(new Error('Failed to subscribe to realtime channel'));
          } else if (status === 'TIMED_OUT') {
            console.error(
              `❌ RealtimeService: Channel ${channelName} subscription timed out`
            );
            reject(new Error('Channel subscription timed out'));
          }
        });
      });

      // Send notification
      const payload = {
        ...notification,
        broadcast_at: new Date().toISOString(),
      };

      const response = await channel.send({
        type: 'broadcast',
        event: 'notification',
        payload: payload,
      });

      // Cleanup: Remove channel after sending
      await this.supabase.removeChannel(channel);

      if (response !== 'ok') {
        console.error(
          `❌ Failed to send realtime notification to user ${userId}:`,
          response
        );
      }
    } catch (error) {
      console.error(
        `❌ Error sending realtime notification to user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Send task update to user-specific channel
   * Since Supabase realtime works best with frontend subscriptions,
   * we piggyback on the existing notification channel to trigger task updates
   */
  async sendTaskUpdate(userId: string, update: RealtimeTaskUpdate) {
    // Simply send the task update as a notification on the same channel
    // The frontend will distinguish by the payload structure
    try {
      await this.sendNotification(userId, {
        type: 'TASK_ASSIGNED', // Use existing notification type
        title: 'Task Update',
        message: 'Task list updated',
        taskId: update.taskId,
        userId: userId,
        broadcast_at: new Date().toISOString(),
        // Add custom field to identify this as a task update trigger
        metadata: { taskUpdateType: update.type },
      } as any);
    } catch (error) {
      console.error(
        `❌ Error sending realtime task update to user ${userId}:`,
        error
      );
      // Don't throw - task updates are non-critical
    }
  }
}
