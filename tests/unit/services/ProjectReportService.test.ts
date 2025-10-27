/**
 * Unit Tests for ProjectReportService (DDD Structure)
 *
 * Tests service orchestration: authorization check + repository delegation
 * Follows DDD pattern with IProjectRepository mocking
 */

import { ProjectReportService } from '@/services/project/ProjectReportService';
import { IProjectRepository } from '@/repositories/IProjectRepository';
import { PrismaClient } from '@prisma/client';

describe('ProjectReportService - DDD Pattern', () => {
  let service: ProjectReportService;
  let mockRepository: jest.Mocked<IProjectRepository>;
  let mockPrisma: jest.Mocked<Pick<PrismaClient, 'userProfile'>>;

  beforeEach(() => {
    // Mock IProjectRepository (DDD pattern)
    mockRepository = {
      getProjectReportData: jest.fn(),
      createProject: jest.fn(),
      isProjectNameUnique: jest.fn(),
      getProjectById: jest.fn(),
      getDepartmentProjects: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
      archiveProject: jest.fn(),
      getAllProjects: jest.fn(),
      getProjectsVisibleToDepartments: jest.fn(),
    } as any;

    // Mock PrismaClient (only for authorization)
    mockPrisma = {
      userProfile: {
        findUnique: jest.fn(),
      },
    } as any;

    // Instantiate service with DDD dependency injection
    service = new ProjectReportService(mockRepository, mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('Authorization (Service Layer Business Logic)', () => {
    const mockReportData = {
      project: {
        id: 'proj-1',
        name: 'Test Project',
        description: 'Description',
        priority: 5,
        status: 'ACTIVE',
        departmentName: 'Engineering',
        creatorName: 'Creator',
        creatorEmail: 'creator@example.com',
        createdAt: new Date('2025-10-01'),
        updatedAt: new Date('2025-10-20'),
      },
      tasks: [],
      collaborators: [],
    };

    it('should allow HR_ADMIN role to access report', async () => {
      const hrUser = {
        id: 'hr-user-1',
        email: 'hr@example.com',
        name: 'HR Admin',
        role: 'HR_ADMIN' as const,
        departmentId: 'dept-1',
        isHrAdmin: false,
      };

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
        hrUser as any
      );
      mockRepository.getProjectReportData.mockResolvedValue(mockReportData);

      const result = await service.getProjectReportData('proj-1', 'hr-user-1');

      expect(mockPrisma.userProfile.findUnique).toHaveBeenCalledWith({
        where: { id: 'hr-user-1' },
      });
      expect(mockRepository.getProjectReportData).toHaveBeenCalledWith(
        'proj-1'
      );
      expect(result).toBeDefined();
    });

    it('should allow user with isHrAdmin flag to access report', async () => {
      const hrUser = {
        id: 'hr-user-2',
        email: 'hradmin@example.com',
        name: 'HR Staff',
        role: 'STAFF' as const,
        departmentId: 'dept-1',
        isHrAdmin: true, // Flag set
      };

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
        hrUser as any
      );
      mockRepository.getProjectReportData.mockResolvedValue(mockReportData);

      const result = await service.getProjectReportData('proj-1', 'hr-user-2');

      expect(mockRepository.getProjectReportData).toHaveBeenCalledWith(
        'proj-1'
      );
      expect(result).toBeDefined();
    });

    it('should deny access to regular STAFF users without isHrAdmin flag', async () => {
      const regularUser = {
        id: 'staff-1',
        email: 'staff@example.com',
        name: 'Regular Staff',
        role: 'STAFF' as const,
        departmentId: 'dept-1',
        isHrAdmin: false, // No HR permissions
      };

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
        regularUser as any
      );

      await expect(
        service.getProjectReportData('proj-1', 'staff-1')
      ).rejects.toThrow('Unauthorized: Only HR/Admin users can export reports');

      // Repository should NOT be called
      expect(mockRepository.getProjectReportData).not.toHaveBeenCalled();
    });

    it('should deny access to MANAGER users without isHrAdmin flag', async () => {
      const managerUser = {
        id: 'manager-1',
        email: 'manager@example.com',
        name: 'Manager',
        role: 'MANAGER' as const,
        departmentId: 'dept-1',
        isHrAdmin: false,
      };

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
        managerUser as any
      );

      await expect(
        service.getProjectReportData('proj-1', 'manager-1')
      ).rejects.toThrow('Unauthorized: Only HR/Admin users can export reports');

      expect(mockRepository.getProjectReportData).not.toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getProjectReportData('proj-1', 'invalid-user')
      ).rejects.toThrow('User not found');

      expect(mockRepository.getProjectReportData).not.toHaveBeenCalled();
    });
  });

  describe('Repository Delegation (DDD Pattern)', () => {
    const hrUser = {
      id: 'hr-1',
      email: 'hr@example.com',
      name: 'HR Admin',
      role: 'HR_ADMIN' as const,
      departmentId: 'dept-1',
      isHrAdmin: false,
    };

    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
        hrUser as any
      );
    });

    it('should delegate to repository and return data structure', async () => {
      const mockData = {
        project: {
          id: 'proj-1',
          name: 'Website Redesign',
          description: 'Redesign company website',
          priority: 8,
          status: 'ACTIVE',
          departmentName: 'Engineering',
          creatorName: 'John Doe',
          creatorEmail: 'john@example.com',
          createdAt: new Date('2025-10-01'),
          updatedAt: new Date('2025-10-20'),
        },
        tasks: [],
        collaborators: [],
      };

      mockRepository.getProjectReportData.mockResolvedValue(mockData);

      const result = await service.getProjectReportData('proj-1', 'hr-1');

      // Verify service delegates to repository
      expect(mockRepository.getProjectReportData).toHaveBeenCalledWith(
        'proj-1'
      );

      // Verify data is returned (not checking exact values)
      expect(result).toBeDefined();
      expect(result.project).toBeDefined();
      expect(result.tasks).toBeDefined();
      expect(result.collaborators).toBeDefined();
    });

    it('should propagate repository errors (e.g., project not found)', async () => {
      mockRepository.getProjectReportData.mockRejectedValue(
        new Error('Project not found')
      );

      await expect(
        service.getProjectReportData('invalid-proj', 'hr-1')
      ).rejects.toThrow('Project not found');
    });

    it('should return data with tasks when repository provides them', async () => {
      const mockData = {
        project: {
          id: 'proj-1',
          name: 'Project',
          description: 'Description',
          priority: 5,
          status: 'ACTIVE',
          departmentName: 'Engineering',
          creatorName: 'Creator',
          creatorEmail: 'c@example.com',
          createdAt: new Date('2025-10-01'),
          updatedAt: new Date('2025-10-20'),
        },
        tasks: [
          {
            id: 'task-1',
            title: 'Design Homepage',
            description: 'Create homepage design',
            status: 'COMPLETED',
            priority: 9,
            dueDate: new Date('2025-10-25'),
            createdAt: new Date('2025-10-10'),
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            assignees: ['User 1', 'User 2'],
          },
        ],
        collaborators: [],
      };

      mockRepository.getProjectReportData.mockResolvedValue(mockData);

      const result = await service.getProjectReportData('proj-1', 'hr-1');

      // Just verify tasks array exists and has content
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBeTruthy();
    });

    it('should return data with collaborators when repository provides them', async () => {
      const mockData = {
        project: {
          id: 'proj-1',
          name: 'Project',
          description: 'Description',
          priority: 5,
          status: 'ACTIVE',
          departmentName: 'Engineering',
          creatorName: 'Creator',
          creatorEmail: 'c@example.com',
          createdAt: new Date('2025-10-01'),
          updatedAt: new Date('2025-10-20'),
        },
        tasks: [],
        collaborators: [
          {
            name: 'Collaborator 1',
            email: 'c1@example.com',
            departmentName: 'Engineering',
            addedAt: new Date('2025-10-05'),
          },
        ],
      };

      mockRepository.getProjectReportData.mockResolvedValue(mockData);

      const result = await service.getProjectReportData('proj-1', 'hr-1');

      // Just verify collaborators array exists and has content
      expect(result.collaborators).toHaveLength(1);
      expect(result.collaborators[0].name).toBeTruthy();
    });
  });
});
