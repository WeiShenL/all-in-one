/**
 * Unit Tests for ProjectService - Visibility and Department Access Features
 *
 * Tests the new functionality added to ProjectService:
 * - getVisibleProjectsForUser method
 * - Department hierarchy-based project visibility
 * - Role-based access control (STAFF, MANAGER, HR_ADMIN)
 */

import { ProjectService } from '@/services/project/ProjectService';
import { IProjectRepository } from '@/repositories/IProjectRepository';

// Mock repository
const mockRepository: jest.Mocked<IProjectRepository> = {
  createProject: jest.fn(),
  isProjectNameUnique: jest.fn(),
  getProjectById: jest.fn(),
  getDepartmentProjects: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  archiveProject: jest.fn(),
  getAllProjects: jest.fn(),
  getProjectsVisibleToDepartments: jest.fn(),
  getProjectReportData: jest.fn(),
};

// Mock dependency for getSubordinateDepartments
const mockGetSubordinateDepartments = jest.fn();

describe('ProjectService - Visibility Features', () => {
  let service: ProjectService;

  beforeEach(() => {
    service = new ProjectService(mockRepository);
    jest.clearAllMocks();
  });

  describe('getVisibleProjectsForUser', () => {
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

    describe('HR_ADMIN role', () => {
      it('should return all projects for HR_ADMIN users', async () => {
        const adminUser = {
          userId: 'admin-1',
          departmentId: 'dept-1',
          role: 'HR_ADMIN' as const,
        };

        mockRepository.getAllProjects.mockResolvedValue(mockProjects);

        const result = await service.getVisibleProjectsForUser(
          adminUser,
          { getSubordinateDepartments: mockGetSubordinateDepartments },
          { isArchived: false }
        );

        expect(mockRepository.getAllProjects).toHaveBeenCalledWith({
          isArchived: false,
        });
        expect(mockGetSubordinateDepartments).not.toHaveBeenCalled();
        expect(result).toEqual(mockProjects);
      });

      it('should return all projects including archived for HR_ADMIN users', async () => {
        const adminUser = {
          userId: 'admin-1',
          departmentId: 'dept-1',
          role: 'HR_ADMIN' as const,
        };

        mockRepository.getAllProjects.mockResolvedValue(mockProjects);

        const result = await service.getVisibleProjectsForUser(
          adminUser,
          { getSubordinateDepartments: mockGetSubordinateDepartments },
          { isArchived: true }
        );

        expect(mockRepository.getAllProjects).toHaveBeenCalledWith({
          isArchived: true,
        });
        expect(result).toEqual(mockProjects);
      });
    });

    describe('MANAGER role', () => {
      it('should return projects from own and subordinate departments for MANAGER', async () => {
        const managerUser = {
          userId: 'manager-1',
          departmentId: 'dept-1',
          role: 'MANAGER' as const,
        };

        const subordinateDepartments = ['dept-1', 'dept-2', 'dept-3'];
        mockGetSubordinateDepartments.mockResolvedValue(subordinateDepartments);
        mockRepository.getProjectsVisibleToDepartments.mockResolvedValue(
          mockProjects
        );

        const result = await service.getVisibleProjectsForUser(
          managerUser,
          { getSubordinateDepartments: mockGetSubordinateDepartments },
          { isArchived: false }
        );

        expect(mockGetSubordinateDepartments).toHaveBeenCalledWith('dept-1');
        expect(
          mockRepository.getProjectsVisibleToDepartments
        ).toHaveBeenCalledWith(subordinateDepartments, { isArchived: false });
        expect(result).toEqual(mockProjects);
      });

      it('should handle empty subordinate departments list', async () => {
        const managerUser = {
          userId: 'manager-1',
          departmentId: 'dept-1',
          role: 'MANAGER' as const,
        };

        mockGetSubordinateDepartments.mockResolvedValue([]);
        mockRepository.getProjectsVisibleToDepartments.mockResolvedValue([]);

        const result = await service.getVisibleProjectsForUser(
          managerUser,
          { getSubordinateDepartments: mockGetSubordinateDepartments },
          { isArchived: false }
        );

        expect(
          mockRepository.getProjectsVisibleToDepartments
        ).toHaveBeenCalledWith([], { isArchived: false });
        expect(result).toEqual([]);
      });
    });

    describe('STAFF role', () => {
      it('should return projects only from own department for STAFF', async () => {
        const staffUser = {
          userId: 'staff-1',
          departmentId: 'dept-1',
          role: 'STAFF' as const,
        };

        const ownDepartmentProjects = [mockProjects[0]];
        mockRepository.getProjectsVisibleToDepartments.mockResolvedValue(
          ownDepartmentProjects
        );

        const result = await service.getVisibleProjectsForUser(
          staffUser,
          { getSubordinateDepartments: mockGetSubordinateDepartments },
          { isArchived: false }
        );

        expect(mockGetSubordinateDepartments).not.toHaveBeenCalled();
        expect(
          mockRepository.getProjectsVisibleToDepartments
        ).toHaveBeenCalledWith(['dept-1'], { isArchived: false });
        expect(result).toEqual(ownDepartmentProjects);
      });

      it('should handle archived projects option for STAFF', async () => {
        const staffUser = {
          userId: 'staff-1',
          departmentId: 'dept-1',
          role: 'STAFF' as const,
        };

        mockRepository.getProjectsVisibleToDepartments.mockResolvedValue(
          mockProjects
        );

        const result = await service.getVisibleProjectsForUser(
          staffUser,
          { getSubordinateDepartments: mockGetSubordinateDepartments },
          { isArchived: true }
        );

        expect(
          mockRepository.getProjectsVisibleToDepartments
        ).toHaveBeenCalledWith(['dept-1'], { isArchived: true });
        expect(result).toEqual(mockProjects);
      });
    });

    describe('Error handling', () => {
      it('should handle repository errors gracefully', async () => {
        const staffUser = {
          userId: 'staff-1',
          departmentId: 'dept-1',
          role: 'STAFF' as const,
        };

        mockRepository.getProjectsVisibleToDepartments.mockRejectedValue(
          new Error('Database connection failed')
        );

        await expect(
          service.getVisibleProjectsForUser(
            staffUser,
            { getSubordinateDepartments: mockGetSubordinateDepartments },
            { isArchived: false }
          )
        ).rejects.toThrow('Database connection failed');
      });

      it('should handle getSubordinateDepartments errors for MANAGER', async () => {
        const managerUser = {
          userId: 'manager-1',
          departmentId: 'dept-1',
          role: 'MANAGER' as const,
        };

        mockGetSubordinateDepartments.mockRejectedValue(
          new Error('Department hierarchy service unavailable')
        );

        await expect(
          service.getVisibleProjectsForUser(
            managerUser,
            { getSubordinateDepartments: mockGetSubordinateDepartments },
            { isArchived: false }
          )
        ).rejects.toThrow('Department hierarchy service unavailable');
      });
    });

    describe('Default options', () => {
      it('should use default isArchived: false when options not provided', async () => {
        const staffUser = {
          userId: 'staff-1',
          departmentId: 'dept-1',
          role: 'STAFF' as const,
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

        mockRepository.getProjectsVisibleToDepartments.mockResolvedValue(
          mockProjects
        );

        const result = await service.getVisibleProjectsForUser(staffUser, {
          getSubordinateDepartments: mockGetSubordinateDepartments,
        });

        expect(
          mockRepository.getProjectsVisibleToDepartments
        ).toHaveBeenCalledWith(['dept-1'], { isArchived: undefined });
        expect(result).toEqual(mockProjects);
      });
    });
  });

  describe('getDepartmentProjects', () => {
    it('should return projects for a specific department', async () => {
      const user = {
        userId: 'user-1',
        departmentId: 'dept-1',
        role: 'STAFF' as const,
      };

      const departmentProjects = [
        {
          id: 'project-1',
          name: 'Department Project',
          description: 'Test project',
          priority: 5,
          status: 'ACTIVE',
          departmentId: 'dept-1',
          creatorId: 'user-1',
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepository.getDepartmentProjects.mockResolvedValue(
        departmentProjects
      );

      const result = await service.getDepartmentProjects(user, false);

      expect(mockRepository.getDepartmentProjects).toHaveBeenCalledWith(
        'dept-1',
        false
      );
      expect(result).toEqual(departmentProjects);
    });

    it('should throw error when departmentId is missing', async () => {
      const user = {
        userId: 'user-1',
        departmentId: '',
        role: 'STAFF' as const,
      };

      await expect(service.getDepartmentProjects(user, false)).rejects.toThrow(
        'Department ID is required'
      );
    });

    it('should include archived projects when requested', async () => {
      const user = {
        userId: 'user-1',
        departmentId: 'dept-1',
        role: 'STAFF' as const,
      };

      mockRepository.getDepartmentProjects.mockResolvedValue([]);

      await service.getDepartmentProjects(user, true);

      expect(mockRepository.getDepartmentProjects).toHaveBeenCalledWith(
        'dept-1',
        true
      );
    });
  });

  describe('getProjectById', () => {
    it('should return project by ID', async () => {
      const project = {
        id: 'project-1',
        name: 'Test Project',
        description: 'Test description',
        priority: 5,
        status: 'ACTIVE',
        departmentId: 'dept-1',
        creatorId: 'user-1',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.getProjectById.mockResolvedValue(project);

      const result = await service.getProjectById('project-1');

      expect(mockRepository.getProjectById).toHaveBeenCalledWith('project-1');
      expect(result).toEqual(project);
    });

    it('should return null when project not found', async () => {
      mockRepository.getProjectById.mockResolvedValue(null);

      const result = await service.getProjectById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateProject', () => {
    const existingProject = {
      id: 'project-1',
      name: 'Old Name',
      description: 'Old description',
      priority: 5,
      status: 'ACTIVE',
      departmentId: 'dept-1',
      creatorId: 'user-1',
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update project successfully', async () => {
      const user = {
        userId: 'user-1',
        departmentId: 'dept-1',
        role: 'MANAGER' as const,
      };

      mockRepository.getProjectById.mockResolvedValue(existingProject);
      mockRepository.isProjectNameUnique.mockResolvedValue(true);
      mockRepository.updateProject.mockResolvedValue();

      await service.updateProject(
        'project-1',
        {
          name: 'New Name',
          description: 'New description',
          priority: 8,
        },
        user
      );

      expect(mockRepository.getProjectById).toHaveBeenCalledWith('project-1');
      expect(mockRepository.isProjectNameUnique).toHaveBeenCalledWith(
        'New Name'
      );
      expect(mockRepository.updateProject).toHaveBeenCalled();
    });

    it('should throw error when project not found', async () => {
      const user = {
        userId: 'user-1',
        departmentId: 'dept-1',
        role: 'MANAGER' as const,
      };

      mockRepository.getProjectById.mockResolvedValue(null);

      await expect(
        service.updateProject('nonexistent', { name: 'New Name' }, user)
      ).rejects.toThrow('Project not found');
    });

    it('should check name uniqueness when name is changed', async () => {
      const user = {
        userId: 'user-1',
        departmentId: 'dept-1',
        role: 'MANAGER' as const,
      };

      mockRepository.getProjectById.mockResolvedValue(existingProject);
      mockRepository.isProjectNameUnique.mockResolvedValue(false);
      mockRepository.updateProject.mockResolvedValue();

      await expect(
        service.updateProject('project-1', { name: 'Duplicate Name' }, user)
      ).rejects.toThrow('already exists');
    });

    it('should not check name uniqueness when name is not changed', async () => {
      const user = {
        userId: 'user-1',
        departmentId: 'dept-1',
        role: 'MANAGER' as const,
      };

      mockRepository.getProjectById.mockResolvedValue(existingProject);
      mockRepository.updateProject.mockResolvedValue();

      await service.updateProject(
        'project-1',
        {
          description: 'New description',
          priority: 8,
        },
        user
      );

      expect(mockRepository.isProjectNameUnique).not.toHaveBeenCalled();
      expect(mockRepository.updateProject).toHaveBeenCalled();
    });
  });

  describe('Archive/Unarchive operations', () => {
    it('should archive project successfully', async () => {
      mockRepository.archiveProject.mockResolvedValue();

      await service.archiveProject('project-1');

      expect(mockRepository.archiveProject).toHaveBeenCalledWith('project-1');
    });

    it('should unarchive project successfully', async () => {
      const project = {
        id: 'project-1',
        name: 'Test Project',
        description: 'Test description',
        priority: 5,
        status: 'ACTIVE',
        departmentId: 'dept-1',
        creatorId: 'user-1',
        isArchived: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.getProjectById.mockResolvedValue(project);
      mockRepository.updateProject.mockResolvedValue();

      await service.unarchiveProject('project-1');

      expect(mockRepository.getProjectById).toHaveBeenCalledWith('project-1');
      expect(mockRepository.updateProject).toHaveBeenCalled();
    });

    it('should throw error when unarchiving non-existent project', async () => {
      mockRepository.getProjectById.mockResolvedValue(null);

      await expect(service.unarchiveProject('nonexistent')).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('Delete operations', () => {
    it('should delete project successfully', async () => {
      mockRepository.deleteProject.mockResolvedValue();

      await service.deleteProject('project-1');

      expect(mockRepository.deleteProject).toHaveBeenCalledWith('project-1');
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

      mockRepository.getAllProjects.mockResolvedValue(mockProjects);

      const result = await service.getAllProjects(filters);

      expect(mockRepository.getAllProjects).toHaveBeenCalledWith(filters);
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

      mockRepository.getAllProjects.mockResolvedValue(mockProjects);

      const result = await service.getAllProjects();

      expect(mockRepository.getAllProjects).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockProjects);
    });
  });

  describe('getProjectsByCreator', () => {
    it('should return projects by creator', async () => {
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

      mockRepository.getAllProjects.mockResolvedValue(mockProjects);

      const result = await service.getProjectsByCreator('user-1');

      expect(mockRepository.getAllProjects).toHaveBeenCalledWith({
        creatorId: 'user-1',
      });
      expect(result).toEqual(mockProjects);
    });
  });

  describe('getProjectsByStatus', () => {
    it('should return projects by status', async () => {
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

      mockRepository.getAllProjects.mockResolvedValue(mockProjects);

      const result = await service.getProjectsByStatus('ACTIVE');

      expect(mockRepository.getAllProjects).toHaveBeenCalledWith({
        status: 'ACTIVE',
      });
      expect(result).toEqual(mockProjects);
    });
  });
});
