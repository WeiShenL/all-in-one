import { PrismaClient } from '@prisma/client';
import { differenceInHours } from 'date-fns';
import { NotificationService } from './NotificationService';
import { RealtimeService } from './RealtimeService';
import { EmailService } from './EmailService'; // Assuming EmailService is still needed for direct email sending

export class TaskNotificationService {
  private prisma: PrismaClient;
  private notificationService: NotificationService;
  private realtimeService: RealtimeService;
  private emailService: EmailService;

  constructor(
    prisma: PrismaClient,
    notificationService: NotificationService,
    realtimeService: RealtimeService,
    emailService: EmailService
  ) {
    this.prisma = prisma;
    this.notificationService = notificationService;
    this.realtimeService = realtimeService;
    this.emailService = emailService;
  }

  async sendDeadlineReminders(currentDate: Date = new Date()) {
    const now = currentDate;
    const tasks = await this.prisma.task.findMany({
      where: {
        status: {
          not: 'COMPLETED',
        },
        dueDate: {
          // Check for tasks due in the next 24 hours or overdue in the last 48 hours
          gte: new Date(now.getTime() - 48 * 60 * 60 * 1000),
          lte: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      include: {
        assignments: {
          include: {
            user: true,
          },
        },
      },
    });

    for (const task of tasks) {
      const hoursUntilDue = differenceInHours(task.dueDate, now);
      let notificationType: 'DEADLINE_REMINDER' | 'TASK_OVERDUE' | null = null;
      let message: string = '';
      let title: string = '';

      // Due in < 24 hours
      if (hoursUntilDue > 0 && hoursUntilDue <= 24) {
        notificationType = 'DEADLINE_REMINDER';
        title = 'Task Deadline Reminder';
        message = `Your task "${task.title}" is due in less than 24 hours.`;
      }
      // Due today
      else if (hoursUntilDue <= 0 && hoursUntilDue > -24) {
        notificationType = 'DEADLINE_REMINDER';
        title = 'Task Deadline Reminder';
        message = `Your task "${task.title}" is due today.`;
      }
      // Overdue by 1 day
      else if (hoursUntilDue <= -24 && hoursUntilDue > -48) {
        notificationType = 'TASK_OVERDUE';
        title = 'Task Overdue';
        message = `Your task "${task.title}" was due yesterday.`;
      }

      if (notificationType) {
        await this.sendReminder(task, notificationType, title, message);
      }
    }
  }

  private async sendReminder(
    task: any, // TaskWithAssignments type is not directly available here, using any for now
    type: 'DEADLINE_REMINDER' | 'TASK_OVERDUE',
    title: string,
    message: string
  ) {
    for (const assignment of task.assignments) {
      const user = assignment.user;

      // 1. Create in-app notification in the database using the new NotificationService
      await this.notificationService.create({
        userId: user.id,
        taskId: task.id,
        type: type, // Use the determined type
        title: title, // Use the determined title
        message: message,
      });

      // 2. Send real-time notification
      await this.realtimeService.sendNotification(user.id, {
        type: type,
        title: title,
        message: message,
        broadcast_at: new Date().toISOString(), // Add broadcast_at
      });

      // 3. Send email notification using the new EmailService.sendEmail
      if (user.email) {
        let emailMessage = `<p>Dear ${user.name || 'User'},</p><p>${message}</p>`;
        if (user.isHrAdmin) {
          emailMessage += `<p><b>This is a notification for the HR department.</b></p>`;
        }
        emailMessage += `<p>You can view the task here: <a href="${process.env.NEXT_PUBLIC_BASE_URL}/tasks/${task.id}">${task.title}</a></p><p>Regards,<br>Your Application Team</p>`;

        await this.emailService.sendEmail({
          to: 'james626629@gmail.com', // Hardcode for testing with Resend unverified domain
          subject: title,
          text: message,
          html: emailMessage,
        });
        // Add a delay to avoid hitting the rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}
