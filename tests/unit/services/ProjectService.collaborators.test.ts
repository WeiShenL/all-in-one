/**
 * Unit Tests for ProjectService Collaborator Management (SCRUM-33)
 *
 * Tests the business logic for:
 * - getProjectCollaborators
 * - removeProjectCollaborator
 */

import { ProjectService } from '@/services/project/ProjectService';
import { IProjectRepository } from '@/repositories/IProjectRepository';

describe(`ProjectService Collaborator Management - ${Date.now()}`, () => {
  let projectService: ProjectService;
  let mockRepository: jest.Mocked<IProjectRepository>;

  const testProjectId = 'project-123';
  const testUserId = 'user-456';
  const managerContext = {
    userId: 'manager-789',
    role: 'MANAGER' as const,
    departmentId: 'dept-1',
  };
  const staffContext = {
    userId: 'staff-999',
    role: 'STAFF' as const,
    departmentId: 'dept-1',
  };

  beforeEach(() => {
    // Create mock repository with all required methods
    mockRepository = {
      getProjectCollaborators: jest.fn(),
      removeProjectCollaborator: jest.fn(),
      getProjectById: jest.fn(),
      createProject: jest.fn(),
      isProjectNameUnique: jest.fn(),
      getDepartmentProjects: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
      archiveProject: jest.fn(),
      getAllProjects: jest.fn(),
      getProjectsVisibleToDepartments: jest.fn(),
    } as any;

    projectService = new ProjectService(mockRepository);
  });

  describe('getProjectCollaborators', () => {
    it('should return collaborators from repository', async () => {
      const mockCollaborators = [
        {
          id: 'user-1',
          email: 'user1@test.com',
          name: 'User 1',
          role: 'STAFF',
          departmentId: 'dept-1',
          isHrAdmin: false,
          isActive: true,
        },
        {
          id: 'user-2',
          email: 'user2@test.com',
          name: 'User 2',
          role: 'STAFF',
          departmentId: 'dept-1',
          isHrAdmin: false,
          isActive: true,
        },
      ];

      mockRepository.getProjectCollaborators.mockResolvedValue(
        mockCollaborators
      );

      const result = await projectService.getProjectCollaborators(
        testProjectId,
        staffContext
      );

      expect(result).toEqual(mockCollaborators);
      expect(mockRepository.getProjectCollaborators).toHaveBeenCalledWith(
        testProjectId
      );
    });

    it('should return empty array when no collaborators exist', async () => {
      mockRepository.getProjectCollaborators.mockResolvedValue([]);

      const result = await projectService.getProjectCollaborators(
        testProjectId,
        staffContext
      );

      expect(result).toEqual([]);
    });
  });

  describe('removeProjectCollaborator - Authorization', () => {
    it('should allow managers to remove collaborators', async () => {
      mockRepository.getProjectById.mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
        description: null,
        priority: 5,
        status: 'ACTIVE',
        departmentId: 'dept-1',
        creatorId: 'creator-1',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockRepository.removeProjectCollaborator.mockResolvedValue(undefined);

      await projectService.removeProjectCollaborator(
        testProjectId,
        testUserId,
        managerContext
      );

      expect(mockRepository.removeProjectCollaborator).toHaveBeenCalledWith(
        testProjectId,
        testUserId
      );
    });

    it('should allow HR_ADMIN to remove collaborators', async () => {
      const adminContext = {
        userId: 'admin-1',
        role: 'ADMIN' as const,
        departmentId: 'dept-1',
      };

      mockRepository.getProjectById.mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
        description: null,
        priority: 5,
        status: 'ACTIVE',
        departmentId: 'dept-1',
        creatorId: 'creator-1',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockRepository.removeProjectCollaborator.mockResolvedValue(undefined);

      await projectService.removeProjectCollaborator(
        testProjectId,
        testUserId,
        adminContext
      );

      expect(mockRepository.removeProjectCollaborator).toHaveBeenCalledWith(
        testProjectId,
        testUserId
      );
    });

    it('should deny staff from removing collaborators', async () => {
      await expect(
        projectService.removeProjectCollaborator(
          testProjectId,
          testUserId,
          staffContext
        )
      ).rejects.toThrow('Only managers can remove collaborators from projects');

      expect(mockRepository.removeProjectCollaborator).not.toHaveBeenCalled();
    });
  });

  describe('removeProjectCollaborator - Validation', () => {
    it('should throw error if project does not exist', async () => {
      mockRepository.getProjectById.mockResolvedValue(null);

      await expect(
        projectService.removeProjectCollaborator(
          testProjectId,
          testUserId,
          managerContext
        )
      ).rejects.toThrow('Project not found');

      expect(mockRepository.removeProjectCollaborator).not.toHaveBeenCalled();
    });

    it('should propagate repository errors for business rule violations', async () => {
      mockRepository.getProjectById.mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
        description: null,
        priority: 5,
        status: 'ACTIVE',
        departmentId: 'dept-1',
        creatorId: 'creator-1',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockRepository.removeProjectCollaborator.mockRejectedValue(
        new Error(
          'Cannot remove user from task "Task 1" - it must have at least one assignee'
        )
      );

      await expect(
        projectService.removeProjectCollaborator(
          testProjectId,
          testUserId,
          managerContext
        )
      ).rejects.toThrow(/must have at least one assignee/);
    });
  });

  describe('removeProjectCollaborator - Integration with Repository', () => {
    it('should call repository with correct parameters', async () => {
      mockRepository.getProjectById.mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
        description: null,
        priority: 5,
        status: 'ACTIVE',
        departmentId: 'dept-1',
        creatorId: 'creator-1',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockRepository.removeProjectCollaborator.mockResolvedValue(undefined);

      await projectService.removeProjectCollaborator(
        testProjectId,
        testUserId,
        managerContext
      );

      expect(mockRepository.getProjectById).toHaveBeenCalledWith(testProjectId);
      expect(mockRepository.removeProjectCollaborator).toHaveBeenCalledWith(
        testProjectId,
        testUserId
      );
    });

    it('should verify project exists before removing collaborator', async () => {
      mockRepository.getProjectById.mockResolvedValue(null);

      await expect(
        projectService.removeProjectCollaborator(
          testProjectId,
          testUserId,
          managerContext
        )
      ).rejects.toThrow('Project not found');

      expect(mockRepository.getProjectById).toHaveBeenCalledWith(testProjectId);
      expect(mockRepository.removeProjectCollaborator).not.toHaveBeenCalled();
    });
  });
});
