/**
 * Unit Tests for DashboardTaskService - getAvailableParentTasks
 * Tests parent task visibility based on user role
 *
 * Business Rules:
 * - MANAGERS: Can see all parent tasks in department hierarchy (subordinate departments)
 * - STAFF: Can only see parent tasks they are assigned to
 * - Only parent tasks (parentTaskId = null) should be returned
 * - Archived tasks should be excluded
 */

import { PrismaClient } from '@prisma/client';
import { TaskService as DashboardTaskService } from '@/app/server/services/TaskService';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    userProfile: {
      findUnique: jest.fn(),
    },
    department: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('DashboardTaskService - getAvailableParentTasks', () => {
  let service: DashboardTaskService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    service = new DashboardTaskService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('Manager Role', () => {
    it('should return all parent tasks in department hierarchy for manager', async () => {
      const managerId = 'manager-001';
      const departmentId = 'dept-001';
      const subordinateDeptId = 'dept-002';

      // Mock user profile - Manager
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: managerId,
        departmentId,
        role: 'MANAGER',
        isActive: true,
      });

      // Mock department hierarchy
      mockPrisma.department.findUnique.mockResolvedValue({
        id: departmentId,
        name: 'Engineering',
        parentId: null,
      });

      // Mock department.findMany to handle recursive calls properly
      // First call returns subordinate dept, subsequent calls return empty array (no more children)
      mockPrisma.department.findMany
        .mockResolvedValueOnce([{ id: subordinateDeptId }])
        .mockResolvedValue([]);

      // Mock parent tasks in hierarchy
      const mockParentTasks = [
        {
          id: 'task-001',
          title: 'Project Alpha',
          dueDate: new Date('2025-12-31'),
          parentTaskId: null,
          status: 'IN_PROGRESS',
          priority: 8,
          departmentId,
          projectId: 'project-001',
        },
        {
          id: 'task-002',
          title: 'Project Beta',
          dueDate: new Date('2025-11-30'),
          parentTaskId: null,
          status: 'TO_DO',
          priority: 7,
          departmentId: subordinateDeptId,
          projectId: 'project-002',
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockParentTasks);

      // Execute
      const result = await service.getAvailableParentTasks(managerId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toEqual(mockParentTasks);

      // Verify query included department hierarchy
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isArchived: false,
            parentTaskId: null,
            OR: expect.arrayContaining([
              expect.objectContaining({
                departmentId: expect.objectContaining({
                  in: expect.arrayContaining([departmentId, subordinateDeptId]),
                }),
              }),
            ]),
          }),
        })
      );
    });

    it('should exclude subtasks for manager', async () => {
      const managerId = 'manager-001';
      const departmentId = 'dept-001';

      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: managerId,
        departmentId,
        role: 'MANAGER',
        isActive: true,
      });

      mockPrisma.department.findUnique.mockResolvedValue({
        id: departmentId,
        name: 'Engineering',
        parentId: null,
      });

      mockPrisma.department.findMany.mockResolvedValue([]);

      // Only parent tasks should be returned
      const mockParentTasks = [
        {
          id: 'task-001',
          title: 'Project Alpha',
          dueDate: new Date('2025-12-31'),
          parentTaskId: null,
          status: 'IN_PROGRESS',
          priority: 8,
          departmentId,
          projectId: null,
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockParentTasks);

      const result = await service.getAvailableParentTasks(managerId);

      expect(result).toHaveLength(1);
      expect(result[0].parentTaskId).toBeNull();

      // Verify parentTaskId: null filter was applied
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentTaskId: null,
          }),
        })
      );
    });

    it('should exclude archived tasks for manager', async () => {
      const managerId = 'manager-001';
      const departmentId = 'dept-001';

      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: managerId,
        departmentId,
        role: 'MANAGER',
        isActive: true,
      });

      mockPrisma.department.findUnique.mockResolvedValue({
        id: departmentId,
        name: 'Engineering',
        parentId: null,
      });

      mockPrisma.department.findMany.mockResolvedValue([]);

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-001',
          title: 'Active Task',
          dueDate: new Date('2025-12-31'),
          parentTaskId: null,
          status: 'IN_PROGRESS',
          priority: 8,
          departmentId,
          projectId: null,
        },
      ]);

      const result = await service.getAvailableParentTasks(managerId);

      expect(result).toHaveLength(1);

      // Verify isArchived: false filter was applied
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isArchived: false,
          }),
        })
      );
    });
  });

  describe('Staff Role', () => {
    it('should return only assigned parent tasks for staff', async () => {
      const staffId = 'staff-001';
      const departmentId = 'dept-001';

      // Mock user profile - Staff
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: staffId,
        departmentId,
        role: 'STAFF',
        isActive: true,
      });

      // Mock department hierarchy (staff still sees hierarchy for other queries)
      mockPrisma.department.findUnique.mockResolvedValue({
        id: departmentId,
        name: 'Engineering',
        parentId: null,
      });

      mockPrisma.department.findMany.mockResolvedValue([]);

      // Mock tasks - only assigned tasks should be returned
      const mockAssignedTasks = [
        {
          id: 'task-001',
          title: 'Assigned Task',
          dueDate: new Date('2025-12-31'),
          parentTaskId: null,
          status: 'IN_PROGRESS',
          priority: 8,
          departmentId,
          projectId: 'project-001',
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockAssignedTasks);

      // Execute
      const result = await service.getAvailableParentTasks(staffId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Assigned Task');

      // Verify query filtered by assignment
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isArchived: false,
            parentTaskId: null,
            assignments: expect.objectContaining({
              some: expect.objectContaining({
                userId: staffId,
              }),
            }),
          }),
        })
      );
    });

    it('should not return unassigned tasks for staff', async () => {
      const staffId = 'staff-001';
      const departmentId = 'dept-001';

      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: staffId,
        departmentId,
        role: 'STAFF',
        isActive: true,
      });

      mockPrisma.department.findUnique.mockResolvedValue({
        id: departmentId,
        name: 'Engineering',
        parentId: null,
      });

      mockPrisma.department.findMany.mockResolvedValue([]);

      // No tasks assigned to this staff member
      mockPrisma.task.findMany.mockResolvedValue([]);

      const result = await service.getAvailableParentTasks(staffId);

      expect(result).toHaveLength(0);

      // Verify query included assignment filter
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignments: expect.objectContaining({
              some: expect.objectContaining({
                userId: staffId,
              }),
            }),
          }),
        })
      );
    });

    it('should exclude subtasks for staff', async () => {
      const staffId = 'staff-001';
      const departmentId = 'dept-001';

      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: staffId,
        departmentId,
        role: 'STAFF',
        isActive: true,
      });

      mockPrisma.department.findUnique.mockResolvedValue({
        id: departmentId,
        name: 'Engineering',
        parentId: null,
      });

      mockPrisma.department.findMany.mockResolvedValue([]);

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-001',
          title: 'Parent Task',
          dueDate: new Date('2025-12-31'),
          parentTaskId: null,
          status: 'IN_PROGRESS',
          priority: 8,
          departmentId,
          projectId: null,
        },
      ]);

      const result = await service.getAvailableParentTasks(staffId);

      expect(result[0].parentTaskId).toBeNull();

      // Verify parentTaskId: null filter was applied
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentTaskId: null,
          }),
        })
      );
    });
  });

  describe('HR Admin Role', () => {
    it('should return only assigned parent tasks for HR admin (like staff)', async () => {
      const hrAdminId = 'hr-admin-001';
      const departmentId = 'dept-001';

      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: hrAdminId,
        departmentId,
        role: 'HR_ADMIN',
        isActive: true,
      });

      mockPrisma.department.findUnique.mockResolvedValue({
        id: departmentId,
        name: 'HR',
        parentId: null,
      });

      mockPrisma.department.findMany.mockResolvedValue([]);

      const mockAssignedTasks = [
        {
          id: 'task-001',
          title: 'HR Task',
          dueDate: new Date('2025-12-31'),
          parentTaskId: null,
          status: 'TO_DO',
          priority: 5,
          departmentId,
          projectId: null,
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockAssignedTasks);

      const result = await service.getAvailableParentTasks(hrAdminId);

      expect(result).toHaveLength(1);

      // Verify query filtered by assignment (like staff)
      // HR_ADMIN role is for company-wide view, not for expanded parent task access
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignments: expect.objectContaining({
              some: expect.objectContaining({
                userId: hrAdminId,
              }),
            }),
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid user ID', async () => {
      // Mock to return null for invalid ID (simulating validation failure or not found)
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      mockPrisma.department.findMany.mockResolvedValue([]);

      await expect(
        service.getAvailableParentTasks('invalid-uuid')
      ).rejects.toThrow('User not found or inactive');
    });

    it('should throw error for non-existent user', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      mockPrisma.department.findMany.mockResolvedValue([]);

      await expect(service.getAvailableParentTasks('user-999')).rejects.toThrow(
        'User not found or inactive'
      );
    });

    it('should throw error for inactive user', async () => {
      // The query uses `where: { id: userId, isActive: true }`, so inactive users won't be found
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      mockPrisma.department.findMany.mockResolvedValue([]);

      await expect(service.getAvailableParentTasks('user-001')).rejects.toThrow(
        'User not found or inactive'
      );
    });
  });

  describe('Task Ordering', () => {
    it('should order tasks by due date ascending', async () => {
      const managerId = 'manager-001';
      const departmentId = 'dept-001';

      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: managerId,
        departmentId,
        role: 'MANAGER',
        isActive: true,
      });

      mockPrisma.department.findUnique.mockResolvedValue({
        id: departmentId,
        name: 'Engineering',
        parentId: null,
      });

      mockPrisma.department.findMany.mockResolvedValue([]);

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-001',
          title: 'Due Later',
          dueDate: new Date('2025-12-31'),
          parentTaskId: null,
          status: 'TO_DO',
          priority: 5,
          departmentId,
          projectId: null,
        },
        {
          id: 'task-002',
          title: 'Due Sooner',
          dueDate: new Date('2025-11-30'),
          parentTaskId: null,
          status: 'TO_DO',
          priority: 5,
          departmentId,
          projectId: null,
        },
      ]);

      await service.getAvailableParentTasks(managerId);

      // Verify orderBy was included in query
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            dueDate: 'asc',
          },
        })
      );
    });
  });
});
