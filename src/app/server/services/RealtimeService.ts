import { createClient } from '@supabase/supabase-js';
import type { RealtimeNotification } from '@/types/notification';
import type { RealtimeChannel } from '@supabase/supabase-js';

export class RealtimeService {
  private supabase;
  private channel: RealtimeChannel | null = null;

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
   * Ensures the channel is subscribed before sending notifications
   */
  private async ensureChannelSubscribed(): Promise<RealtimeChannel> {
    if (this.channel) {
      return this.channel;
    }

    const channel = this.supabase.channel('notifications', {
      config: {
        broadcast: {
          self: true,
        },
      },
    });

    return new Promise((resolve, reject) => {
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          this.channel = channel;
          resolve(channel);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ RealtimeService: Failed to subscribe to channel');
          reject(new Error('Failed to subscribe to realtime channel'));
        } else if (status === 'TIMED_OUT') {
          console.error('❌ RealtimeService: Channel subscription timed out');
          reject(new Error('Channel subscription timed out'));
        }
      });
    });
  }

  async sendNotification(userId: string, notification: RealtimeNotification) {
    try {
      const channel = await this.ensureChannelSubscribed();

      const payload = {
        ...notification,
        broadcast_at: new Date().toISOString(),
      };

      const response = await channel.send({
        type: 'broadcast',
        event: 'notification',
        payload: payload,
      });

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
   * Cleanup method to unsubscribe from the channel
   */
  async cleanup() {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
