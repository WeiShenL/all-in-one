import { TaskService } from '@/app/server/services/TaskService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  userProfile: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  department: {
    findMany: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('TaskService - Manager Dashboard', () => {
  let service: TaskService;

  beforeEach(() => {
    service = new TaskService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('getManagerDashboardTasks', () => {
    it("should fetch tasks from manager's own department", async () => {
      const managerId = 'manager1';
      const managerDeptId = 'dept1';

      // Mock manager lookup
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: managerId,
        departmentId: managerDeptId,
        role: 'MANAGER',
        isActive: true,
      });

      // Mock department hierarchy - only manager's own department
      (mockPrisma.department.findMany as jest.Mock).mockResolvedValue([]);

      // Mock userProfile.findMany for subordinate users (empty in this case)
      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue([]);

      // Mock tasks in manager's department
      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'task1',
          title: 'Task 1',
          description: 'Description 1',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'TO_DO',
          ownerId: 'user1',
          departmentId: managerDeptId,
          assignments: [
            {
              user: {
                id: 'user1',
                name: 'John Doe',
                email: 'john@example.com',
              },
            },
          ],
          department: {
            id: managerDeptId,
            name: 'Engineering',
          },
        },
        {
          id: 'task2',
          title: 'Task 2',
          description: 'Description 2',
          priority: 7,
          dueDate: new Date('2025-12-31'),
          status: 'IN_PROGRESS',
          ownerId: 'user2',
          departmentId: managerDeptId,
          assignments: [
            {
              user: {
                id: 'user2',
                name: 'Jane Smith',
                email: 'jane@example.com',
              },
            },
          ],
          department: {
            id: managerDeptId,
            name: 'Engineering',
          },
        },
      ]);

      const result = await service.getManagerDashboardTasks(managerId);

      expect(result).toBeDefined();
      expect(result!.tasks).toHaveLength(2);
      expect(result!.metrics.toDo).toBe(1);
      expect(result!.metrics.inProgress).toBe(1);
      expect(result!.metrics.completed).toBe(0);
      expect(result!.metrics.blocked).toBe(0);

      // Verify the prisma.task.findMany was called with ownership-based OR condition
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isArchived: false,
            OR: expect.arrayContaining([
              expect.objectContaining({
                ownerId: managerId,
              }),
              expect.objectContaining({
                assignments: {
                  some: {
                    user: {
                      departmentId: {
                        in: [managerDeptId],
                      },
                      isActive: true,
                    },
                  },
                },
              }),
            ]),
          }),
        })
      );
    });

    it('should fetch tasks from subordinate departments (one level only)', async () => {
      const managerId = 'manager1';
      const managerDeptId = 'dept1';
      const childDeptId = 'dept2';

      // Mock manager lookup
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: managerId,
        departmentId: managerDeptId,
        role: 'MANAGER',
        isActive: true,
      });

      // Mock department hierarchy - one direct child department only
      (mockPrisma.department.findMany as jest.Mock).mockResolvedValue([
        {
          id: childDeptId,
        },
      ]);

      // Mock userProfile.findMany for subordinate users in child department
      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'user2',
        },
      ]);

      // Mock tasks from both departments
      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'task1',
          title: 'Parent Dept Task',
          description: 'Task in parent department',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'TO_DO',
          ownerId: 'user1',
          departmentId: managerDeptId,
          assignments: [
            {
              user: {
                id: 'user1',
                name: 'John Doe',
                email: 'john@example.com',
              },
            },
          ],
          department: {
            id: managerDeptId,
            name: 'Engineering',
          },
        },
        {
          id: 'task2',
          title: 'Child Dept Task',
          description: 'Task in child department',
          priority: 7,
          dueDate: new Date('2025-12-31'),
          status: 'IN_PROGRESS',
          ownerId: 'user2',
          departmentId: childDeptId,
          assignments: [
            {
              user: {
                id: 'user2',
                name: 'Jane Smith',
                email: 'jane@example.com',
              },
            },
          ],
          department: {
            id: childDeptId,
            name: 'Backend Team',
          },
        },
      ]);

      const result = await service.getManagerDashboardTasks(managerId);

      expect(result).toBeDefined();
      expect(result!.tasks).toHaveLength(2);

      // Verify the query includes ownership and subordinate department logic
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isArchived: false,
            OR: expect.arrayContaining([
              expect.objectContaining({
                ownerId: managerId,
              }),
              expect.objectContaining({
                departmentId: {
                  in: [childDeptId],
                },
              }),
              expect.objectContaining({
                assignments: {
                  some: {
                    user: {
                      departmentId: {
                        in: expect.arrayContaining([
                          managerDeptId,
                          childDeptId,
                        ]),
                      },
                      isActive: true,
                    },
                  },
                },
              }),
            ]),
          }),
        })
      );
    });

    it('should NOT fetch tasks from peer departments (same level)', async () => {
      const managerId = 'manager1';
      const managerDeptId = 'dept1';

      // Mock manager lookup
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: managerId,
        departmentId: managerDeptId,
        role: 'MANAGER',
        isActive: true,
      });

      // Mock department hierarchy - no children
      (mockPrisma.department.findMany as jest.Mock).mockResolvedValue([]);

      // Mock userProfile.findMany for subordinate users (empty)
      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue([]);

      // Mock tasks - should only include tasks from manager's dept
      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'task1',
          title: 'My Dept Task',
          description: 'Task in my department',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'TO_DO',
          ownerId: 'user1',
          departmentId: managerDeptId,
          assignments: [
            {
              user: {
                id: 'user1',
                name: 'John Doe',
                email: 'john@example.com',
              },
            },
          ],
          department: {
            id: managerDeptId,
            name: 'Engineering',
          },
        },
      ]);

      const result = await service.getManagerDashboardTasks(managerId);

      expect(result).toBeDefined();
      expect(result!.tasks).toHaveLength(1);

      // Verify the query only includes manager's own tasks and assignee-based tasks
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isArchived: false,
            OR: expect.arrayContaining([
              expect.objectContaining({
                ownerId: managerId,
              }),
              expect.objectContaining({
                assignments: {
                  some: {
                    user: {
                      departmentId: {
                        in: [managerDeptId],
                      },
                      isActive: true,
                    },
                  },
                },
              }),
            ]),
          }),
        })
      );
    });

    it('should calculate metrics correctly for all task statuses', async () => {
      const managerId = 'manager1';
      const managerDeptId = 'dept1';

      // Mock manager lookup
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: managerId,
        departmentId: managerDeptId,
        role: 'MANAGER',
        isActive: true,
      });

      // Mock department hierarchy
      (mockPrisma.department.findMany as jest.Mock).mockResolvedValue([]);

      // Mock userProfile.findMany for subordinate users (empty)
      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue([]);

      // Mock tasks with different statuses
      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'task1',
          title: 'Task 1',
          description: 'Description',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'TO_DO',
          ownerId: 'user1',
          departmentId: managerDeptId,
          assignments: [],
          department: { id: managerDeptId, name: 'Engineering' },
        },
        {
          id: 'task2',
          title: 'Task 2',
          description: 'Description',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'TO_DO',
          ownerId: 'user1',
          departmentId: managerDeptId,
          assignments: [],
          department: { id: managerDeptId, name: 'Engineering' },
        },
        {
          id: 'task3',
          title: 'Task 3',
          description: 'Description',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'IN_PROGRESS',
          ownerId: 'user1',
          departmentId: managerDeptId,
          assignments: [],
          department: { id: managerDeptId, name: 'Engineering' },
        },
        {
          id: 'task4',
          title: 'Task 4',
          description: 'Description',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'IN_PROGRESS',
          ownerId: 'user1',
          departmentId: managerDeptId,
          assignments: [],
          department: { id: managerDeptId, name: 'Engineering' },
        },
        {
          id: 'task5',
          title: 'Task 5',
          description: 'Description',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'IN_PROGRESS',
          ownerId: 'user1',
          departmentId: managerDeptId,
          assignments: [],
          department: { id: managerDeptId, name: 'Engineering' },
        },
        {
          id: 'task6',
          title: 'Task 6',
          description: 'Description',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'COMPLETED',
          ownerId: 'user1',
          departmentId: managerDeptId,
          assignments: [],
          department: { id: managerDeptId, name: 'Engineering' },
        },
        {
          id: 'task7',
          title: 'Task 7',
          description: 'Description',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'BLOCKED',
          ownerId: 'user1',
          departmentId: managerDeptId,
          assignments: [],
          department: { id: managerDeptId, name: 'Engineering' },
        },
      ]);

      const result = await service.getManagerDashboardTasks(managerId);

      expect(result).toBeDefined();
      expect(result!.tasks).toHaveLength(7);
      expect(result!.metrics.toDo).toBe(2);
      expect(result!.metrics.inProgress).toBe(3);
      expect(result!.metrics.completed).toBe(1);
      expect(result!.metrics.blocked).toBe(1);
    });

    it('should filter out archived tasks', async () => {
      const managerId = 'manager1';
      const managerDeptId = 'dept1';

      // Mock manager lookup
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: managerId,
        departmentId: managerDeptId,
        role: 'MANAGER',
        isActive: true,
      });

      // Mock department hierarchy
      (mockPrisma.department.findMany as jest.Mock).mockResolvedValue([]);

      // Mock userProfile.findMany for subordinate users (empty)
      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue([]);

      // Mock tasks - archived tasks should not be returned
      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'task1',
          title: 'Active Task',
          description: 'Description',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'TO_DO',
          ownerId: 'user1',
          departmentId: managerDeptId,
          assignments: [],
          department: { id: managerDeptId, name: 'Engineering' },
        },
      ]);

      await service.getManagerDashboardTasks(managerId);

      // Verify archived tasks are filtered out
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isArchived: false,
          }),
        })
      );
    });

    it('should throw error if manager not found', async () => {
      const managerId = 'nonexistent';

      // Mock manager not found
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getManagerDashboardTasks(managerId)).rejects.toThrow(
        'Manager not found or inactive'
      );
    });

    it('should throw error if manager is inactive', async () => {
      const managerId = 'manager1';

      // Mock inactive manager - findUnique with isActive: true filter returns null
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getManagerDashboardTasks(managerId)).rejects.toThrow(
        'Manager not found or inactive'
      );
    });

    it('should handle empty task list', async () => {
      const managerId = 'manager1';
      const managerDeptId = 'dept1';

      // Mock manager lookup
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: managerId,
        departmentId: managerDeptId,
        role: 'MANAGER',
        isActive: true,
      });

      // Mock department hierarchy
      (mockPrisma.department.findMany as jest.Mock).mockResolvedValue([]);

      // Mock userProfile.findMany for subordinate users (empty)
      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue([]);

      // Mock empty task list
      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getManagerDashboardTasks(managerId);

      expect(result).toBeDefined();
      expect(result!.tasks).toHaveLength(0);
      expect(result!.metrics.toDo).toBe(0);
      expect(result!.metrics.inProgress).toBe(0);
      expect(result!.metrics.completed).toBe(0);
      expect(result!.metrics.blocked).toBe(0);
    });
  });
});
