import { ProjectService } from '@/app/server/services/ProjectService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  project: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  department: {
    findUnique: jest.fn(),
  },
  userProfile: {
    findUnique: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(() => {
    service = new ProjectService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    describe('Create', () => {
      it('should create a new project', async () => {
        const input = {
          name: 'Website Redesign',
          description: 'Redesign company website',
          priority: 'HIGH' as const,
          dueDate: new Date('2025-12-31'),
          departmentId: 'dept1',
          creatorId: 'user1',
        };

        (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
          id: 'dept1',
          name: 'Engineering',
        });

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user1',
          isActive: true,
        });

        const mockCreated = {
          id: 'proj1',
          ...input,
          status: 'ACTIVE',
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          department: { id: 'dept1', name: 'Engineering' },
          creator: {
            id: 'user1',
            name: 'Creator',
            email: 'creator@example.com',
          },
        };

        (mockPrisma.project.create as jest.Mock).mockResolvedValue(mockCreated);

        const result = await service.create(input);

        expect(mockPrisma.project.create).toHaveBeenCalledWith({
          data: {
            name: input.name,
            description: input.description,
            priority: input.priority,
            dueDate: input.dueDate,
            departmentId: input.departmentId,
            creatorId: input.creatorId,
          },
          include: expect.any(Object),
        });

        expect(result.name).toBe('Website Redesign');
        expect(result.priority).toBe('HIGH');
      });

      it('should use default priority MEDIUM when not provided', async () => {
        const input = {
          name: 'Project',
          departmentId: 'dept1',
          creatorId: 'user1',
        };

        (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
          id: 'dept1',
        });

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user1',
          isActive: true,
        });

        const mockCreated = {
          id: 'proj1',
          name: 'Project',
          priority: 'MEDIUM',
          departmentId: 'dept1',
          creatorId: 'user1',
        };

        (mockPrisma.project.create as jest.Mock).mockResolvedValue(mockCreated);

        const result = await service.create(input);

        expect(result.priority).toBe('MEDIUM');
      });

      it('should throw error when department not found', async () => {
        const input = {
          name: 'Project',
          departmentId: 'nonexistent',
          creatorId: 'user1',
        };

        (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(service.create(input)).rejects.toThrow(
          'Department not found'
        );
      });

      it('should throw error when creator not found or inactive', async () => {
        const input = {
          name: 'Project',
          departmentId: 'dept1',
          creatorId: 'nonexistent',
        };

        (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
          id: 'dept1',
        });

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
          null
        );

        await expect(service.create(input)).rejects.toThrow(
          'Creator not found or inactive'
        );
      });
    });

    describe('Read', () => {
      it('should get all projects', async () => {
        const mockProjects = [
          {
            id: 'proj1',
            name: 'Project 1',
            status: 'ACTIVE',
            isArchived: false,
            department: { id: 'dept1', name: 'Engineering' },
            creator: {
              id: 'user1',
              name: 'Creator',
              email: 'creator@example.com',
            },
            tasks: [],
          },
        ];

        (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
          mockProjects
        );

        const result = await service.getAll();

        expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
          where: {
            departmentId: undefined,
            creatorId: undefined,
            status: undefined,
            isArchived: false,
          },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });

        expect(result).toHaveLength(1);
      });

      it('should get projects with filters', async () => {
        const mockProjects = [
          {
            id: 'proj1',
            name: 'Project 1',
            status: 'ACTIVE',
            departmentId: 'dept1',
          },
        ];

        (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
          mockProjects
        );

        await service.getAll({
          departmentId: 'dept1',
          status: 'ACTIVE',
        });

        expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
          where: {
            departmentId: 'dept1',
            creatorId: undefined,
            status: 'ACTIVE',
            isArchived: false,
          },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });
      });

      it('should get project by ID', async () => {
        const mockProject = {
          id: 'proj1',
          name: 'Project 1',
          department: { id: 'dept1', name: 'Engineering' },
          creator: {
            id: 'user1',
            name: 'Creator',
            email: 'creator@example.com',
            role: 'MANAGER',
          },
          tasks: [],
        };

        (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue(
          mockProject
        );

        const result = await service.getById('proj1');

        expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
          where: { id: 'proj1' },
          include: expect.any(Object),
        });

        expect(result?.name).toBe('Project 1');
      });

      it('should get projects by status', async () => {
        const mockProjects = [
          {
            id: 'proj1',
            name: 'Project 1',
            status: 'COMPLETED',
          },
        ];

        (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
          mockProjects
        );

        await service.getByStatus('COMPLETED');

        expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
          where: {
            departmentId: undefined,
            creatorId: undefined,
            status: 'COMPLETED',
            isArchived: false,
          },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });
      });
    });

    describe('Update', () => {
      it('should update a project', async () => {
        const existingProject = {
          id: 'proj1',
          name: 'Old Name',
        };

        const updateData = {
          name: 'New Name',
          status: 'COMPLETED' as const,
        };

        (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue(
          existingProject
        );

        const mockUpdated = {
          ...existingProject,
          ...updateData,
          updatedAt: new Date(),
        };

        (mockPrisma.project.update as jest.Mock).mockResolvedValue(mockUpdated);

        const result = await service.update('proj1', updateData);

        expect(mockPrisma.project.update).toHaveBeenCalledWith({
          where: { id: 'proj1' },
          data: updateData,
          include: expect.any(Object),
        });

        expect(result.name).toBe('New Name');
        expect(result.status).toBe('COMPLETED');
      });

      it('should throw error when project not found', async () => {
        (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(
          service.update('nonexistent', { name: 'New' })
        ).rejects.toThrow('Project not found');
      });

      it('should update project status', async () => {
        const existingProject = {
          id: 'proj1',
          status: 'ACTIVE',
        };

        (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue(
          existingProject
        );

        const mockUpdated = {
          ...existingProject,
          status: 'ON_HOLD',
        };

        (mockPrisma.project.update as jest.Mock).mockResolvedValue(mockUpdated);

        const result = await service.updateStatus('proj1', 'ON_HOLD');

        expect(result.status).toBe('ON_HOLD');
      });
    });

    describe('Archive/Unarchive', () => {
      it('should archive a project', async () => {
        const existingProject = {
          id: 'proj1',
          isArchived: false,
        };

        (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue(
          existingProject
        );

        const mockArchived = {
          ...existingProject,
          isArchived: true,
        };

        (mockPrisma.project.update as jest.Mock).mockResolvedValue(
          mockArchived
        );

        const result = await service.archive('proj1');

        expect(result.isArchived).toBe(true);
      });

      it('should unarchive a project', async () => {
        const existingProject = {
          id: 'proj1',
          isArchived: true,
        };

        (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue(
          existingProject
        );

        const mockUnarchived = {
          ...existingProject,
          isArchived: false,
        };

        (mockPrisma.project.update as jest.Mock).mockResolvedValue(
          mockUnarchived
        );

        const result = await service.unarchive('proj1');

        expect(result.isArchived).toBe(false);
      });
    });

    describe('Delete', () => {
      it('should delete project when no tasks exist', async () => {
        (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([]);

        const mockDeleted = {
          id: 'proj1',
          name: 'Project',
        };

        (mockPrisma.project.delete as jest.Mock).mockResolvedValue(mockDeleted);

        const result = await service.delete('proj1');

        expect(mockPrisma.project.delete).toHaveBeenCalledWith({
          where: { id: 'proj1' },
        });

        expect(result.id).toBe('proj1');
      });

      it('should throw error when project has tasks', async () => {
        (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([
          { id: 'task1', projectId: 'proj1' },
        ]);

        await expect(service.delete('proj1')).rejects.toThrow(
          'Cannot delete project with existing tasks. Archive it instead.'
        );
      });
    });
  });
});
