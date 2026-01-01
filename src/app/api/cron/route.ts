import { NextResponse, NextRequest } from 'next/server';
import { TaskNotificationService } from '@/app/server/services/TaskNotificationService';
import { NotificationService } from '@/app/server/services/NotificationService';
import { RealtimeService } from '@/app/server/services/RealtimeService';
import { EmailService } from '@/app/server/services/EmailService';
import { prisma } from '@/app/lib/prisma';
import { createLogger } from '@/lib/logger';

const logger = createLogger('CronRoute');

export async function GET(request: NextRequest) {
  // 🔐 SECURITY: Verify request is from Vercel Cron or authorized source
  const authHeader = request.headers.get('authorization');
  const isDevelopment = process.env.NODE_ENV === 'development';
  const cronSecret = process.env.CRON_SECRET;

  // Always require CRON_SECRET, even in development (fail if not set)
  if (!cronSecret) {
    logger.error('CRON_SECRET not configured', undefined, {
      environment: process.env.NODE_ENV,
    });
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 }
    );
  }

  // Validate authorization header
  const expectedAuth = `Bearer ${cronSecret}`;
  if (authHeader !== expectedAuth) {
    // Enhanced security logging
    logger.security('Unauthorized cron attempt', {
      userAgent: request.headers.get('user-agent'),
      ip:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown',
      referer: request.headers.get('referer') || 'none',
      environment: isDevelopment ? 'development' : 'production',
      authProvided: !!authHeader,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    logger.info('Cron job started');

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

    logger.info('Cron job completed successfully');
    return NextResponse.json({
      message: 'Cron job completed successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cron job failed', error);
    return NextResponse.json(
      {
        message: 'Cron job failed.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
