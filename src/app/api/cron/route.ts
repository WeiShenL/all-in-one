import { NextResponse, NextRequest } from 'next/server';
import { TaskNotificationService } from '@/app/server/services/TaskNotificationService';
import { NotificationService } from '@/app/server/services/NotificationService';
import { RealtimeService } from '@/app/server/services/RealtimeService';
import { EmailService } from '@/app/server/services/EmailService';
import { prisma } from '@/app/lib/prisma';

export async function GET(request: NextRequest) {
  // 🔐 SECURITY: Verify request is from Vercel Cron or authorized source
  const authHeader = request.headers.get('authorization');
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Skip auth check in development for easy local testing
  if (!isDevelopment) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('🚨 Unauthorized cron attempt:', {
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get('user-agent'),
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // eslint-disable-next-line no-console
    console.log('⏰ Cron job started:', new Date().toISOString());

    const emailService = new EmailService();
    const realtimeService = new RealtimeService();
    const notificationService = new NotificationService(prisma, emailService);
    const taskNotificationService = new TaskNotificationService(
      prisma,
      notificationService,
      realtimeService,
      emailService
    );

    await taskNotificationService.sendDeadlineReminders();

    // eslint-disable-next-line no-console
    console.log(
      '✅ Cron job completed successfully:',
      new Date().toISOString()
    );
    return NextResponse.json({
      message: 'Cron job completed successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Cron job failed:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        message: 'Cron job failed.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
