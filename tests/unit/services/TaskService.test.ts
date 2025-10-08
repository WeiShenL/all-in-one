import { TaskService } from '@/app/server/services/TaskService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  task: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  userProfile: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  department: {
    findUnique: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
  },
  taskAssignment: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
  },
  calendarEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  tag: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  taskTag: {
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    service = new TaskService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    describe('Create', () => {
      it('should create a new task', async () => {
        const input = {
          title: 'Implement Login',
          description: 'Implement user login functionality',
          priority: 8, // Changed from 'HIGH' to number (1-10 scale)
          dueDate: new Date('2025-12-31'),
          ownerId: 'user1',
          departmentId: 'dept1',
          projectId: 'proj1',
          assigneeIds: ['user2'], // Added required assigneeIds
        };

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user1',
          isActive: true,
        });

        (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
          id: 'dept1',
        });

        (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue({
          id: 'proj1',
        });

        // Mock assignee validation
        (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue([
          { id: 'user2', isActive: true },
        ]);

        const mockCreated = {
          id: 'task1',
          title: input.title,
          description: input.description,
          priority: 8, // Number instead of enum
          dueDate: input.dueDate,
          ownerId: input.ownerId,
          departmentId: input.departmentId,
          projectId: input.projectId,
          status: 'TO_DO',
          isArchived: false,
          parentTaskId: null,
          recurringInterval: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: { id: 'user1', name: 'Owner', email: 'owner@example.com' },
          department: { id: 'dept1', name: 'Engineering' },
          project: { id: 'proj1', name: 'Project' },
          parentTask: null,
        };

        (mockPrisma.task.create as jest.Mock).mockResolvedValue(mockCreated);

        // Mock createMany for task assignments
        (mockPrisma.taskAssignment.createMany as jest.Mock).mockResolvedValue({
          count: 1,
        });

        // Mock getById for final return
        (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue({
          ...mockCreated,
          owner: {
            id: 'user1',
            name: 'Owner',
            email: 'owner@example.com',
            role: 'STAFF',
          },
          subtasks: [],
          assignments: [],
          comments: [],
          files: [],
          tags: [],
        });

        const result = await service.create(input);

        expect(mockPrisma.task.create).toHaveBeenCalledWith({
          data: {
            title: input.title,
            description: input.description,
            priority: 8,
            dueDate: input.dueDate,
            ownerId: input.ownerId,
            departmentId: input.departmentId,
            projectId: input.projectId,
            parentTaskId: undefined,
            recurringInterval: undefined,
          },
          include: expect.any(Object),
        });

        expect(result).toBeDefined();
        expect(result!.title).toBe('Implement Login');
        expect(result!.priority).toBe(8); // Expect number, not 'HIGH'
      });

      it('should throw error when owner not found', async () => {
        const input = {
          title: 'Task',
          description: 'Description',
          dueDate: new Date(),
          ownerId: 'nonexistent',
          departmentId: 'dept1',
          assigneeIds: ['user1'], // Added required field
        };

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
          null
        );

        await expect(service.create(input)).rejects.toThrow(
          'Owner not found or inactive'
        );
      });

      it('should throw error when department not found', async () => {
        const input = {
          title: 'Task',
          description: 'Description',
          dueDate: new Date(),
          ownerId: 'user1',
          departmentId: 'nonexistent',
          assigneeIds: ['user1'], // Added required field
        };

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user1',
          isActive: true,
        });

        (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(service.create(input)).rejects.toThrow(
          'Department not found'
        );
      });
    });

    describe('Read', () => {
      it('should get all tasks', async () => {
        const mockTasks = [
          {
            id: 'task1',
            title: 'Task 1',
            status: 'TO_DO',
            isArchived: false,
            owner: { id: 'user1', name: 'Owner', email: 'owner@example.com' },
            project: { id: 'proj1', name: 'Project' },
            department: { id: 'dept1', name: 'Engineering' },
            assignments: [],
            subtasks: [],
          },
        ];

        (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

        const result = await service.getAll();

        expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
          where: {
            ownerId: undefined,
            projectId: undefined,
            departmentId: undefined,
            status: undefined,
            isArchived: false,
            parentTaskId: undefined,
          },
          include: expect.any(Object),
          orderBy: { dueDate: 'asc' },
        });

        expect(result).toHaveLength(1);
      });

      it('should get tasks with filters', async () => {
        const mockTasks = [
          {
            id: 'task1',
            title: 'Task 1',
            status: 'IN_PROGRESS',
            ownerId: 'user1',
          },
        ];

        (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

        await service.getAll({
          ownerId: 'user1',
          status: 'IN_PROGRESS',
        });

        expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
          where: {
            ownerId: 'user1',
            projectId: undefined,
            departmentId: undefined,
            status: 'IN_PROGRESS',
            isArchived: false,
            parentTaskId: undefined,
          },
          include: expect.any(Object),
          orderBy: { dueDate: 'asc' },
        });
      });

      it('should get task by ID', async () => {
        const mockTask = {
          id: 'task1',
          title: 'Task 1',
          owner: {
            id: 'user1',
            name: 'Owner',
            email: 'owner@example.com',
            role: 'STAFF',
          },
          project: { id: 'proj1', name: 'Project', status: 'ACTIVE' },
          department: { id: 'dept1', name: 'Engineering' },
          parentTask: null,
          subtasks: [],
          assignments: [],
          comments: [],
          files: [],
          tags: [],
        };

        (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue(mockTask);

        const result = await service.getById('task1');

        expect(mockPrisma.task.findUnique).toHaveBeenCalledWith({
          where: { id: 'task1' },
          include: expect.any(Object),
        });

        expect(result?.title).toBe('Task 1');
      });

      it('should get tasks by assignee', async () => {
        const mockAssignments = [
          {
            userId: 'user1',
            task: {
              id: 'task1',
              title: 'Task 1',
              owner: { id: 'user2', name: 'Owner', email: 'owner@example.com' },
              project: { id: 'proj1', name: 'Project' },
              department: { id: 'dept1', name: 'Engineering' },
            },
          },
        ];

        (mockPrisma.taskAssignment.findMany as jest.Mock).mockResolvedValue(
          mockAssignments
        );

        const result = await service.getByAssignee('user1');

        expect(mockPrisma.taskAssignment.findMany).toHaveBeenCalledWith({
          where: { userId: 'user1' },
          include: expect.any(Object),
        });

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Task 1');
      });
    });

    describe('Update', () => {
      it('should update a task', async () => {
        const existingTask = {
          id: 'task1',
          title: 'Old Title',
        };

        const updateData = {
          title: 'New Title',
          status: 'COMPLETED' as const,
        };

        (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue(
          existingTask
        );

        const mockUpdated = {
          ...existingTask,
          ...updateData,
          updatedAt: new Date(),
        };

        (mockPrisma.task.update as jest.Mock).mockResolvedValue(mockUpdated);

        const result = await service.update('task1', updateData);

        expect(mockPrisma.task.update).toHaveBeenCalledWith({
          where: { id: 'task1' },
          data: updateData,
          include: expect.any(Object),
        });

        expect(result.title).toBe('New Title');
        expect(result.status).toBe('COMPLETED');
      });

      it('should throw error when task not found', async () => {
        (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(
          service.update('nonexistent', { title: 'New' })
        ).rejects.toThrow('Task not found');
      });

      it('should update task status', async () => {
        const existingTask = {
          id: 'task1',
          status: 'TO_DO',
        };

        (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue(
          existingTask
        );

        const mockUpdated = {
          ...existingTask,
          status: 'IN_PROGRESS',
        };

        (mockPrisma.task.update as jest.Mock).mockResolvedValue(mockUpdated);

        const result = await service.updateStatus('task1', 'IN_PROGRESS');

        expect(result.status).toBe('IN_PROGRESS');
      });
    });

    describe('Delete', () => {
      it('should delete task when no subtasks exist', async () => {
        (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([]);

        const mockDeleted = {
          id: 'task1',
          title: 'Task',
        };

        (mockPrisma.task.delete as jest.Mock).mockResolvedValue(mockDeleted);

        const result = await service.delete('task1');

        expect(mockPrisma.task.delete).toHaveBeenCalledWith({
          where: { id: 'task1' },
        });

        expect(result.id).toBe('task1');
      });

      it('should throw error when task has subtasks', async () => {
        (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([
          { id: 'subtask1', parentTaskId: 'task1' },
        ]);

        await expect(service.delete('task1')).rejects.toThrow(
          'Cannot delete task with subtasks. Archive it instead.'
        );
      });

      it('should archive task', async () => {
        const existingTask = {
          id: 'task1',
          isArchived: false,
        };

        (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue(
          existingTask
        );

        const mockArchived = {
          ...existingTask,
          isArchived: true,
        };

        (mockPrisma.task.update as jest.Mock).mockResolvedValue(mockArchived);

        const result = await service.archive('task1');

        expect(result.isArchived).toBe(true);
      });
    });
  });

  describe('Task Assignment', () => {
    it('should assign user to task', async () => {
      (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: 'task1',
        assignments: [], // Include assignments array for length check
      });

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1',
        isActive: true,
      });

      (mockPrisma.taskAssignment.findUnique as jest.Mock).mockResolvedValue(
        null
      );

      const mockCreated = {
        taskId: 'task1',
        userId: 'user1',
        assignedById: 'user2',
        assignedAt: new Date(),
        user: {
          id: 'user1',
          name: 'User',
          email: 'user@example.com',
          role: 'STAFF',
        },
        assignedBy: {
          id: 'user2',
          name: 'Assigner',
        },
      };

      (mockPrisma.taskAssignment.create as jest.Mock).mockResolvedValue(
        mockCreated
      );

      const result = await service.assignUser('task1', 'user1', 'user2');

      expect(mockPrisma.taskAssignment.create).toHaveBeenCalledWith({
        data: {
          taskId: 'task1',
          userId: 'user1',
          assignedById: 'user2',
        },
        include: expect.any(Object),
      });

      expect(result.userId).toBe('user1');
    });

    it('should throw error when user already assigned', async () => {
      (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: 'task1',
        assignments: [], // Include assignments array
      });

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1',
        isActive: true,
      });

      (mockPrisma.taskAssignment.findUnique as jest.Mock).mockResolvedValue({
        taskId: 'task1',
        userId: 'user1',
      });

      await expect(
        service.assignUser('task1', 'user1', 'user2')
      ).rejects.toThrow('User is already assigned to this task');
    });

    it('should unassign user from task', async () => {
      (mockPrisma.taskAssignment.delete as jest.Mock).mockResolvedValue({
        taskId: 'task1',
        userId: 'user1',
      });

      const result = await service.unassignUser('task1', 'user1');

      expect(mockPrisma.taskAssignment.delete).toHaveBeenCalledWith({
        where: {
          taskId_userId: {
            taskId: 'task1',
            userId: 'user1',
          },
        },
      });

      expect(result.userId).toBe('user1');
    });
  });

  describe('Calendar Events', () => {
    it('should create calendar event', async () => {
      (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: 'task1',
      });

      const mockCreated = {
        id: 'event1',
        taskId: 'task1',
        userId: 'user1',
        title: 'Task Deadline',
        eventDate: new Date('2025-12-31'),
        task: {
          id: 'task1',
          title: 'Task',
        },
      };

      (mockPrisma.calendarEvent.create as jest.Mock).mockResolvedValue(
        mockCreated
      );

      const result = await service.createCalendarEvent(
        'task1',
        'user1',
        'Task Deadline',
        new Date('2025-12-31')
      );

      expect(mockPrisma.calendarEvent.create).toHaveBeenCalled();
      expect(result.title).toBe('Task Deadline');
    });

    it('should get calendar events for task', async () => {
      const mockEvents = [
        {
          id: 'event1',
          taskId: 'task1',
          userId: 'user1',
          title: 'Event',
          eventDate: new Date(),
          user: {
            id: 'user1',
            name: 'User',
            email: 'user@example.com',
          },
        },
      ];

      (mockPrisma.calendarEvent.findMany as jest.Mock).mockResolvedValue(
        mockEvents
      );

      const result = await service.getCalendarEvents('task1');

      expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalledWith({
        where: { taskId: 'task1' },
        include: expect.any(Object),
        orderBy: { eventDate: 'asc' },
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('Task Tags', () => {
    it('should add tag to task', async () => {
      (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: 'task1',
      });

      (mockPrisma.tag.findUnique as jest.Mock).mockResolvedValue({
        id: 'tag1',
        name: 'urgent',
      });

      (mockPrisma.taskTag.findUnique as jest.Mock).mockResolvedValue(null);

      const mockCreated = {
        taskId: 'task1',
        tagId: 'tag1',
        tag: {
          id: 'tag1',
          name: 'urgent',
        },
      };

      (mockPrisma.taskTag.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await service.addTag('task1', 'tag1');

      expect(mockPrisma.taskTag.create).toHaveBeenCalledWith({
        data: {
          taskId: 'task1',
          tagId: 'tag1',
        },
        include: { tag: true },
      });

      expect(result.tag.name).toBe('urgent');
    });

    it('should throw error when tag already added', async () => {
      (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: 'task1',
      });

      (mockPrisma.tag.findUnique as jest.Mock).mockResolvedValue({
        id: 'tag1',
      });

      (mockPrisma.taskTag.findUnique as jest.Mock).mockResolvedValue({
        taskId: 'task1',
        tagId: 'tag1',
      });

      await expect(service.addTag('task1', 'tag1')).rejects.toThrow(
        'Task already has this tag'
      );
    });

    it('should remove tag from task', async () => {
      (mockPrisma.taskTag.delete as jest.Mock).mockResolvedValue({
        taskId: 'task1',
        tagId: 'tag1',
      });

      const result = await service.removeTag('task1', 'tag1');

      expect(mockPrisma.taskTag.delete).toHaveBeenCalledWith({
        where: {
          taskId_tagId: {
            taskId: 'task1',
            tagId: 'tag1',
          },
        },
      });

      expect(result.tagId).toBe('tag1');
    });
  });
});
