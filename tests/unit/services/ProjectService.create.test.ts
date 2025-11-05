/**
 * Unit Tests for ProjectService.createProject()
 * Testing Service Layer Orchestration for Project Creation - SCRUM-30
 *
 * DDD Layer: SERVICE
 * Tests: Service orchestration, external validations, repository coordination
 *
 * Acceptance Criteria Covered:
 * - AC1: Staff can create projects
 * - AC2: Project names must be unique (within department)
 * - AC3: Project name must be given (delegated to domain)
 */

import { ProjectService } from '@/services/project/ProjectService';
import { IProjectRepository } from '@/repositories/IProjectRepository';
import { Project, ProjectStatus } from '@/domain/project/Project';

describe('ProjectService.createProject() - Service Orchestration', () => {
  let projectService: ProjectService;
  let mockProjectRepository: jest.Mocked<IProjectRepository>;

  const testUser = {
    userId: 'user-123',
    departmentId: 'dept-456',
    role: 'STAFF' as const,
  };

  beforeEach(() => {
    // Mock IProjectRepository
    mockProjectRepository = {
      createProject: jest.fn(),
      isProjectNameUnique: jest.fn(),
      getProjectById: jest.fn(),
      getDepartmentProjects: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
      archiveProject: jest.fn(),
    } as any;

    projectService = new ProjectService(mockProjectRepository);

    jest.clearAllMocks();
  });

  describe('Successful Project Creation (AC1)', () => {
    it('should create project with valid data and unique name', async () => {
      const input = {
        name: 'Customer Portal Redesign',
        description: 'Redesign the customer portal',
        priority: 7,
      };

      // Mock: Name is unique
      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);
      mockProjectRepository.createProject.mockResolvedValue({
        id: 'project-123',
      });

      const result = await projectService.createProject(input, testUser);

      // Verify uniqueness check was called
      expect(mockProjectRepository.isProjectNameUnique).toHaveBeenCalledWith(
        'Customer Portal Redesign'
      );

      // Verify repository was called
      expect(mockProjectRepository.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          getName: expect.any(Function),
          getId: expect.any(Function),
        })
      );

      // Verify result
      expect(result).toEqual({
        id: 'project-123',
        name: 'Customer Portal Redesign',
      });
    });

    it('should trim whitespace from name before uniqueness check', async () => {
      const input = {
        name: '  Customer Portal  ',
        description: 'Test',
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);
      mockProjectRepository.createProject.mockResolvedValue({
        id: 'project-123',
      });

      await projectService.createProject(input, testUser);

      // Should check with trimmed name
      expect(mockProjectRepository.isProjectNameUnique).toHaveBeenCalledWith(
        'Customer Portal'
      );
    });

    it('should create project with default priority 5', async () => {
      const input = {
        name: 'Test Project',
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);
      mockProjectRepository.createProject.mockResolvedValue({
        id: 'project-123',
      });

      await projectService.createProject(input, testUser);

      const createdProject = mockProjectRepository.createProject.mock
        .calls[0][0] as Project;
      expect(createdProject.getPriority()).toBe(5);
    });

    it('should create project with default status ACTIVE', async () => {
      const input = {
        name: 'Test Project',
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);
      mockProjectRepository.createProject.mockResolvedValue({
        id: 'project-123',
      });

      await projectService.createProject(input, testUser);

      const createdProject = mockProjectRepository.createProject.mock
        .calls[0][0] as Project;
      expect(createdProject.getStatus()).toBe(ProjectStatus.ACTIVE);
    });

    it('should associate project with user department', async () => {
      const input = {
        name: 'Test Project',
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);
      mockProjectRepository.createProject.mockResolvedValue({
        id: 'project-123',
      });

      await projectService.createProject(input, testUser);

      const createdProject = mockProjectRepository.createProject.mock
        .calls[0][0] as Project;
      expect(createdProject.getDepartmentId()).toBe('dept-456');
    });

    it('should associate project with creator', async () => {
      const input = {
        name: 'Test Project',
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);
      mockProjectRepository.createProject.mockResolvedValue({
        id: 'project-123',
      });

      await projectService.createProject(input, testUser);

      const createdProject = mockProjectRepository.createProject.mock
        .calls[0][0] as Project;
      expect(createdProject.getCreatorId()).toBe('user-123');
    });
  });

  describe('Name Uniqueness Validation (AC2)', () => {
    it('should reject duplicate project name in same department', async () => {
      const input = {
        name: 'Existing Project',
        description: 'This name already exists',
      };

      // Mock: Name is NOT unique
      mockProjectRepository.isProjectNameUnique.mockResolvedValue(false);

      await expect(
        projectService.createProject(input, testUser)
      ).rejects.toThrow('already exists');

      // Should check uniqueness
      expect(mockProjectRepository.isProjectNameUnique).toHaveBeenCalledWith(
        'Existing Project'
      );

      // Should NOT call createProject
      expect(mockProjectRepository.createProject).not.toHaveBeenCalled();
    });

    it('should check uniqueness case-insensitively', async () => {
      const input = {
        name: 'customer portal',
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(false);

      await expect(
        projectService.createProject(input, testUser)
      ).rejects.toThrow();

      // Service should pass the name as-is (trimmed)
      // Repository handles case-insensitive check
      expect(mockProjectRepository.isProjectNameUnique).toHaveBeenCalledWith(
        'customer portal'
      );
    });

    it('should include project name in error message', async () => {
      const input = {
        name: 'Duplicate Name',
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(false);

      await expect(
        projectService.createProject(input, testUser)
      ).rejects.toThrow('Duplicate Name');
    });
  });

  describe('Authorization Validation', () => {
    it('should reject creation without user ID', async () => {
      const input = {
        name: 'Test Project',
      };

      const invalidUser = {
        userId: '',
        departmentId: 'dept-456',
        role: 'STAFF' as const,
      };

      await expect(
        projectService.createProject(input, invalidUser)
      ).rejects.toThrow();

      // Should not reach uniqueness check
      expect(mockProjectRepository.isProjectNameUnique).not.toHaveBeenCalled();
    });

    it('should reject creation without department ID', async () => {
      const input = {
        name: 'Test Project',
      };

      const invalidUser = {
        userId: 'user-123',
        departmentId: '',
        role: 'STAFF' as const,
      };

      await expect(
        projectService.createProject(input, invalidUser)
      ).rejects.toThrow();

      // Should not reach uniqueness check
      expect(mockProjectRepository.isProjectNameUnique).not.toHaveBeenCalled();
    });
  });

  describe('Domain Validation Delegation (AC3)', () => {
    it('should reject empty project name (delegated to domain)', async () => {
      const input = {
        name: '',
      };

      // Mock uniqueness check passes (won't reach it due to domain validation)
      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);

      await expect(
        projectService.createProject(input, testUser)
      ).rejects.toThrow('Project name is required');

      // Should NOT call repository (fails at domain layer)
      expect(mockProjectRepository.createProject).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only name (delegated to domain)', async () => {
      const input = {
        name: '   ',
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);

      await expect(
        projectService.createProject(input, testUser)
      ).rejects.toThrow('cannot be empty or whitespace');

      expect(mockProjectRepository.createProject).not.toHaveBeenCalled();
    });

    it('should reject name over 100 characters (delegated to domain)', async () => {
      const input = {
        name: 'A'.repeat(101),
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);

      await expect(
        projectService.createProject(input, testUser)
      ).rejects.toThrow('must not exceed 100 characters');

      expect(mockProjectRepository.createProject).not.toHaveBeenCalled();
    });

    it('should reject invalid priority (delegated to domain)', async () => {
      const input = {
        name: 'Test Project',
        priority: 11,
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);

      await expect(
        projectService.createProject(input, testUser)
      ).rejects.toThrow('Priority must be between 1 and 10');

      expect(mockProjectRepository.createProject).not.toHaveBeenCalled();
    });
  });

  describe('Service Orchestration Order', () => {
    it('should check authorization before uniqueness', async () => {
      const input = {
        name: 'Test Project',
      };

      const invalidUser = {
        userId: '',
        departmentId: 'dept-456',
        role: 'STAFF' as const,
      };

      await expect(
        projectService.createProject(input, invalidUser)
      ).rejects.toThrow();

      // Should fail before uniqueness check
      expect(mockProjectRepository.isProjectNameUnique).not.toHaveBeenCalled();
    });

    it('should check uniqueness before domain creation', async () => {
      const input = {
        name: 'Duplicate',
      };

      // Name is not unique
      mockProjectRepository.isProjectNameUnique.mockResolvedValue(false);

      await expect(
        projectService.createProject(input, testUser)
      ).rejects.toThrow('already exists');

      // Should fail before creating project
      expect(mockProjectRepository.createProject).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Priority Handling', () => {
    it('should handle priority 1 (lowest)', async () => {
      const input = {
        name: 'Low Priority Project',
        priority: 1,
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);
      mockProjectRepository.createProject.mockResolvedValue({
        id: 'project-123',
      });

      await projectService.createProject(input, testUser);

      const createdProject = mockProjectRepository.createProject.mock
        .calls[0][0] as Project;
      expect(createdProject.getPriority()).toBe(1);
    });

    it('should handle priority 10 (highest)', async () => {
      const input = {
        name: 'High Priority Project',
        priority: 10,
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);
      mockProjectRepository.createProject.mockResolvedValue({
        id: 'project-123',
      });

      await projectService.createProject(input, testUser);

      const createdProject = mockProjectRepository.createProject.mock
        .calls[0][0] as Project;
      expect(createdProject.getPriority()).toBe(10);
    });

    it('should handle project with description', async () => {
      const input = {
        name: 'Described Project',
        description:
          'This project has a detailed description explaining its purpose.',
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);
      mockProjectRepository.createProject.mockResolvedValue({
        id: 'project-123',
      });

      await projectService.createProject(input, testUser);

      const createdProject = mockProjectRepository.createProject.mock
        .calls[0][0] as Project;
      expect(createdProject.getDescription()).toBe(
        'This project has a detailed description explaining its purpose.'
      );
    });

    it('should handle project without description', async () => {
      const input = {
        name: 'Simple Project',
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);
      mockProjectRepository.createProject.mockResolvedValue({
        id: 'project-123',
      });

      await projectService.createProject(input, testUser);

      const createdProject = mockProjectRepository.createProject.mock
        .calls[0][0] as Project;
      // Description can be null or undefined when not provided
      expect(
        createdProject.getDescription() === null ||
          createdProject.getDescription() === undefined
      ).toBe(true);
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should handle multiple whitespace in name correctly', async () => {
      const input = {
        name: '  Project   With   Spaces  ',
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);
      mockProjectRepository.createProject.mockResolvedValue({
        id: 'project-123',
      });

      await projectService.createProject(input, testUser);

      // Should check with trimmed name
      expect(mockProjectRepository.isProjectNameUnique).toHaveBeenCalledWith(
        'Project   With   Spaces'
      );
    });

    it('should accept name at exactly 100 characters', async () => {
      const exactLength = 'A'.repeat(100);
      const input = {
        name: exactLength,
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);
      mockProjectRepository.createProject.mockResolvedValue({
        id: 'project-123',
      });

      await projectService.createProject(input, testUser);

      const createdProject = mockProjectRepository.createProject.mock
        .calls[0][0] as Project;
      expect(createdProject.getName()).toBe(exactLength);
    });

    it('should handle repository errors gracefully', async () => {
      const input = {
        name: 'Test Project',
      };

      mockProjectRepository.isProjectNameUnique.mockResolvedValue(true);
      mockProjectRepository.createProject.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        projectService.createProject(input, testUser)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle uniqueness check errors gracefully', async () => {
      const input = {
        name: 'Test Project',
      };

      mockProjectRepository.isProjectNameUnique.mockRejectedValue(
        new Error('Database timeout')
      );

      await expect(
        projectService.createProject(input, testUser)
      ).rejects.toThrow('Database timeout');

      // Should not proceed to creation
      expect(mockProjectRepository.createProject).not.toHaveBeenCalled();
    });
  });
});
