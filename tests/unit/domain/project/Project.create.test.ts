/**
 * Unit Tests for Project Domain Model - create() Factory Method
 * Testing Domain-Level Business Logic for Project Creation - SCRUM-30
 *
 * DDD Layer: DOMAIN
 * Tests: Project.create() factory with all business rule validations
 *
 * Acceptance Criteria Tested:
 * - AC3: Project name must be given when creating a project
 * - BR1: Project name cannot be empty or whitespace
 * - BR2: Project name maximum length validation
 * - BR3: Project name trimming
 * - Default status and priority assignment
 */

import { Project, ProjectStatus } from '@/domain/project/Project';
import {
  InvalidProjectNameError,
  InvalidPriorityError,
} from '@/domain/project/errors/ProjectErrors';

describe('Project.create() - Domain Factory Method', () => {
  const validProjectData = {
    name: 'Customer Portal Redesign',
    description: 'Redesign the customer-facing portal for better UX',
    priority: 5,
    status: ProjectStatus.ACTIVE,
    creatorId: 'user-123',
    departmentId: 'dept-456',
  };

  describe('Successful Project Creation', () => {
    it('should create project with all valid mandatory fields', () => {
      const project = Project.create(validProjectData);

      expect(project).toBeDefined();
      expect(project.getName()).toBe('Customer Portal Redesign');
      expect(project.getDescription()).toBe(
        'Redesign the customer-facing portal for better UX'
      );
      expect(project.getPriority()).toBe(5);
      expect(project.getStatus()).toBe(ProjectStatus.ACTIVE);
      expect(project.getCreatorId()).toBe('user-123');
      expect(project.getDepartmentId()).toBe('dept-456');
      expect(project.getId()).toBeDefined();
      expect(project.getCreatedAt()).toBeInstanceOf(Date);
      expect(project.getUpdatedAt()).toBeInstanceOf(Date);
      expect(project.isArchived()).toBe(false);
    });

    it('should trim whitespace from project name', () => {
      const project = Project.create({
        ...validProjectData,
        name: '  Customer Portal  ',
      });

      expect(project.getName()).toBe('Customer Portal');
    });

    it('should set default status to ACTIVE when not provided', () => {
      const { status: _status, ...dataWithoutStatus } = validProjectData;
      const project = Project.create(dataWithoutStatus);

      expect(project.getStatus()).toBe(ProjectStatus.ACTIVE);
    });

    it('should set default priority to 5 when not provided', () => {
      const { priority: _priority, ...dataWithoutPriority } = validProjectData;
      const project = Project.create(dataWithoutPriority);

      expect(project.getPriority()).toBe(5);
    });

    it('should generate unique UUID for project ID', () => {
      const project1 = Project.create(validProjectData);
      const project2 = Project.create(validProjectData);

      expect(project1.getId()).not.toBe(project2.getId());
      expect(project1.getId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should create project with null description', () => {
      const { description: _description, ...dataWithoutDescription } =
        validProjectData;
      const project = Project.create(dataWithoutDescription);

      expect(project.getDescription()).toBeNull();
    });

    it('should create project with empty string description as null', () => {
      const project = Project.create({
        ...validProjectData,
        description: '',
      });

      expect(project.getDescription()).toBeNull();
    });

    it('should trim whitespace from description', () => {
      const project = Project.create({
        ...validProjectData,
        description: '  Trimmed description  ',
      });

      expect(project.getDescription()).toBe('Trimmed description');
    });
  });

  describe('Project Name Validation (AC3)', () => {
    it('should reject undefined project name', () => {
      const { name: _name, ...dataWithoutName } = validProjectData;

      expect(() => {
        Project.create(dataWithoutName as any);
      }).toThrow(InvalidProjectNameError);

      expect(() => {
        Project.create(dataWithoutName as any);
      }).toThrow('Project name is required');
    });

    it('should reject null project name', () => {
      expect(() => {
        Project.create({ ...validProjectData, name: null as any });
      }).toThrow(InvalidProjectNameError);

      expect(() => {
        Project.create({ ...validProjectData, name: null as any });
      }).toThrow('Project name is required');
    });

    it('should reject empty string project name', () => {
      expect(() => {
        Project.create({ ...validProjectData, name: '' });
      }).toThrow(InvalidProjectNameError);

      expect(() => {
        Project.create({ ...validProjectData, name: '' });
      }).toThrow('Project name is required');
    });

    it('should reject whitespace-only project name', () => {
      expect(() => {
        Project.create({ ...validProjectData, name: '   ' });
      }).toThrow(InvalidProjectNameError);

      expect(() => {
        Project.create({ ...validProjectData, name: '   ' });
      }).toThrow('Project name cannot be empty or whitespace');
    });

    it('should reject project name exceeding 100 characters', () => {
      const longName = 'A'.repeat(101);

      expect(() => {
        Project.create({ ...validProjectData, name: longName });
      }).toThrow(InvalidProjectNameError);

      expect(() => {
        Project.create({ ...validProjectData, name: longName });
      }).toThrow('Project name must not exceed 100 characters');
    });

    it('should accept project name with exactly 100 characters', () => {
      const maxLengthName = 'A'.repeat(100);
      const project = Project.create({
        ...validProjectData,
        name: maxLengthName,
      });

      expect(project.getName()).toBe(maxLengthName);
      expect(project.getName().length).toBe(100);
    });

    it('should accept project name with 1 character', () => {
      const project = Project.create({ ...validProjectData, name: 'A' });

      expect(project.getName()).toBe('A');
    });
  });

  describe('Priority Validation', () => {
    it('should reject priority less than 1', () => {
      expect(() => {
        Project.create({ ...validProjectData, priority: 0 });
      }).toThrow(InvalidPriorityError);

      expect(() => {
        Project.create({ ...validProjectData, priority: 0 });
      }).toThrow('Priority must be between 1 and 10');
    });

    it('should reject priority greater than 10', () => {
      expect(() => {
        Project.create({ ...validProjectData, priority: 11 });
      }).toThrow(InvalidPriorityError);

      expect(() => {
        Project.create({ ...validProjectData, priority: 11 });
      }).toThrow('Priority must be between 1 and 10');
    });

    it('should accept priority of 1', () => {
      const project = Project.create({ ...validProjectData, priority: 1 });
      expect(project.getPriority()).toBe(1);
    });

    it('should accept priority of 10', () => {
      const project = Project.create({ ...validProjectData, priority: 10 });
      expect(project.getPriority()).toBe(10);
    });

    it('should accept priority of 5 (mid-range)', () => {
      const project = Project.create({ ...validProjectData, priority: 5 });
      expect(project.getPriority()).toBe(5);
    });
  });

  describe('Status Validation', () => {
    it('should accept ACTIVE status', () => {
      const project = Project.create({
        ...validProjectData,
        status: ProjectStatus.ACTIVE,
      });
      expect(project.getStatus()).toBe(ProjectStatus.ACTIVE);
    });

    it('should accept COMPLETED status', () => {
      const project = Project.create({
        ...validProjectData,
        status: ProjectStatus.COMPLETED,
      });
      expect(project.getStatus()).toBe(ProjectStatus.COMPLETED);
    });

    it('should accept ON_HOLD status', () => {
      const project = Project.create({
        ...validProjectData,
        status: ProjectStatus.ON_HOLD,
      });
      expect(project.getStatus()).toBe(ProjectStatus.ON_HOLD);
    });

    it('should accept CANCELLED status', () => {
      const project = Project.create({
        ...validProjectData,
        status: ProjectStatus.CANCELLED,
      });
      expect(project.getStatus()).toBe(ProjectStatus.CANCELLED);
    });
  });

  describe('Creator and Department Association', () => {
    it('should require creatorId', () => {
      const { creatorId: _creatorId, ...dataWithoutCreator } = validProjectData;

      expect(() => {
        Project.create(dataWithoutCreator as any);
      }).toThrow();
    });

    it('should require departmentId', () => {
      const { departmentId: _departmentId, ...dataWithoutDepartment } =
        validProjectData;

      expect(() => {
        Project.create(dataWithoutDepartment as any);
      }).toThrow();
    });

    it('should associate project with creator', () => {
      const project = Project.create(validProjectData);
      expect(project.getCreatorId()).toBe('user-123');
    });

    it('should associate project with department', () => {
      const project = Project.create(validProjectData);
      expect(project.getDepartmentId()).toBe('dept-456');
    });
  });

  describe('Immutability - Projects start as non-archived', () => {
    it('should create project as non-archived by default', () => {
      const project = Project.create(validProjectData);
      expect(project.isArchived()).toBe(false);
    });
  });

  describe('Timestamp Management', () => {
    it('should set createdAt to current timestamp', () => {
      const before = new Date();
      const project = Project.create(validProjectData);
      const after = new Date();

      expect(project.getCreatedAt().getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(project.getCreatedAt().getTime()).toBeLessThanOrEqual(
        after.getTime()
      );
    });

    it('should set updatedAt equal to createdAt on creation', () => {
      const project = Project.create(validProjectData);

      expect(project.getUpdatedAt()).toEqual(project.getCreatedAt());
    });
  });
});
