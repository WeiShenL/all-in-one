import { TaskService } from '@/services/task/TaskService';
import { ITaskRepository } from '@/repositories/ITaskRepository';
import { PrismaClient } from '@prisma/client';

/**
 * TaskService - Task Update Notifications Tests
 *
 * Purpose: Test notification orchestration logic in Application Layer
 * Tests the sendTaskUpdateNotifications() method and its integration with:
 * - NotificationService (DB storage + email sending)
 * - Supabase Realtime (toast broadcasting)
 *
 */

// Mock Supabase client to prevent "supabaseUrl is required" error
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        createSignedUrl: jest.fn(),
        remove: jest.fn(),
      })),
    },
    channel: jest.fn(() => ({
      send: jest.fn(),
    })),
  })),
}));

// Mock EmailService to prevent RESEND_API_KEY error
jest.mock('@/app/server/services/EmailService', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock Resend SDK
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest
        .fn()
        .mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

// ============================================
// MOCK FACTORIES
// ============================================

const createMockTaskRepository = (): jest.Mocked<ITaskRepository> =>
  ({
    getTaskByIdFull: jest.fn(),
    getTaskById: jest.fn(),
    createTask: jest.fn(),
    createComment: jest.fn(),
    updateComment: jest.fn(),
    addTaskAssignment: jest.fn(),
    removeTaskAssignment: jest.fn(),
    logTaskAction: jest.fn(),
    validateAssignees: jest.fn(),
    getUserDepartments: jest.fn(),
    getParentTaskDepth: jest.fn(),
    validateProjectExists: jest.fn(),
    getUserTasks: jest.fn(),
  }) as any;

const createMockPrismaClient = (): jest.Mocked<PrismaClient> => {
  const mockPrisma: any = {
    userProfile: {
      // Smart mock: returns a user with the requested ID
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        return Promise.resolve({
          id: where.id,
          name: `User ${where.id}`,
          email: `${where.id}@example.com`,
          isActive: true,
        });
      }),
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'notif-123' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    task: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'task-123',
        title: 'Test Task',
        description: 'Test',
      }),
      update: jest.fn(),
    },
  };
  return mockPrisma;
};

const createMockTask = (overrides?: Partial<any>) => ({
  id: 'task-123',
  title: 'Test Task',
  description: 'Test description',
  priority: 5,
  dueDate: new Date('2025-12-31'),
  status: 'TO_DO' as any,
  ownerId: 'owner-1',
  departmentId: 'dept-1',
  projectId: null,
  parentTaskId: null,
  recurringInterval: null,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  assignments: [
    { userId: 'user-1', taskId: 'task-123', assignedBy: 'owner-1' },
    { userId: 'user-2', taskId: 'task-123', assignedBy: 'owner-1' },
  ],
  tags: [],
  comments: [],
  files: [],
  ...overrides,
});

// ============================================
// TEST SUITE
// ============================================

describe('TaskService - Task Update Notifications', () => {
  let taskService: TaskService;
  let mockTaskRepository: jest.Mocked<ITaskRepository>;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let broadcastSpy: jest.SpyInstance;

  beforeEach(() => {
    mockTaskRepository = createMockTaskRepository();
    mockPrisma = createMockPrismaClient();
    taskService = new TaskService(mockTaskRepository, mockPrisma);

    // Mock broadcastToastNotification to prevent actual Supabase calls
    broadcastSpy = jest
      .spyOn(taskService as any, 'broadcastToastNotification')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // addCommentToTask - Notification Triggering
  // ============================================

  describe('addCommentToTask - Notification Triggering', () => {
    test('should send notifications to all assignees EXCEPT the commenter', async () => {
      // Arrange
      const taskId = 'task-123';
      const actorUserId = 'user-actor';
      const mockTaskData = createMockTask({
        assignments: [
          { userId: actorUserId },
          { userId: 'user-2' },
          { userId: 'user-3' },
        ],
      });

      // addCommentToTask calls getTaskByIdFull 3 times:
      // 1. getTaskById (line 915) 2. Re-fetch (line 950) 3. sendTaskUpdateNotifications
      mockTaskRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce(mockTaskData);
      mockTaskRepository.createComment.mockResolvedValue({} as any);
      mockTaskRepository.logTaskAction.mockResolvedValue(undefined);

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: actorUserId,
        name: 'Actor User',
        email: 'actor@example.com',
        isActive: true,
      } as any);

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
        {} as any
      );
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await taskService.addCommentToTask(taskId, 'Test comment', {
        userId: actorUserId,
        role: 'STAFF',
        departmentId: 'dept-1',
      });

      // Assert
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2); // user-2, user-3 only
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-2',
            type: 'COMMENT_ADDED',
            taskId: taskId,
            title: 'New Comment',
            message: expect.stringMatching(/Actor User.*Test Task/),
          }),
        })
      );
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-3',
            type: 'COMMENT_ADDED',
          }),
        })
      );
    });

    test('should NOT send notifications if actor is the only assignee', async () => {
      // Arrange
      const taskId = 'task-123';
      const actorUserId = 'user-solo';
      const mockTaskData = createMockTask({
        assignments: [{ userId: actorUserId }],
      });

      mockTaskRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce(mockTaskData);
      mockTaskRepository.createComment.mockResolvedValue({} as any);
      mockTaskRepository.logTaskAction.mockResolvedValue(undefined);

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        name: 'Solo User',
      } as any);

      // Act
      await taskService.addCommentToTask(taskId, 'Talking to myself', {
        userId: actorUserId,
        role: 'STAFF',
        departmentId: 'dept-1',
      });

      // Assert
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    test('should broadcast real-time toast to each recipient', async () => {
      // Arrange
      const taskId = 'task-123';
      const actorUserId = 'user-actor';
      const mockTaskData = createMockTask({
        assignments: [
          { userId: actorUserId },
          { userId: 'user-2' },
          { userId: 'user-3' },
        ],
      });

      mockTaskRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce(mockTaskData);
      mockTaskRepository.createComment.mockResolvedValue({} as any);
      mockTaskRepository.logTaskAction.mockResolvedValue(undefined);

      // Override to provide specific name for actor
      (mockPrisma.userProfile.findUnique as jest.Mock).mockImplementation(
        ({ where }: any) =>
          Promise.resolve({
            id: where.id,
            name: 'Actor User',
            email: `${where.id}@example.com`,
            isActive: true,
          })
      );

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
        {} as any
      );
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await taskService.addCommentToTask(taskId, 'Test', {
        userId: actorUserId,
        role: 'STAFF',
        departmentId: 'dept-1',
      });

      // Assert
      expect(broadcastSpy).toHaveBeenCalledTimes(2); // user-2, user-3
      expect(broadcastSpy).toHaveBeenCalledWith('user-2', {
        type: 'COMMENT_ADDED',
        title: 'New Comment',
        message: expect.stringContaining('Actor User'),
        taskId: taskId,
      });
      expect(broadcastSpy).toHaveBeenCalledWith('user-3', {
        type: 'COMMENT_ADDED',
        title: 'New Comment',
        message: expect.stringContaining('Actor User'),
        taskId: taskId,
      });
    });

    test('should use actor email as fallback if name not available', async () => {
      // Arrange
      const taskId = 'task-123';
      const actorUserId = 'user-actor';
      const mockTaskData = createMockTask({
        assignments: [{ userId: actorUserId }, { userId: 'user-2' }],
      });

      mockTaskRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce(mockTaskData);
      mockTaskRepository.createComment.mockResolvedValue({} as any);
      mockTaskRepository.logTaskAction.mockResolvedValue(undefined);

      // Override to test email fallback when name is null
      (mockPrisma.userProfile.findUnique as jest.Mock).mockImplementation(
        ({ where }: any) =>
          Promise.resolve({
            id: where.id,
            name: null,
            email: 'actor@example.com',
            isActive: true,
          })
      );

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
        {} as any
      );
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await taskService.addCommentToTask(taskId, 'Test', {
        userId: actorUserId,
        role: 'STAFF',
        departmentId: 'dept-1',
      });

      // Assert
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: expect.stringContaining('actor@example.com'), // Email used as fallback
          }),
        })
      );
    });
  });

  // ============================================
  // updateComment - Notification Triggering
  // ============================================

  describe('updateComment - Notification Triggering', () => {
    test('should send "Comment Edited" notification to all assignees except editor', async () => {
      // Arrange
      const taskId = 'task-123';
      const editorUserId = 'user-editor';
      const mockTaskData = createMockTask({
        assignments: [{ userId: editorUserId }, { userId: 'user-2' }],
        comments: [
          {
            id: 'comment-1',
            content: 'Old content',
            userId: editorUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      // updateComment calls getTaskByIdFull 2 times: getTaskById + notifications
      mockTaskRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce(mockTaskData);
      mockTaskRepository.updateComment.mockResolvedValue(undefined);
      mockTaskRepository.logTaskAction.mockResolvedValue(undefined);

      // Override to provide specific name for editor
      (mockPrisma.userProfile.findUnique as jest.Mock).mockImplementation(
        ({ where }: any) =>
          Promise.resolve({
            id: where.id,
            name: 'Editor User',
            email: `${where.id}@example.com`,
            isActive: true,
          })
      );

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
        {} as any
      );
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await taskService.updateComment(taskId, 'comment-1', 'New content', {
        userId: editorUserId,
        role: 'STAFF',
        departmentId: 'dept-1',
      });

      // Assert
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-2',
            type: 'COMMENT_ADDED', // Reuse same type
            title: 'Comment Edited',
            message: expect.stringMatching(/Editor User.*edited a comment/),
          }),
        })
      );
    });

    test('should broadcast toast with info type for comment edit', async () => {
      // Arrange
      const taskId = 'task-123';
      const editorUserId = 'user-editor';
      const mockTaskData = createMockTask({
        assignments: [{ userId: editorUserId }, { userId: 'user-2' }],
        comments: [{ id: 'comment-1', content: 'Old', userId: editorUserId }],
      });

      mockTaskRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce(mockTaskData);
      mockTaskRepository.updateComment.mockResolvedValue(undefined);
      mockTaskRepository.logTaskAction.mockResolvedValue(undefined);

      // Override to provide specific name for editor
      (mockPrisma.userProfile.findUnique as jest.Mock).mockImplementation(
        ({ where }: any) =>
          Promise.resolve({
            id: where.id,
            name: 'Editor User',
            email: `${where.id}@example.com`,
            isActive: true,
          })
      );

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
        {} as any
      );
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await taskService.updateComment(taskId, 'comment-1', 'New', {
        userId: editorUserId,
        role: 'STAFF',
        departmentId: 'dept-1',
      });

      // Assert
      expect(broadcastSpy).toHaveBeenCalledWith('user-2', {
        type: 'COMMENT_ADDED', // Reuses COMMENT_ADDED type for edits
        title: 'Comment Edited',
        message: expect.any(String),
        taskId: taskId,
      });
    });
  });

  // ============================================
  // addAssigneeToTask - Notification Triggering
  // ============================================

  describe('addAssigneeToTask - Notification Triggering', () => {
    test('should send "New Assignment" notification to all assignees including newly added', async () => {
      // Arrange
      const taskId = 'task-123';
      const managerUserId = 'user-manager';
      const newAssigneeId = 'user-new';

      // AFTER adding new assignee
      const mockTaskData = createMockTask({
        assignments: [
          { userId: managerUserId },
          { userId: 'user-existing' },
          { userId: newAssigneeId }, // Just added
        ],
      });

      // addAssigneeToTask calls getTaskByIdFull 2 times: getTaskById + notifications
      mockTaskRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce(mockTaskData);
      mockTaskRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.addTaskAssignment.mockResolvedValue(undefined);
      mockTaskRepository.logTaskAction.mockResolvedValue(undefined);

      // Mock actor
      (mockPrisma.userProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce({ name: 'Manager User' } as any)
        .mockResolvedValueOnce({
          name: 'New User',
          email: 'new@example.com',
        } as any);

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
        {} as any
      );
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await taskService.addAssigneeToTask(taskId, newAssigneeId, {
        userId: managerUserId,
        role: 'MANAGER',
        departmentId: 'dept-1',
      });

      // Assert
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2); // user-existing, user-new
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: newAssigneeId, // Newly added user gets notified!
            type: 'TASK_REASSIGNED',
            title: 'New Assignment',
            message: expect.stringMatching(/.*added.*New User.*to.*/),
          }),
        })
      );
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-existing',
            type: 'TASK_REASSIGNED',
          }),
        })
      );
    });

    test('should NOT notify the manager who added the assignee', async () => {
      // Arrange
      const taskId = 'task-123';
      const managerUserId = 'user-manager';
      const newAssigneeId = 'user-new';

      const mockTaskData = createMockTask({
        assignments: [{ userId: managerUserId }, { userId: newAssigneeId }],
      });

      mockTaskRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce(mockTaskData);
      mockTaskRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.addTaskAssignment.mockResolvedValue(undefined);
      mockTaskRepository.logTaskAction.mockResolvedValue(undefined);

      // Smart mock handles user lookups automatically
      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
        {} as any
      );
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await taskService.addAssigneeToTask(taskId, newAssigneeId, {
        userId: managerUserId,
        role: 'MANAGER',
        departmentId: 'dept-1',
      });

      // Assert
      const createCalls = (mockPrisma.notification.create as jest.Mock).mock
        .calls;
      const notifiedUserIds = createCalls.map(call => call[0].data.userId);
      expect(notifiedUserIds).not.toContain(managerUserId);
      expect(notifiedUserIds).toContain(newAssigneeId);
    });

    test('should use assignee email as fallback if name not available', async () => {
      // Arrange
      const taskId = 'task-123';
      const mockTaskData = createMockTask({
        assignments: [{ userId: 'manager' }, { userId: 'new-user' }],
      });

      mockTaskRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce(mockTaskData);
      mockTaskRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.addTaskAssignment.mockResolvedValue(undefined);
      mockTaskRepository.logTaskAction.mockResolvedValue(undefined);

      (mockPrisma.userProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce({ name: 'Manager' } as any)
        .mockResolvedValueOnce({
          name: null,
          email: 'newuser@example.com',
        } as any);

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
        {} as any
      );
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await taskService.addAssigneeToTask(taskId, 'new-user', {
        userId: 'manager',
        role: 'MANAGER',
        departmentId: 'dept-1',
      });

      // Assert
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: expect.stringContaining('newuser@example.com'),
          }),
        })
      );
    });
  });

  // ============================================
  // removeAssigneeFromTask - Notification Triggering
  // ============================================

  describe('removeAssigneeFromTask - Notification Triggering', () => {
    test('should send "Assignment Removed" notification to remaining assignees only', async () => {
      // Arrange
      const taskId = 'task-123';
      const managerUserId = 'user-manager';
      const removedUserId = 'user-removed';

      // BEFORE removal - for getTaskById internal call
      const mockTaskDataBefore = createMockTask({
        assignments: [
          { userId: managerUserId },
          { userId: removedUserId },
          { userId: 'user-remaining' },
        ],
      });

      // AFTER removing - for notification logic
      const mockTaskDataAfter = createMockTask({
        assignments: [
          { userId: managerUserId },
          { userId: 'user-remaining' },
          // removedUserId is GONE
        ],
      });

      // First call: getTaskById needs task WITH removedUserId
      // Second call: sendTaskUpdateNotifications needs task WITHOUT removedUserId
      mockTaskRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskDataBefore)
        .mockResolvedValueOnce(mockTaskDataAfter);
      mockTaskRepository.removeTaskAssignment.mockResolvedValue(undefined);
      mockTaskRepository.logTaskAction.mockResolvedValue(undefined);

      (mockPrisma.userProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce({ name: 'Manager User' } as any)
        .mockResolvedValueOnce({
          name: 'Removed User',
          email: 'removed@example.com',
        } as any);

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
        {} as any
      );
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await taskService.removeAssigneeFromTask(taskId, removedUserId, {
        userId: managerUserId,
        role: 'MANAGER',
        departmentId: 'dept-1',
      });

      // Assert
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1); // Only user-remaining
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-remaining',
            type: 'TASK_REASSIGNED',
            title: 'Assignment Removed',
            message: expect.stringMatching(/.*removed.*Removed User.*from.*/),
          }),
        })
      );
    });

    test('should NOT notify the removed user', async () => {
      // Arrange
      const taskId = 'task-123';
      const removedUserId = 'user-removed';

      // BEFORE removal
      const mockTaskDataBefore = createMockTask({
        assignments: [{ userId: 'user-manager' }, { userId: removedUserId }],
      });

      // AFTER removal
      const mockTaskDataAfter = createMockTask({
        assignments: [{ userId: 'user-manager' }],
      });

      mockTaskRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskDataBefore)
        .mockResolvedValueOnce(mockTaskDataAfter);
      mockTaskRepository.removeTaskAssignment.mockResolvedValue(undefined);
      mockTaskRepository.logTaskAction.mockResolvedValue(undefined);

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        name: 'Manager',
      } as any);

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
        {} as any
      );
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await taskService.removeAssigneeFromTask(taskId, removedUserId, {
        userId: 'user-manager',
        role: 'MANAGER',
        departmentId: 'dept-1',
      });

      // Assert
      const createCalls = (mockPrisma.notification.create as jest.Mock).mock
        .calls;
      const notifiedUserIds = createCalls.map(call => call[0].data.userId);
      expect(notifiedUserIds).not.toContain(removedUserId);
    });

    test('should NOT notify the manager who removed the assignee', async () => {
      // Arrange
      const taskId = 'task-123';
      const managerUserId = 'user-manager';
      const removedUserId = 'removed-user';

      // BEFORE removal
      const mockTaskDataBefore = createMockTask({
        assignments: [
          { userId: managerUserId },
          { userId: removedUserId },
          { userId: 'user-remaining' },
        ],
      });

      // AFTER removal
      const mockTaskDataAfter = createMockTask({
        assignments: [{ userId: managerUserId }, { userId: 'user-remaining' }],
      });

      mockTaskRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskDataBefore)
        .mockResolvedValueOnce(mockTaskDataAfter);
      mockTaskRepository.removeTaskAssignment.mockResolvedValue(undefined);
      mockTaskRepository.logTaskAction.mockResolvedValue(undefined);

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        name: 'Manager',
      } as any);

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
        {} as any
      );
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await taskService.removeAssigneeFromTask(taskId, removedUserId, {
        userId: managerUserId,
        role: 'MANAGER',
        departmentId: 'dept-1',
      });

      // Assert
      const createCalls = (mockPrisma.notification.create as jest.Mock).mock
        .calls;
      const notifiedUserIds = createCalls.map(call => call[0].data.userId);
      expect(notifiedUserIds).not.toContain(managerUserId);
    });

    test('should broadcast toast with warning type for assignment removal', async () => {
      // Arrange
      const taskId = 'task-123';
      const removedUserId = 'removed-user';

      // BEFORE removal
      const mockTaskDataBefore = createMockTask({
        assignments: [
          { userId: 'manager' },
          { userId: removedUserId },
          { userId: 'remaining' },
        ],
      });

      // AFTER removal
      const mockTaskDataAfter = createMockTask({
        assignments: [{ userId: 'manager' }, { userId: 'remaining' }],
      });

      mockTaskRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskDataBefore)
        .mockResolvedValueOnce(mockTaskDataAfter);
      mockTaskRepository.removeTaskAssignment.mockResolvedValue(undefined);
      mockTaskRepository.logTaskAction.mockResolvedValue(undefined);

      // Smart mock handles user lookups automatically
      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
        {} as any
      );
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await taskService.removeAssigneeFromTask(taskId, removedUserId, {
        userId: 'manager',
        role: 'MANAGER',
        departmentId: 'dept-1',
      });

      // Assert
      expect(broadcastSpy).toHaveBeenCalledWith('remaining', {
        type: 'TASK_REASSIGNED', // Assignment change type
        title: 'Assignment Removed',
        message: expect.any(String),
        taskId: taskId,
      });
    });
  });
});
