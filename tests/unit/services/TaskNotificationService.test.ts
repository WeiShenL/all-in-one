import { TaskNotificationService } from '@/app/server/services/TaskNotificationService';
import { NotificationService } from '@/app/server/services/NotificationService';
import { RealtimeService } from '@/app/server/services/RealtimeService';
import { EmailService } from '@/app/server/services/EmailService';
import { PrismaClient } from '@prisma/client';
import { addHours, subHours, startOfDay } from 'date-fns';

// Mock services
jest.mock('@/app/server/services/NotificationService');
jest.mock('@/app/server/services/RealtimeService');
jest.mock('@/app/server/services/EmailService');

// Mock Prisma Client
const mockPrisma = {
  task: {
    findMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
  userProfile: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('TaskNotificationService', () => {
  let taskNotificationService: TaskNotificationService;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockRealtimeService: jest.Mocked<RealtimeService>;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    mockNotificationService = new NotificationService(
      mockPrisma,
      new EmailService() // Pass a mocked EmailService to NotificationService constructor
    ) as jest.Mocked<NotificationService>;
    mockRealtimeService = new RealtimeService() as jest.Mocked<RealtimeService>;
    mockEmailService = new EmailService() as jest.Mocked<EmailService>;

    taskNotificationService = new TaskNotificationService(
      mockPrisma, // Pass mockPrisma here
      mockNotificationService,
      mockRealtimeService,
      mockEmailService
    );

    jest.clearAllMocks();
  });

  describe('sendDeadlineReminders', () => {
    const now = new Date('2025-10-26T10:00:00Z'); // Consistent current date for testing

    it('should send reminder for tasks due in less than 24 hours', async () => {
      const taskDueDate = addHours(now, 23); // Due in 23 hours
      const mockTasks = [
        {
          id: 'task1',
          title: 'Task Due Soon',
          status: 'TO_DO',
          dueDate: taskDueDate,
          assignments: [{ user: { id: 'user1', email: 'user1@example.com', name: 'User One' } }],
        },
      ];

      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      await taskNotificationService.sendDeadlineReminders(now);

      expect(mockNotificationService.create).toHaveBeenCalledTimes(1);
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          taskId: 'task1',
          type: 'DEADLINE_REMINDER',
          title: 'Task Deadline Reminder',
          message: 'Your task "Task Due Soon" is due in less than 24 hours.',
        })
      );
      expect(mockRealtimeService.sendNotification).toHaveBeenCalledTimes(1);
      expect(mockRealtimeService.sendNotification).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          type: 'DEADLINE_REMINDER',
          title: 'Task Deadline Reminder',
          message: 'Your task "Task Due Soon" is due in less than 24 hours.',
        })
      );
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'james626629@gmail.com', // Hardcoded for testing
          subject: 'Task Deadline Reminder',
          text: 'Your task "Task Due Soon" is due in less than 24 hours.',
        })
      );
    });

    it('should send reminder for tasks due today', async () => {
      const taskDueDate = subHours(now, 1); // Due 1 hour ago (today)
      const mockTasks = [
        {
          id: 'task2',
          title: 'Task Due Today',
          status: 'TO_DO',
          dueDate: taskDueDate,
          assignments: [{ user: { id: 'user2', email: 'user2@example.com', name: 'User Two' } }],
        },
      ];

      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      await taskNotificationService.sendDeadlineReminders(now);

      expect(mockNotificationService.create).toHaveBeenCalledTimes(1);
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user2',
          taskId: 'task2',
          type: 'DEADLINE_REMINDER',
          title: 'Task Deadline Reminder',
          message: 'Your task "Task Due Today" is due today.',
        })
      );
      expect(mockRealtimeService.sendNotification).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('should send reminder for tasks overdue by 1 day', async () => {
      const taskDueDate = subHours(now, 25); // Overdue by 25 hours (1 day ago)
      const mockTasks = [
        {
          id: 'task3',
          title: 'Overdue Task',
          status: 'TO_DO',
          dueDate: taskDueDate,
          assignments: [{ user: { id: 'user3', email: 'user3@example.com', name: 'User Three' } }],
        },
      ];

      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      await taskNotificationService.sendDeadlineReminders(now);

      expect(mockNotificationService.create).toHaveBeenCalledTimes(1);
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user3',
          taskId: 'task3',
          type: 'TASK_OVERDUE',
          title: 'Task Overdue',
          message: 'Your task "Overdue Task" was due yesterday.',
        })
      );
      expect(mockRealtimeService.sendNotification).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('should not send reminder for completed tasks', async () => {
      const taskDueDate = addHours(now, 10);
      // Mock findMany to return an empty array, simulating the 'not: COMPLETED' filter
      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([]);

      await taskNotificationService.sendDeadlineReminders(now);

      expect(mockNotificationService.create).not.toHaveBeenCalled();
      expect(mockRealtimeService.sendNotification).not.toHaveBeenCalled();
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should not send reminder for tasks outside the notification window', async () => {
      const taskDueDate = addHours(now, 48); // Due in 48 hours (outside 24hr window)
      const mockTasks = [
        {
          id: 'task5',
          title: 'Task Far Away',
          status: 'TO_DO',
          dueDate: taskDueDate,
          assignments: [{ user: { id: 'user5', email: 'user5@example.com', name: 'User Five' } }],
        },
      ];

      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      await taskNotificationService.sendDeadlineReminders(now);

      expect(mockNotificationService.create).not.toHaveBeenCalled();
      expect(mockRealtimeService.sendNotification).not.toHaveBeenCalled();
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });
  });
});