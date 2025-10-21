/**
 * Unit Tests for PrismaProjectRepository - Visibility Features
 *
 * Tests the new functionality added to PrismaProjectRepository:
 * - getProjectsVisibleToDepartments method
 * - Department access bridge table integration
 * - Complex OR queries for project visibility
 */

import { PrismaProjectRepository } from '@/repositories/PrismaProjectRepository';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  project: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  projectDepartmentAccess: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('PrismaProjectRepository - Visibility Features', () => {
  let repository: PrismaProjectRepository;

  beforeEach(() => {
    repository = new PrismaProjectRepository(mockPrisma);
    jest.clearAllMocks();
  });

  describe('getProjectsVisibleToDepartments', () => {
    const mockProjects = [
      {
        id: 'project-1',
        name: 'Project 1',
        description: 'Description 1',
        priority: 5,
        status: 'ACTIVE',
        departmentId: 'dept-1',
        creatorId: 'user-1',
        isArchived: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'project-2',
        name: 'Project 2',
        description: 'Description 2',
        priority: 8,
        status: 'ACTIVE',
        departmentId: 'dept-2',
        creatorId: 'user-2',
        isArchived: false,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ];

    const mockAccessRows = [
      { projectId: 'project-3' },
      { projectId: 'project-4' },
    ];

    it('should return empty array when no department IDs provided', async () => {
      const result = await repository.getProjectsVisibleToDepartments([]);

      expect(result).toEqual([]);
      expect(
        mockPrisma.projectDepartmentAccess.findMany
      ).not.toHaveBeenCalled();
      expect(mockPrisma.project.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array when department IDs is null', async () => {
      const result = await repository.getProjectsVisibleToDepartments(
        null as any
      );

      expect(result).toEqual([]);
      expect(
        mockPrisma.projectDepartmentAccess.findMany
      ).not.toHaveBeenCalled();
      expect(mockPrisma.project.findMany).not.toHaveBeenCalled();
    });

    it('should return projects from primary departments only when no access rows', async () => {
      (
        mockPrisma.projectDepartmentAccess.findMany as jest.Mock
      ).mockResolvedValue([]);
      (mockPrisma.project.findMany as jest.Mock).mockResolvedValue([
        mockProjects[0],
      ]);

      const result = await repository.getProjectsVisibleToDepartments([
        'dept-1',
      ]);

      expect(mockPrisma.projectDepartmentAccess.findMany).toHaveBeenCalledWith({
        where: { departmentId: { in: ['dept-1'] } },
        select: { projectId: true },
      });

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ departmentId: { in: ['dept-1'] } }],
          isArchived: false,
        },
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
          status: true,
          departmentId: true,
          creatorId: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      expect(result).toEqual([mockProjects[0]]);
    });

    it('should return projects from both primary departments and access rows', async () => {
      (
        mockPrisma.projectDepartmentAccess.findMany as jest.Mock
      ).mockResolvedValue(mockAccessRows);
      (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
        mockProjects
      );

      const result = await repository.getProjectsVisibleToDepartments([
        'dept-1',
        'dept-2',
      ]);

      expect(mockPrisma.projectDepartmentAccess.findMany).toHaveBeenCalledWith({
        where: { departmentId: { in: ['dept-1', 'dept-2'] } },
        select: { projectId: true },
      });

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { departmentId: { in: ['dept-1', 'dept-2'] } },
            { id: { in: ['project-3', 'project-4'] } },
          ],
          isArchived: false,
        },
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
          status: true,
          departmentId: true,
          creatorId: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      expect(result).toEqual(mockProjects);
    });

    it('should handle archived projects option', async () => {
      (
        mockPrisma.projectDepartmentAccess.findMany as jest.Mock
      ).mockResolvedValue([]);
      (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
        mockProjects
      );

      const result = await repository.getProjectsVisibleToDepartments(
        ['dept-1'],
        {
          isArchived: true,
        }
      );

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ departmentId: { in: ['dept-1'] } }],
          isArchived: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
          status: true,
          departmentId: true,
          creatorId: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      expect(result).toEqual(mockProjects);
    });

    it('should handle undefined isArchived option (default to false)', async () => {
      (
        mockPrisma.projectDepartmentAccess.findMany as jest.Mock
      ).mockResolvedValue([]);
      (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
        mockProjects
      );

      const result = await repository.getProjectsVisibleToDepartments(
        ['dept-1'],
        {
          isArchived: undefined,
        }
      );

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ departmentId: { in: ['dept-1'] } }],
          isArchived: false,
        },
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
          status: true,
          departmentId: true,
          creatorId: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      expect(result).toEqual(mockProjects);
    });

    it('should handle empty access rows correctly', async () => {
      (
        mockPrisma.projectDepartmentAccess.findMany as jest.Mock
      ).mockResolvedValue([]);
      (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
        mockProjects
      );

      const result = await repository.getProjectsVisibleToDepartments([
        'dept-1',
      ]);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ departmentId: { in: ['dept-1'] } }],
          isArchived: false,
        },
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
          status: true,
          departmentId: true,
          creatorId: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      expect(result).toEqual(mockProjects);
    });

    it('should handle database errors gracefully', async () => {
      (
        mockPrisma.projectDepartmentAccess.findMany as jest.Mock
      ).mockRejectedValue(new Error('Database connection failed'));

      await expect(
        repository.getProjectsVisibleToDepartments(['dept-1'])
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle project query errors gracefully', async () => {
      (
        mockPrisma.projectDepartmentAccess.findMany as jest.Mock
      ).mockResolvedValue([]);
      (mockPrisma.project.findMany as jest.Mock).mockRejectedValue(
        new Error('Project query failed')
      );

      await expect(
        repository.getProjectsVisibleToDepartments(['dept-1'])
      ).rejects.toThrow('Project query failed');
    });

    it('should deduplicate project IDs from access rows', async () => {
      const duplicateAccessRows = [
        { projectId: 'project-3' },
        { projectId: 'project-4' },
        { projectId: 'project-3' }, // Duplicate
        { projectId: 'project-5' },
      ];

      (
        mockPrisma.projectDepartmentAccess.findMany as jest.Mock
      ).mockResolvedValue(duplicateAccessRows);
      (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
        mockProjects
      );

      await repository.getProjectsVisibleToDepartments(['dept-1']);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { departmentId: { in: ['dept-1'] } },
            { id: { in: ['project-3', 'project-4', 'project-5'] } }, // Deduplicated
          ],
          isArchived: false,
        },
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
          status: true,
          departmentId: true,
          creatorId: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });
    });
  });

  describe('isProjectNameUnique', () => {
    it('should return true when project name is unique', async () => {
      (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.isProjectNameUnique(
        'Unique Project Name'
      );

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: 'Unique Project Name',
            mode: 'insensitive',
          },
          isArchived: false,
        },
      });

      expect(result).toBe(true);
    });

    it('should return false when project name already exists', async () => {
      (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-project',
        name: 'Existing Project',
      });

      const result = await repository.isProjectNameUnique('Existing Project');

      expect(result).toBe(false);
    });

    it('should perform case-insensitive comparison', async () => {
      (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-project',
        name: 'existing project',
      });

      const result = await repository.isProjectNameUnique('EXISTING PROJECT');

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: 'EXISTING PROJECT',
            mode: 'insensitive',
          },
          isArchived: false,
        },
      });

      expect(result).toBe(false);
    });

    it('should only check non-archived projects', async () => {
      (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(null);

      await repository.isProjectNameUnique('Test Project');

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: 'Test Project',
            mode: 'insensitive',
          },
          isArchived: false, // Only check non-archived projects
        },
      });
    });
  });

  describe('getAllProjects', () => {
    it('should return all projects with filters', async () => {
      const filters = {
        departmentId: 'dept-1',
        creatorId: 'user-1',
        status: 'ACTIVE',
        isArchived: false,
      };

      const mockProjects = [
        {
          id: 'project-1',
          name: 'Project 1',
          description: 'Description 1',
          priority: 5,
          status: 'ACTIVE',
          departmentId: 'dept-1',
          creatorId: 'user-1',
          isArchived: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
        mockProjects
      );

      const result = await repository.getAllProjects(filters);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          departmentId: 'dept-1',
          creatorId: 'user-1',
          status: 'ACTIVE',
          isArchived: false,
        },
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
          status: true,
          departmentId: true,
          creatorId: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      expect(result).toEqual(mockProjects);
    });

    it('should return all projects without filters', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Project 1',
          description: 'Description 1',
          priority: 5,
          status: 'ACTIVE',
          departmentId: 'dept-1',
          creatorId: 'user-1',
          isArchived: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
        mockProjects
      );

      const result = await repository.getAllProjects();

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          departmentId: undefined,
          creatorId: undefined,
          status: undefined,
          isArchived: false,
        },
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
          status: true,
          departmentId: true,
          creatorId: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      expect(result).toEqual(mockProjects);
    });

    it('should handle undefined isArchived filter (default to false)', async () => {
      const filters = {
        departmentId: 'dept-1',
        isArchived: undefined,
      };

      const mockProjects = [
        {
          id: 'project-1',
          name: 'Project 1',
          description: 'Description 1',
          priority: 5,
          status: 'ACTIVE',
          departmentId: 'dept-1',
          creatorId: 'user-1',
          isArchived: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
        mockProjects
      );

      await repository.getAllProjects(filters);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          departmentId: 'dept-1',
          creatorId: undefined,
          status: undefined,
          isArchived: false, // Default to false
        },
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
          status: true,
          departmentId: true,
          creatorId: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });
    });
  });
});
