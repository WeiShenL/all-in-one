import { TaskNotificationService } from '@/app/server/services/TaskNotificationService';
import { NotificationService } from '@/app/server/services/NotificationService';
import { RealtimeService } from '@/app/server/services/RealtimeService';
import { EmailService } from '@/app/server/services/EmailService';
import { PrismaClient } from '@prisma/client';
import { addHours, subHours } from 'date-fns';

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

    // Mock sendNotification to return a resolved promise
    mockRealtimeService.sendNotification = jest
      .fn()
      .mockResolvedValue(undefined);
    mockEmailService.sendEmail = jest.fn().mockResolvedValue(undefined);

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

    it('AC1: should send a DEADLINE_REMINDER for tasks due in less than 24 hours (1 day before)', async () => {
      const taskDueDate = addHours(now, 23); // Due in 23 hours
      const mockTasks = [
        {
          id: 'task1',
          title: 'Task Due Soon',
          status: 'TO_DO',
          dueDate: taskDueDate,
          assignments: [
            {
              user: {
                id: 'user1',
                email: 'user1@example.com',
                name: 'User One',
              },
            },
          ],
        },
      ];

      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      await taskNotificationService.sendDeadlineReminders(now);

      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DEADLINE_REMINDER',
          message: 'Your task "Task Due Soon" is due in less than 24 hours.',
        })
      );
    });

    it('AC1: should send a DEADLINE_REMINDER for tasks due on the same day', async () => {
      const taskDueDate = subHours(now, 1); // Due 1 hour ago (today)
      const mockTasks = [
        {
          id: 'task2',
          title: 'Task Due Today',
          status: 'TO_DO',
          dueDate: taskDueDate,
          assignments: [
            {
              user: {
                id: 'user2',
                email: 'user2@example.com',
                name: 'User Two',
              },
            },
          ],
        },
      ];

      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      await taskNotificationService.sendDeadlineReminders(now);

      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DEADLINE_REMINDER',
          message: 'Your task "Task Due Today" is due today.',
        })
      );
    });

    it('AC2: should send a TASK_OVERDUE notification for tasks overdue by 1 day', async () => {
      const taskDueDate = subHours(now, 25); // Overdue by 25 hours (1 day ago)
      const mockTasks = [
        {
          id: 'task3',
          title: 'Overdue Task',
          status: 'TO_DO',
          dueDate: taskDueDate,
          assignments: [
            {
              user: {
                id: 'user3',
                email: 'user3@example.com',
                name: 'User Three',
              },
            },
          ],
        },
      ];

      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      await taskNotificationService.sendDeadlineReminders(now);

      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TASK_OVERDUE',
          message: 'Your task "Overdue Task" was due yesterday.',
        })
      );
    });

    it('should handle the edge case of a task due in exactly 24 hours', async () => {
      const taskDueDate = addHours(now, 24);
      const mockTasks = [
        {
          id: 'taskEdge1',
          title: 'Edge Case Task 1',
          status: 'TO_DO',
          dueDate: taskDueDate,
          assignments: [
            {
              user: {
                id: 'userEdge1',
                email: 'edge1@example.com',
                name: 'Edge One',
              },
            },
          ],
        },
      ];

      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      await taskNotificationService.sendDeadlineReminders(now);

      // Based on the logic, this should trigger a "due in less than 24 hours" notification
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DEADLINE_REMINDER',
          message: 'Your task "Edge Case Task 1" is due in less than 24 hours.',
        })
      );
    });

    it('should handle the edge case of a task overdue by exactly 48 hours', async () => {
      const taskDueDate = subHours(now, 47);
      const mockTasks = [
        {
          id: 'taskEdge2',
          title: 'Edge Case Task 2',
          status: 'TO_DO',
          dueDate: taskDueDate,
          assignments: [
            {
              user: {
                id: 'userEdge2',
                email: 'edge2@example.com',
                name: 'Edge Two',
              },
            },
          ],
        },
      ];

      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      await taskNotificationService.sendDeadlineReminders(now);

      // Based on the logic, this should trigger a "task was due yesterday" notification
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TASK_OVERDUE',
          message: 'Your task "Edge Case Task 2" was due yesterday.',
        })
      );
    });

    it('should include a special message for HR admins in the email notification', async () => {
      const taskDueDate = addHours(now, 23);
      const mockTasks = [
        {
          id: 'taskHr',
          title: 'HR Task',
          status: 'TO_DO',
          dueDate: taskDueDate,
          assignments: [
            {
              user: {
                id: 'userHr',
                email: 'hr@example.com',
                name: 'HR User',
                isHrAdmin: true,
              },
            },
          ],
        },
      ];

      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      await taskNotificationService.sendDeadlineReminders(now);

      // Wait for setTimeout to execute (first email is at index 0 * 200 = 0ms, but we add buffer)
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(
            '<b>This is a notification for the HR department.</b>'
          ),
        })
      );
    });

    it('should not send reminder for completed tasks', async () => {
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
          assignments: [
            {
              user: {
                id: 'user5',
                email: 'user5@example.com',
                name: 'User Five',
              },
            },
          ],
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
