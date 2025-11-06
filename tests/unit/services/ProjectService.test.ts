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
          priority: 8,
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
            departmentId: input.departmentId,
            creatorId: input.creatorId,
          },
          include: expect.any(Object),
        });

        expect(result!.name).toBe('Website Redesign');
        expect(result!.priority).toBe(8);
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
          priority: 5,
          departmentId: 'dept1',
          creatorId: 'user1',
        };

        (mockPrisma.project.create as jest.Mock).mockResolvedValue(mockCreated);

        const result = await service.create(input);

        expect(result!.priority).toBe(5);
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

        expect(result!.name).toBe('New Name');
        expect(result!.status).toBe('COMPLETED');
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

        expect(result!.status).toBe('ON_HOLD');
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

        expect(result!.isArchived).toBe(true);
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

        expect(result!.isArchived).toBe(false);
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

        expect(result!.id).toBe('proj1');
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

  describe('Query Methods', () => {
    describe('getByDepartment', () => {
      it('should get projects by department ID', async () => {
        const mockProjects = [
          {
            id: 'proj1',
            name: 'Project 1',
            departmentId: 'dept1',
            status: 'ACTIVE',
            isArchived: false,
          },
        ];

        (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
          mockProjects
        );

        const result = await service.getByDepartment('dept1');

        expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
          where: {
            departmentId: 'dept1',
            creatorId: undefined,
            status: undefined,
            isArchived: false,
          },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });

        expect(result).toHaveLength(1);
        expect(result![0].departmentId).toBe('dept1');
      });

      it('should throw error for invalid department ID', async () => {
        await expect(service.getByDepartment('')).rejects.toThrow();
      });
    });

    describe('getByCreator', () => {
      it('should get projects by creator ID', async () => {
        const mockProjects = [
          {
            id: 'proj1',
            name: 'Project 1',
            creatorId: 'user1',
            status: 'ACTIVE',
            isArchived: false,
          },
        ];

        (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
          mockProjects
        );

        const result = await service.getByCreator('user1');

        expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
          where: {
            departmentId: undefined,
            creatorId: 'user1',
            status: undefined,
            isArchived: false,
          },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });

        expect(result).toHaveLength(1);
        expect(result![0].creatorId).toBe('user1');
      });

      it('should throw error for invalid creator ID', async () => {
        await expect(service.getByCreator('')).rejects.toThrow();
      });
    });

    describe('getAll with isArchived filter', () => {
      it('should get archived projects when filter is true', async () => {
        const mockProjects = [
          {
            id: 'proj1',
            name: 'Archived Project',
            isArchived: true,
          },
        ];

        (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
          mockProjects
        );

        await service.getAll({ isArchived: true });

        expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
          where: {
            departmentId: undefined,
            creatorId: undefined,
            status: undefined,
            isArchived: true,
          },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });
      });

      it('should get active projects by default', async () => {
        const mockProjects = [
          {
            id: 'proj1',
            name: 'Active Project',
            isArchived: false,
          },
        ];

        (mockPrisma.project.findMany as jest.Mock).mockResolvedValue(
          mockProjects
        );

        await service.getAll();

        expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
          where: expect.objectContaining({
            isArchived: false,
          }),
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle getAll errors gracefully', async () => {
      (mockPrisma.project.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getAll()).rejects.toThrow();
    });

    it('should handle getById errors gracefully', async () => {
      (mockPrisma.project.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getById('proj1')).rejects.toThrow();
    });

    it('should handle getByStatus errors gracefully', async () => {
      (mockPrisma.project.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getByStatus('ACTIVE')).rejects.toThrow();
    });

    it('should handle create errors gracefully', async () => {
      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: 'dept1',
      });

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1',
        isActive: true,
      });

      (mockPrisma.project.create as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        service.create({
          name: 'Project',
          departmentId: 'dept1',
          creatorId: 'user1',
        })
      ).rejects.toThrow();
    });

    it('should handle update errors gracefully', async () => {
      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: 'proj1',
      });

      (mockPrisma.project.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        service.update('proj1', { name: 'New Name' })
      ).rejects.toThrow();
    });

    it('should handle updateStatus errors gracefully', async () => {
      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: 'proj1',
      });

      (mockPrisma.project.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        service.updateStatus('proj1', 'COMPLETED')
      ).rejects.toThrow();
    });

    it('should handle archive errors gracefully', async () => {
      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: 'proj1',
      });

      (mockPrisma.project.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.archive('proj1')).rejects.toThrow();
    });

    it('should handle unarchive errors gracefully', async () => {
      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: 'proj1',
      });

      (mockPrisma.project.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.unarchive('proj1')).rejects.toThrow();
    });

    it('should handle delete errors gracefully', async () => {
      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([]);

      (mockPrisma.project.delete as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.delete('proj1')).rejects.toThrow();
    });
  });

  describe('Validation', () => {
    it('should throw error when getById receives empty ID', async () => {
      await expect(service.getById('')).rejects.toThrow();
    });

    it('should throw error when update receives empty ID', async () => {
      await expect(service.update('', { name: 'New' })).rejects.toThrow();
    });

    it('should throw error when updateStatus receives empty ID', async () => {
      await expect(service.updateStatus('', 'ACTIVE')).rejects.toThrow();
    });

    it('should throw error when archive receives empty ID', async () => {
      await expect(service.archive('')).rejects.toThrow();
    });

    it('should throw error when unarchive receives empty ID', async () => {
      await expect(service.unarchive('')).rejects.toThrow();
    });

    it('should throw error when delete receives empty ID', async () => {
      await expect(service.delete('')).rejects.toThrow();
    });
  });
});
