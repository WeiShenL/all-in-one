/**
 * Unit Tests for Project Router
 * Tests tRPC endpoints for project CRUD operations
 */

import { projectRouter } from '@/app/server/routers/project';
import { PrismaProjectRepository } from '@/repositories/PrismaProjectRepository';
import { ProjectService } from '@/services/project/ProjectService';
import type { PrismaClient } from '@prisma/client';
import { ProjectStatus } from '@/domain/project/Project';

// Mock dependencies
jest.mock('@/repositories/PrismaProjectRepository');
jest.mock('@/services/project/ProjectService');
jest.mock('@/app/server/services/DashboardTaskService', () => ({
  DashboardTaskService: jest.fn().mockImplementation(() => ({
    getSubordinateDepartments: jest.fn().mockResolvedValue([]),
  })),
}));

const MockPrismaProjectRepository = PrismaProjectRepository as jest.MockedClass<
  typeof PrismaProjectRepository
>;
const MockProjectService = ProjectService as jest.MockedClass<
  typeof ProjectService
>;

describe('Project Router', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockProjectService: jest.Mocked<ProjectService>;
  let mockRepo: jest.Mocked<PrismaProjectRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Prisma client
    mockPrisma = {
      userProfile: {
        findUnique: jest.fn(),
      },
      project: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as any;

    // Mock service methods
    mockProjectService = {
      getAllProjects: jest.fn(),
      getProjectById: jest.fn(),
      getProjectsByCreator: jest.fn(),
      getProjectsByStatus: jest.fn(),
      getVisibleProjectsForUser: jest.fn(),
      createProject: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
      archiveProject: jest.fn(),
      unarchiveProject: jest.fn(),
    } as any;

    mockRepo = {} as any;

    MockPrismaProjectRepository.mockImplementation(() => mockRepo);
    MockProjectService.mockImplementation(() => mockProjectService);
  });

  describe('getUserContext helper', () => {
    it('should throw error when user is not authenticated', async () => {
      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await expect(
        caller.create({
          name: 'Test Project',
        })
      ).rejects.toThrow('User not authenticated');
    });

    it('should throw error when user profile not found', async () => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: 'user-123',
      });

      await expect(
        caller.create({
          name: 'Test Project',
        })
      ).rejects.toThrow('User profile not found');
    });

    it('should return user context when authenticated', async () => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        departmentId: 'dept-1',
        role: 'STAFF',
      });

      mockProjectService.createProject.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
        creatorId: 'user-123',
        departmentId: 'dept-1',
      } as any);

      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: 'user-123',
      });

      await caller.create({ name: 'Test Project' });

      expect(mockPrisma.userProfile.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });
  });

  describe('getAll', () => {
    it('should get all projects without filters', async () => {
      const mockProjects = [
        { id: 'proj-1', name: 'Project 1', status: ProjectStatus.ACTIVE },
        { id: 'proj-2', name: 'Project 2', status: ProjectStatus.ACTIVE },
      ];

      mockProjectService.getAllProjects.mockResolvedValue(mockProjects as any);

      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.getAll();

      expect(result).toEqual(mockProjects);
      expect(mockProjectService.getAllProjects).toHaveBeenCalledWith(undefined);
    });

    it('should filter by departmentId', async () => {
      mockProjectService.getAllProjects.mockResolvedValue([]);

      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.getAll({ departmentId: 'dept-1' });

      expect(mockProjectService.getAllProjects).toHaveBeenCalledWith({
        departmentId: 'dept-1',
      });
    });

    it('should filter by creatorId', async () => {
      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.getAll({ creatorId: 'user-123' });

      expect(mockProjectService.getAllProjects).toHaveBeenCalledWith({
        creatorId: 'user-123',
      });
    });

    it('should filter by status', async () => {
      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.getAll({ status: ProjectStatus.COMPLETED });

      expect(mockProjectService.getAllProjects).toHaveBeenCalledWith({
        status: ProjectStatus.COMPLETED,
      });
    });

    it('should filter by isArchived', async () => {
      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.getAll({ isArchived: true });

      expect(mockProjectService.getAllProjects).toHaveBeenCalledWith({
        isArchived: true,
      });
    });

    it('should handle multiple filters', async () => {
      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.getAll({
        departmentId: 'dept-1',
        status: ProjectStatus.ACTIVE,
        isArchived: false,
      });

      expect(mockProjectService.getAllProjects).toHaveBeenCalledWith({
        departmentId: 'dept-1',
        status: ProjectStatus.ACTIVE,
        isArchived: false,
      });
    });
  });

  describe('getById', () => {
    it('should get project by ID', async () => {
      const mockProject = {
        id: 'proj-1',
        name: 'Test Project',
        status: ProjectStatus.ACTIVE,
      };

      mockProjectService.getProjectById.mockResolvedValue(mockProject as any);

      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.getById({ id: 'proj-1' });

      expect(result).toEqual(mockProject);
      expect(mockProjectService.getProjectById).toHaveBeenCalledWith('proj-1');
    });

    it('should handle non-existent project', async () => {
      mockProjectService.getProjectById.mockResolvedValue(null);

      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.getById({ id: 'non-existent' });

      expect(result).toBeNull();
    });
  });

  describe('getByDepartment', () => {
    it('should get projects by department', async () => {
      const mockProjects = [{ id: 'proj-1', departmentId: 'dept-1' }];

      mockProjectService.getAllProjects.mockResolvedValue(mockProjects as any);

      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.getByDepartment({ departmentId: 'dept-1' });

      expect(result).toEqual(mockProjects);
      expect(mockProjectService.getAllProjects).toHaveBeenCalledWith({
        departmentId: 'dept-1',
      });
    });
  });

  describe('getByCreator', () => {
    it('should get projects by creator', async () => {
      const mockProjects = [{ id: 'proj-1', creatorId: 'user-123' }];

      mockProjectService.getProjectsByCreator.mockResolvedValue(
        mockProjects as any
      );

      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.getByCreator({ creatorId: 'user-123' });

      expect(result).toEqual(mockProjects);
      expect(mockProjectService.getProjectsByCreator).toHaveBeenCalledWith(
        'user-123'
      );
    });
  });

  describe('getByStatus', () => {
    it('should get projects by status', async () => {
      const mockProjects = [{ id: 'proj-1', status: ProjectStatus.ACTIVE }];

      mockProjectService.getProjectsByStatus.mockResolvedValue(
        mockProjects as any
      );

      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.getByStatus({ status: ProjectStatus.ACTIVE });

      expect(result).toEqual(mockProjects);
      expect(mockProjectService.getProjectsByStatus).toHaveBeenCalledWith(
        ProjectStatus.ACTIVE
      );
    });

    it('should handle all project statuses', async () => {
      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const statuses = [
        ProjectStatus.ACTIVE,
        ProjectStatus.COMPLETED,
        ProjectStatus.ON_HOLD,
      ];

      for (const status of statuses) {
        await caller.getByStatus({ status });
        expect(mockProjectService.getProjectsByStatus).toHaveBeenCalledWith(
          status
        );
      }
    });
  });

  describe('create', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        departmentId: 'dept-1',
        role: 'STAFF',
      });
    });

    it('should create project with required fields', async () => {
      const mockProject = {
        id: 'proj-1',
        name: 'New Project',
        creatorId: 'user-123',
        departmentId: 'dept-1',
      };

      mockProjectService.createProject.mockResolvedValue(mockProject as any);

      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: 'user-123',
      });

      const result = await caller.create({
        name: 'New Project',
      });

      expect(result).toEqual(mockProject);
      expect(mockProjectService.createProject).toHaveBeenCalledWith(
        {
          name: 'New Project',
          description: undefined,
          priority: undefined,
        },
        expect.objectContaining({
          userId: 'user-123',
          departmentId: 'dept-1',
          role: 'STAFF',
        })
      );
    });

    it('should create project with optional fields', async () => {
      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: 'user-123',
      });

      await caller.create({
        name: 'Project with Details',
        description: 'Detailed description',
        priority: 8,
      });

      expect(mockProjectService.createProject).toHaveBeenCalledWith(
        {
          name: 'Project with Details',
          description: 'Detailed description',
          priority: 8,
        },
        expect.any(Object)
      );
    });

    it('should validate name is required', async () => {
      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: 'user-123',
      });

      await expect(
        caller.create({
          name: '',
        })
      ).rejects.toThrow();
    });

    it('should validate priority range', async () => {
      const caller = projectRouter.createCaller({
        prisma: mockPrisma,
        userId: 'user-123',
      });

      await expect(
        caller.create({
          name: 'Test',
          priority: 0,
        })
      ).rejects.toThrow();

      await expect(
        caller.create({
          name: 'Test',
          priority: 11,
        })
      ).rejects.toThrow();
    });
  });
});
