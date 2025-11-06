/**
 * Unit Tests for DashboardTaskService
 */

import { DashboardTaskService } from '@/app/server/services/DashboardTaskService';
import { PrismaClient } from '@prisma/client';

// Mock AuthorizationService
jest.mock('@/app/server/services/AuthorizationService', () => ({
  AuthorizationService: jest.fn().mockImplementation(() => ({
    canEditTask: jest.fn().mockReturnValue(true),
  })),
}));

describe('DashboardTaskService - Core Functionality', () => {
  let service: DashboardTaskService;
  let mockPrisma: any;

  beforeEach(() => {
    // Minimal mock setup
    mockPrisma = {
      task: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      taskAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        delete: jest.fn(),
      },
      userProfile: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      department: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      project: {
        findUnique: jest.fn(),
      },
      tag: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      taskTag: {
        findUnique: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        delete: jest.fn(),
      },
      calendarEvent: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaClient;

    service = new DashboardTaskService(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================
  // STATIC METHOD
  // ===========================
  describe('deriveInvolvedDepartments', () => {
    it('should derive unique departments', () => {
      const assignments = [
        {
          user: {
            departmentId: 'dept1',
            department: { id: 'dept1', name: 'Engineering' },
          },
        },
        {
          user: {
            departmentId: 'dept2',
            department: { id: 'dept2', name: 'Marketing' },
          },
        },
      ];

      const result =
        DashboardTaskService.deriveInvolvedDepartments(assignments);

      expect(result).toHaveLength(2);
    });

    it('should handle empty assignments', () => {
      expect(DashboardTaskService.deriveInvolvedDepartments([])).toEqual([]);
    });
  });

  // ===========================
  // BASIC OPERATIONS
  // ===========================
  describe('getAll', () => {
    it('should return tasks', async () => {
      await service.getAll();
      expect(mockPrisma.task.findMany).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should return null for non-existent task', async () => {
      const result = await service.getById('task1');
      expect(result).toBeNull();
    });

    it('should throw for invalid ID', async () => {
      await expect(service.getById('')).rejects.toThrow();
    });
  });

  describe('getByAssignee', () => {
    it('should return empty array', async () => {
      const result = await service.getByAssignee('user1');
      expect(result).toEqual([]);
    });
  });

  // ===========================
  // CREATION
  // ===========================
  describe('create', () => {
    it('should throw if owner not found', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          title: 'Task',
          description: 'Desc',
          ownerId: 'user1',
          departmentId: 'dept1',
          dueDate: new Date('2025-12-31'),
        })
      ).rejects.toThrow('Owner not found or inactive');
    });

    it('should throw if department not found', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user1',
        isActive: true,
      });
      mockPrisma.department.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          title: 'Task',
          description: 'Desc',
          ownerId: 'user1',
          departmentId: 'dept1',
          dueDate: new Date('2025-12-31'),
        })
      ).rejects.toThrow('Department not found');
    });
  });

  // ===========================
  // UPDATE
  // ===========================
  describe('update', () => {
    it('should throw if task not found', async () => {
      await expect(service.update('task1', { title: 'New' })).rejects.toThrow(
        'Task not found'
      );
    });
  });

  describe('updateStatus', () => {
    it('should throw if task not found', async () => {
      await expect(service.updateStatus('task1', 'COMPLETED')).rejects.toThrow(
        'Task not found'
      );
    });
  });

  // ===========================
  // ASSIGNMENT
  // ===========================
  describe('assignUser', () => {
    it('should throw if task not found', async () => {
      await expect(
        service.assignUser('task1', 'user2', 'user1')
      ).rejects.toThrow('Task not found');
    });

    it('should enforce max 5 assignees', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task1',
        assignments: [
          { userId: 'u1' },
          { userId: 'u2' },
          { userId: 'u3' },
          { userId: 'u4' },
          { userId: 'u5' },
        ],
      });

      await expect(service.assignUser('task1', 'u6', 'user1')).rejects.toThrow(
        'Maximum 5 assignees'
      );
    });
  });

  describe('unassignUser', () => {
    it('should call delete', async () => {
      mockPrisma.taskAssignment.delete.mockResolvedValue({});
      await service.unassignUser('task1', 'user2');
      expect(mockPrisma.taskAssignment.delete).toHaveBeenCalled();
    });
  });

  // ===========================
  // DELETE/ARCHIVE
  // ===========================
  describe('delete', () => {
    it('should throw if task has subtasks', async () => {
      mockPrisma.task.findMany.mockResolvedValue([{ id: 'subtask1' }]);
      await expect(service.delete('task1')).rejects.toThrow(
        'Cannot delete task with subtasks'
      );
    });
  });

  describe('archive', () => {
    it('should throw if task not found', async () => {
      await expect(service.archive('task1')).rejects.toThrow('Task not found');
    });
  });

  // ===========================
  // TAGS
  // ===========================
  describe('addTag', () => {
    it('should throw if task not found', async () => {
      await expect(service.addTag('task1', 'tag1')).rejects.toThrow(
        'Task not found'
      );
    });
  });

  describe('removeTag', () => {
    it('should call delete', async () => {
      mockPrisma.taskTag.delete.mockResolvedValue({});
      await service.removeTag('task1', 'tag1');
      expect(mockPrisma.taskTag.delete).toHaveBeenCalled();
    });
  });

  // ===========================
  // CALENDAR
  // ===========================
  describe('createCalendarEvent', () => {
    it('should throw if task not found', async () => {
      await expect(
        service.createCalendarEvent('task1', 'user1', 'Event', new Date())
      ).rejects.toThrow('Task not found');
    });
  });

  describe('getCalendarEvents', () => {
    it('should return events', async () => {
      const result = await service.getCalendarEvents('task1');
      expect(result).toEqual([]);
    });
  });

  // ===========================
  // HIERARCHY
  // ===========================
  describe('getTaskHierarchy', () => {
    it('should throw if task not found', async () => {
      await expect(service.getTaskHierarchy('task1')).rejects.toThrow(
        'Task not found'
      );
    });
  });

  describe('getSubordinateDepartments', () => {
    it('should return department IDs', async () => {
      const result = await service.getSubordinateDepartments('dept1');
      expect(result).toEqual(['dept1']);
    });
  });

  // ===========================
  // DASHBOARD VIEWS
  // ===========================
  describe('getManagerDashboardTasks', () => {
    it('should throw if manager not found', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      await expect(service.getManagerDashboardTasks('mgr1')).rejects.toThrow(
        'Manager not found'
      );
    });
  });

  describe('getDepartmentTasksForUser', () => {
    it('should throw if user not found', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      await expect(service.getDepartmentTasksForUser('user1')).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('getCompanyTasks', () => {
    it('should throw for non-HR user', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user1',
        departmentId: 'dept1',
        role: 'STAFF',
        isActive: true,
        isHrAdmin: false,
      });

      await expect(service.getCompanyTasks('user1')).rejects.toThrow(
        'Access denied'
      );
    });

    it('should return tasks for HR admin', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'hr1',
        departmentId: 'dept1',
        role: 'HR_ADMIN',
        isActive: true,
        isHrAdmin: true,
      });

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task1',
          departmentId: 'dept1',
          priority: 5,
          recurringInterval: null,
          ownerId: 'user1',
          assignments: [],
          department: { id: 'dept1', name: 'Eng' },
          project: null,
          owner: { id: 'user1', name: 'John', email: 'j@test.com' },
          tags: [],
          comments: [],
          subtasks: [],
        },
      ]);

      const result = await service.getCompanyTasks('hr1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getAvailableParentTasks', () => {
    it('should return tasks for manager', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'mgr1',
        departmentId: 'dept1',
        role: 'MANAGER',
        isActive: true,
      });

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task1',
          title: 'Parent',
          dueDate: new Date(),
          parentTaskId: null,
          status: 'TO_DO',
          priority: 5,
          departmentId: 'dept1',
          projectId: null,
        },
      ]);

      const result = await service.getAvailableParentTasks('mgr1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getProjectTasksForUser', () => {
    it('should return project tasks', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user1',
        departmentId: 'dept1',
        role: 'STAFF',
        isActive: true,
      });

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task1',
          departmentId: 'dept1',
          priority: 5,
          recurringInterval: null,
          assignments: [],
          department: { id: 'dept1', name: 'Eng' },
          project: { id: 'proj1', name: 'Proj' },
          owner: { id: 'user1', name: 'John', email: 'j@test.com' },
          tags: [],
          comments: [],
          subtasks: [],
        },
      ]);

      const result = await service.getProjectTasksForUser('user1', 'proj1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getManagerProjectTasks', () => {
    it('should return dashboard data', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'mgr1',
        departmentId: 'dept1',
        role: 'MANAGER',
        isActive: true,
      });

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task1',
          title: 'Task',
          description: 'Desc',
          priority: 5,
          dueDate: new Date(),
          status: 'IN_PROGRESS',
          ownerId: 'user1',
          departmentId: 'dept1',
          assignments: [],
          department: { id: 'dept1', name: 'Eng' },
          project: { id: 'proj1', name: 'Proj' },
        },
      ]);

      const result = await service.getManagerProjectTasks('mgr1', 'proj1');
      expect(result.tasks).toHaveLength(1);
      expect(result.metrics.inProgress).toBe(1);
    });
  });

  describe('getByProject', () => {
    it('should get tasks by project', async () => {
      await service.getByProject('proj1');
      expect(mockPrisma.task.findMany).toHaveBeenCalled();
    });
  });

  describe('getByOwner', () => {
    it('should get tasks by owner', async () => {
      await service.getByOwner('user1');
      expect(mockPrisma.task.findMany).toHaveBeenCalled();
    });
  });

  describe('getSubtasks', () => {
    it('should get subtasks', async () => {
      await service.getSubtasks('parent1');
      expect(mockPrisma.task.findMany).toHaveBeenCalled();
    });
  });

  describe('getByDepartment', () => {
    it('should get department tasks', async () => {
      await service.getByDepartment('dept1');
      expect(mockPrisma.task.findMany).toHaveBeenCalled();
    });
  });

  describe('assignUser success', () => {
    it('should assign user when valid', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task1',
        assignments: [],
      });
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user2',
        isActive: true,
      });
      mockPrisma.taskAssignment.findUnique.mockResolvedValue(null);
      mockPrisma.taskAssignment.create.mockResolvedValue({
        taskId: 'task1',
        userId: 'user2',
        assignedById: 'user1',
        user: { id: 'user2', name: 'Jane', email: 'j@test.com', role: 'STAFF' },
        assignedBy: { id: 'user1', name: 'John' },
      });

      const result = await service.assignUser('task1', 'user2', 'user1');
      expect(result).toBeDefined();
    });
  });

  describe('addTag success', () => {
    it('should add tag when valid', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 'task1' });
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 'tag1',
        name: 'urgent',
      });
      mockPrisma.taskTag.findUnique.mockResolvedValue(null);
      mockPrisma.taskTag.create.mockResolvedValue({
        taskId: 'task1',
        tagId: 'tag1',
        tag: { id: 'tag1', name: 'urgent' },
      });

      const result = await service.addTag('task1', 'tag1');
      expect(result).toBeDefined();
    });
  });

  describe('createCalendarEvent success', () => {
    it('should create event when valid', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 'task1' });
      mockPrisma.calendarEvent.create.mockResolvedValue({
        id: 'event1',
        taskId: 'task1',
        userId: 'user1',
        title: 'Event',
        eventDate: new Date(),
        task: { id: 'task1', title: 'Task' },
      });

      const result = await service.createCalendarEvent(
        'task1',
        'user1',
        'Event',
        new Date()
      );
      expect(result).toBeDefined();
    });
  });

  describe('delete success', () => {
    it('should delete when no subtasks', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.task.delete.mockResolvedValue({ id: 'task1' });

      const result = await service.delete('task1');
      expect(result).toBeDefined();
    });
  });

  describe('archive success', () => {
    it('should archive task', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task1',
        assignments: [],
      });
      mockPrisma.task.update.mockResolvedValue({
        id: 'task1',
        isArchived: true,
      });

      const result = await service.archive('task1');
      expect(result).toBeDefined();
    });
  });

  describe('update success', () => {
    it('should update task', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task1',
        assignments: [],
      });
      mockPrisma.task.update.mockResolvedValue({
        id: 'task1',
        title: 'Updated',
      });

      const result = await service.update('task1', { title: 'Updated' });
      expect(result).toBeDefined();
    });
  });

  describe('updateStatus success', () => {
    it('should update status', async () => {
      mockPrisma.task.findUnique
        .mockResolvedValueOnce({
          id: 'task1',
          recurringInterval: null,
          assignments: [],
          tags: [],
        })
        .mockResolvedValueOnce({ id: 'task1', assignments: [] });
      mockPrisma.task.update.mockResolvedValue({
        id: 'task1',
        status: 'COMPLETED',
      });

      const result = await service.updateStatus('task1', 'COMPLETED');
      expect(result).toBeDefined();
    });
  });

  describe('getById success', () => {
    it('should return task when found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task1',
        title: 'Task',
        owner: { id: 'user1', name: 'John', email: 'j@test.com' },
      });

      const result = await service.getById('task1');
      expect(result?.id).toBe('task1');
    });
  });

  describe('getTaskHierarchy success', () => {
    it('should return hierarchy', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task1',
        title: 'Task',
        parentTaskId: null,
      });
      mockPrisma.task.findMany.mockResolvedValue([]);

      const result = await service.getTaskHierarchy('task1');
      expect(result?.currentTask.id).toBe('task1');
    });
  });

  describe('getManagerDashboardTasks success', () => {
    it('should return dashboard', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'mgr1',
        departmentId: 'dept1',
        role: 'MANAGER',
        isActive: true,
      });
      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task1',
          status: 'TO_DO',
          assignments: [],
          department: { id: 'dept1', name: 'Eng' },
        },
      ]);

      const result = await service.getManagerDashboardTasks('mgr1');
      expect(result.tasks).toHaveLength(1);
      expect(result.metrics.toDo).toBe(1);
    });
  });

  describe('getDepartmentTasksForUser success', () => {
    it('should return tasks', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user1',
        departmentId: 'dept1',
        role: 'STAFF',
        isActive: true,
      });
      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task1',
          departmentId: 'dept1',
          priority: 5,
          recurringInterval: null,
          startDate: null,
          ownerId: 'user1',
          assignments: [],
          department: { id: 'dept1', name: 'Eng' },
          project: null,
          tags: [],
          comments: [],
          owner: { id: 'user1', name: 'John', email: 'j@test.com' },
          subtasks: [],
        },
      ]);

      const result = await service.getDepartmentTasksForUser('user1');
      expect(result).toHaveLength(1);
      expect(result![0]).toHaveProperty('canEdit');
    });
  });

  // ===========================
  // Others
  // ===========================
  describe('getCompanyTasks with subtasks', () => {
    it('should process subtasks with canEdit', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'hr1',
        departmentId: 'dept1',
        role: 'HR_ADMIN',
        isActive: true,
        isHrAdmin: true,
      });
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task1',
          departmentId: 'dept1',
          priority: 5,
          recurringInterval: 7,
          ownerId: 'user1',
          assignments: [],
          department: { id: 'dept1', name: 'Eng' },
          project: null,
          owner: { id: 'user1', name: 'John', email: 'j@test.com' },
          tags: [{ tag: { name: 'urgent' } }],
          comments: [
            {
              id: 'c1',
              content: 'Test',
              userId: 'user1',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          subtasks: [
            {
              id: 'sub1',
              departmentId: 'dept1',
              priority: 3,
              recurringInterval: null,
              assignments: [
                {
                  userId: 'user2',
                  user: { id: 'user2', departmentId: 'dept1' },
                },
              ],
              tags: [{ tag: { name: 'backend' } }],
              comments: [],
              owner: { id: 'user2', name: 'Jane', email: 'jane@test.com' },
            },
          ],
        },
      ]);

      const result = await service.getCompanyTasks('hr1');
      expect(result![0].subtasks).toHaveLength(1);
      expect(result![0].subtasks![0]).toHaveProperty('canEdit');
    });
  });

  describe('create without optional fields', () => {
    it('should create without project', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user1',
        isActive: true,
      });
      mockPrisma.department.findUnique.mockResolvedValue({ id: 'dept1' });
      mockPrisma.task.create.mockResolvedValue({
        id: 'task1',
        owner: { id: 'user1', name: 'John', email: 'j@test.com' },
        department: { id: 'dept1', name: 'Eng' },
        parentTask: null,
      });
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task1',
        owner: { id: 'user1', name: 'John', email: 'j@test.com' },
      });

      await service.create({
        title: 'Task',
        description: 'Desc',
        ownerId: 'user1',
        departmentId: 'dept1',
        dueDate: new Date('2025-12-31'),
      });

      expect(mockPrisma.project.findUnique).not.toHaveBeenCalled();
    });

    it('should throw if project not found when provided', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user1',
        isActive: true,
      });
      mockPrisma.department.findUnique.mockResolvedValue({ id: 'dept1' });
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          title: 'Task',
          description: 'Desc',
          ownerId: 'user1',
          departmentId: 'dept1',
          projectId: 'proj1',
          dueDate: new Date('2025-12-31'),
        })
      ).rejects.toThrow('Project not found');
    });
  });

  describe('parentTask validation', () => {
    it('should validate parent exists', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user1',
        isActive: true,
      });
      mockPrisma.department.findUnique.mockResolvedValue({ id: 'dept1' });
      mockPrisma.task.findUnique
        .mockResolvedValueOnce({ id: 'parent1', parentTaskId: null })
        .mockResolvedValueOnce({
          id: 'task1',
          owner: { id: 'user1', name: 'John', email: 'j@test.com' },
        });
      mockPrisma.task.create.mockResolvedValue({
        id: 'task1',
        owner: { id: 'user1', name: 'John', email: 'j@test.com' },
        department: { id: 'dept1', name: 'Eng' },
        parentTask: { id: 'parent1' },
      });

      await service.create({
        title: 'Subtask',
        description: 'Desc',
        ownerId: 'user1',
        departmentId: 'dept1',
        parentTaskId: 'parent1',
        dueDate: new Date('2025-12-31'),
      });

      expect(mockPrisma.task.findUnique).toHaveBeenCalled();
    });

    it('should throw if parent not found', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user1',
        isActive: true,
      });
      mockPrisma.department.findUnique.mockResolvedValue({ id: 'dept1' });
      mockPrisma.task.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create({
          title: 'Task',
          description: 'Desc',
          ownerId: 'user1',
          departmentId: 'dept1',
          parentTaskId: 'nonexistent',
          dueDate: new Date('2025-12-31'),
        })
      ).rejects.toThrow('Parent task not found');
    });

    it('should throw if nesting too deep', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user1',
        isActive: true,
      });
      mockPrisma.department.findUnique.mockResolvedValue({ id: 'dept1' });
      mockPrisma.task.findUnique.mockResolvedValueOnce({
        id: 'child1',
        parentTaskId: 'parent1',
      });

      await expect(
        service.create({
          title: 'Task',
          description: 'Desc',
          ownerId: 'user1',
          departmentId: 'dept1',
          parentTaskId: 'child1',
          dueDate: new Date('2025-12-31'),
        })
      ).rejects.toThrow('Maximum subtask depth');
    });
  });

  describe('assignee validation', () => {
    it('should throw if assignees count mismatch', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user1',
        isActive: true,
      });
      mockPrisma.department.findUnique.mockResolvedValue({ id: 'dept1' });
      mockPrisma.userProfile.findMany.mockResolvedValue([
        { id: 'user2', isActive: true },
      ]);

      await expect(
        service.create({
          title: 'Task',
          description: 'Desc',
          ownerId: 'user1',
          departmentId: 'dept1',
          assigneeIds: ['user2', 'user3'],
          dueDate: new Date('2025-12-31'),
        })
      ).rejects.toThrow('One or more assignees not found');
    });

    it('should throw if assignee inactive', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user1',
        isActive: true,
      });
      mockPrisma.department.findUnique.mockResolvedValue({ id: 'dept1' });
      mockPrisma.userProfile.findMany.mockResolvedValue([
        { id: 'user2', isActive: false },
      ]);

      await expect(
        service.create({
          title: 'Task',
          description: 'Desc',
          ownerId: 'user1',
          departmentId: 'dept1',
          assigneeIds: ['user2'],
          dueDate: new Date('2025-12-31'),
        })
      ).rejects.toThrow('One or more assignees are inactive');
    });
  });

  describe('tag handling', () => {
    it('should use existing tag', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user1',
        isActive: true,
      });
      mockPrisma.department.findUnique.mockResolvedValue({ id: 'dept1' });
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 'tag1',
        name: 'urgent',
      });
      mockPrisma.task.create.mockResolvedValue({
        id: 'task1',
        owner: { id: 'user1', name: 'John', email: 'j@test.com' },
        department: { id: 'dept1', name: 'Eng' },
        parentTask: null,
      });
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task1',
        owner: { id: 'user1', name: 'John', email: 'j@test.com' },
      });
      mockPrisma.taskTag.createMany.mockResolvedValue({ count: 1 });

      await service.create({
        title: 'Task',
        description: 'Desc',
        ownerId: 'user1',
        departmentId: 'dept1',
        tags: ['urgent'],
        dueDate: new Date('2025-12-31'),
      });

      expect(mockPrisma.tag.create).not.toHaveBeenCalled();
    });
  });

  describe('assignment edge cases', () => {
    it('should throw if user inactive on assign', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task1',
        assignments: [],
      });
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user2',
        isActive: false,
      });

      await expect(
        service.assignUser('task1', 'user2', 'user1')
      ).rejects.toThrow('User not found or inactive');
    });

    it('should throw if user not found on assign', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task1',
        assignments: [],
      });
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.assignUser('task1', 'user2', 'user1')
      ).rejects.toThrow('User not found or inactive');
    });
  });

  describe('tag edge cases', () => {
    it('should throw if tag not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 'task1' });
      mockPrisma.tag.findUnique.mockResolvedValue(null);

      await expect(service.addTag('task1', 'nonexistent')).rejects.toThrow(
        'Tag not found'
      );
    });
  });

  describe('metrics with all statuses', () => {
    it('should calculate BLOCKED status', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'mgr1',
        departmentId: 'dept1',
        role: 'MANAGER',
        isActive: true,
      });
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 't1',
          status: 'BLOCKED',
          assignments: [],
          department: { id: 'dept1', name: 'Eng' },
        },
        {
          id: 't2',
          status: 'BLOCKED',
          assignments: [],
          department: { id: 'dept1', name: 'Eng' },
        },
      ]);

      const result = await service.getManagerDashboardTasks('mgr1');
      expect(result.metrics.blocked).toBe(2);
    });
  });

  describe('getCompanyTasks filters', () => {
    it('should filter by assignee', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'hr1',
        departmentId: 'dept1',
        role: 'HR_ADMIN',
        isActive: true,
        isHrAdmin: true,
      });
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.task.findMany.mockResolvedValue([]);

      await service.getCompanyTasks('hr1', { assigneeId: 'user2' });

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignments: { some: { userId: 'user2' } },
          }),
        })
      );
    });
  });

  describe('owner inactive', () => {
    it('should throw if owner inactive', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user1',
        isActive: false,
      });

      await expect(
        service.create({
          title: 'Task',
          description: 'Desc',
          ownerId: 'user1',
          departmentId: 'dept1',
          dueDate: new Date('2025-12-31'),
        })
      ).rejects.toThrow('Owner not found or inactive');
    });
  });
});
