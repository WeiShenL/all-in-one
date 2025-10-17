
import { createClient } from '@supabase/supabase-js';
import type { RealtimeNotification } from '@/types/notification';

export class RealtimeService {
  private supabase;

  constructor() {
    if (!process.env.NEXT_PUBLIC_API_EXTERNAL_URL || !process.env.NEXT_PUBLIC_ANON_KEY) {
      throw new Error('Supabase URL and/or Anon Key are not defined in environment variables');
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

  async sendNotification(userId: string, notification: RealtimeNotification) {
    const channel = this.supabase.channel('notifications');
    await channel.send({
      type: 'broadcast',
      event: 'notification',
      payload: {
        ...notification,
        broadcast_at: new Date().toISOString(),
      },
    });
    console.warn(`Realtime notification sent to user ${userId}`, notification);
  }
}
