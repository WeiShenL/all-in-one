import { NextResponse } from 'next/server';
import { TaskNotificationService } from '@/app/server/services/TaskNotificationService';
import { NotificationService } from '@/app/server/services/NotificationService';
import { RealtimeService } from '@/app/server/services/RealtimeService';
import { EmailService } from '@/app/server/services/EmailService';
import { prisma } from '@/app/lib/prisma'; // Import prisma

export async function GET() {
  try {
    const emailService = new EmailService();
    const realtimeService = new RealtimeService();
    const notificationService = new NotificationService(prisma, emailService); // Pass prisma and emailService
    const taskNotificationService = new TaskNotificationService(
      prisma,
      notificationService,
      realtimeService,
      emailService
    );

    await taskNotificationService.sendDeadlineReminders();

    return NextResponse.json({ message: 'Cron job completed successfully.' });
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json(
      { message: 'Cron job failed.' },
      { status: 500 }
    );
  }
}
