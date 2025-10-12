/**
 * Unit Tests for SubtaskService.createSubtask()
 * Testing Subtask Creation with 2-Level Constraint - SCRUM-65
 *
 * TDD APPROACH - RED PHASE: Write tests BEFORE implementation
 *
 * DDD Layer: SERVICE
 * Tests: Subtask-specific business rules and constraints
 *
 * Acceptance Criteria Covered:
 * - Staff can create subtasks under any existing task they are assigned to
 * - 2 levels maximum total: Task → Subtask (no sub-subtasks)
 * - Mandatory fields: title, description, priority(1-10), deadline, assignee(s)
 * - Subtask creation must enforce that the new subtask does not already have a Parent ID
 * - Subtasks cannot be set as recurring
 * - Subtasks inherit department and project from parent task
 * - Subtask saved and appears under parent task immediately
 */

import {
  SubtaskService,
  UserContext,
} from '@/app/server/services/SubtaskService';
import { ITaskRepository } from '@/repositories/ITaskRepository';
// import { TaskStatus } from '@/domain/task/Task';

// Mock SupabaseStorageService
jest.mock('@/services/storage/SupabaseStorageService', () => {
  return {
    SupabaseStorageService: jest.fn().mockImplementation(() => ({
      uploadFile: jest.fn(),
      getFileDownloadUrl: jest.fn(),
      deleteFile: jest.fn(),
      validateFile: jest.fn(),
      validateTaskFileLimit: jest.fn(),
    })),
  };
});

describe('SubtaskService.createSubtask() - TDD Test Suite', () => {
  let service: SubtaskService;
  let mockRepository: jest.Mocked<ITaskRepository>;
  let testUser: UserContext;

  beforeEach(() => {
    // Mock ITaskRepository
    mockRepository = {
      createTask: jest.fn(),
      validateProjectExists: jest.fn(),
      validateAssignees: jest.fn(),
      getParentTaskDepth: jest.fn(),
      getTaskByIdFull: jest.fn(),
      logTaskAction: jest.fn(),
      getUserTasks: jest.fn(),
      getDepartmentTasks: jest.fn(),
      updateTask: jest.fn(),
      addTaskTag: jest.fn(),
      removeTaskTag: jest.fn(),
      addTaskAssignment: jest.fn(),
      createComment: jest.fn(),
      updateComment: jest.fn(),
      uploadFile: jest.fn(),
      getFileMetadata: jest.fn(),
      deleteFile: jest.fn(),
      getTaskFiles: jest.fn(),
      checkFileSizeLimit: jest.fn(),
    } as any;

    service = new SubtaskService(mockRepository);

    testUser = {
      userId: 'staff-123',
      role: 'STAFF',
      departmentId: 'dept-456',
    };

    jest.clearAllMocks();
  });

  // ============================================
  // TEST 1: Constraint Logic - 2-Level Max
  // ============================================
  describe('Test 1: 2-Level Maximum Constraint (Task → Subtask only)', () => {
    it('should create subtask under a root task (level 0 → level 1)', async () => {
      const parentTask = {
        id: 'parent-task-123',
        title: 'Parent Task',
        departmentId: 'dept-456',
        projectId: 'project-789',
        parentTaskId: null, // Root task (level 0)
        ownerId: 'owner-123',
        dueDate: new Date('2025-12-31'),
        assignments: [{ userId: 'staff-123' }],
      };

      const subtaskInput = {
        title: 'Subtask Level 1',
        description: 'First level subtask',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-task-123',
      };

      // Mock parent task fetch
      mockRepository.getTaskByIdFull.mockResolvedValue(parentTask as any);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'subtask-001' });

      const result = await service.createSubtask(subtaskInput, testUser);

      expect(result).toEqual({ id: 'subtask-001' });
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Subtask Level 1',
          parentTaskId: 'parent-task-123',
          departmentId: 'dept-456', // Inherited from parent
          projectId: 'project-789', // Inherited from parent
          recurringInterval: undefined, // Cannot be recurring
        })
      );
    });

    it('should REJECT creating sub-subtask (level 1 → level 2 exceeds maximum)', async () => {
      const parentSubtask = {
        id: 'subtask-level-1',
        title: 'Subtask Level 1',
        departmentId: 'dept-456',
        projectId: 'project-789',
        parentTaskId: 'root-task-123', // Already a subtask!
        ownerId: 'owner-123',
        dueDate: new Date('2025-12-31'),
        assignments: [{ userId: 'staff-123' }],
      };

      const subSubtaskInput = {
        title: 'Sub-Subtask (INVALID)',
        description: 'This should fail',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'subtask-level-1', // Trying to create sub-subtask
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(parentSubtask as any);

      await expect(
        service.createSubtask(subSubtaskInput, testUser)
      ).rejects.toThrow(
        'Cannot create subtask under another subtask. Maximum depth is 2 levels (Task → Subtask)'
      );

      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });

    it('should enforce that parent task exists', async () => {
      const subtaskInput = {
        title: 'Orphan Subtask',
        description: 'Parent does not exist',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'nonexistent-parent',
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(null);

      await expect(
        service.createSubtask(subtaskInput, testUser)
      ).rejects.toThrow('Parent task not found');

      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });

    it('should enforce that creator is assigned to parent task', async () => {
      const parentTask = {
        id: 'parent-task-123',
        title: 'Parent Task',
        departmentId: 'dept-456',
        projectId: 'project-789',
        parentTaskId: null,
        ownerId: 'owner-123',
        dueDate: new Date('2025-12-31'),
        assignments: [{ userId: 'other-user-1' }, { userId: 'other-user-2' }], // testUser NOT assigned!
      };

      const subtaskInput = {
        title: 'Unauthorized Subtask',
        description: 'Creator not assigned to parent',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-task-123',
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(parentTask as any);

      await expect(
        service.createSubtask(subtaskInput, testUser)
      ).rejects.toThrow(
        'You must be assigned to the parent task to create subtasks'
      );

      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // TEST 2: Mandatory Fields (TM016)
  // ============================================
  describe('Test 2: Mandatory Fields Validation', () => {
    const validParentTask = {
      id: 'parent-123',
      title: 'Parent',
      departmentId: 'dept-456',
      projectId: 'project-789',
      parentTaskId: null,
      ownerId: 'owner-123',
      dueDate: new Date('2025-12-31'),
      assignments: [{ userId: 'staff-123' }],
    };

    beforeEach(() => {
      mockRepository.getTaskByIdFull.mockResolvedValue(validParentTask as any);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'subtask-001' });
    });

    it('should require title', async () => {
      const input = {
        title: '', // Empty title
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
      };

      await expect(service.createSubtask(input, testUser)).rejects.toThrow(
        /title/i
      );
    });

    it('should accept description (even if empty)', async () => {
      const input = {
        title: 'Valid Title',
        description: '', // Empty is allowed
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
      };

      // Description can be empty according to Task domain, so this should succeed
      const result = await service.createSubtask(input, testUser);
      expect(result).toEqual({ id: 'subtask-001' });
    });

    it('should require priority (1-10 scale)', async () => {
      const input = {
        title: 'Valid Title',
        description: 'Description',
        priority: 11, // Invalid priority
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
      };

      await expect(service.createSubtask(input, testUser)).rejects.toThrow(
        /priority/i
      );
    });

    it('should require deadline', async () => {
      const input = {
        title: 'Valid Title',
        description: 'Description',
        priority: 5,
        dueDate: null as any, // Missing deadline
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
      };

      await expect(service.createSubtask(input, testUser)).rejects.toThrow();
    });

    it('should require at least one assignee', async () => {
      const input = {
        title: 'Valid Title',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: [], // No assignees
        parentTaskId: 'parent-123',
      };

      await expect(service.createSubtask(input, testUser)).rejects.toThrow(
        /assignee/i
      );
    });

    it('should accept tags (optional field)', async () => {
      const input = {
        title: 'Valid Title',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
        tags: ['urgent', 'bug'],
      };

      const result = await service.createSubtask(input, testUser);

      expect(result).toEqual({ id: 'subtask-001' });
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['urgent', 'bug'],
        })
      );
    });
  });

  // ============================================
  // TEST 3: Cannot Set Recurring
  // ============================================
  describe('Test 3: Subtasks Cannot Be Recurring', () => {
    const validParentTask = {
      id: 'parent-123',
      title: 'Parent',
      departmentId: 'dept-456',
      projectId: null,
      parentTaskId: null,
      ownerId: 'owner-123',
      dueDate: new Date('2025-12-31'),
      assignments: [{ userId: 'staff-123' }],
    };

    beforeEach(() => {
      mockRepository.getTaskByIdFull.mockResolvedValue(validParentTask as any);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
    });

    it('should reject subtask with recurringInterval set', async () => {
      const input = {
        title: 'Recurring Subtask (INVALID)',
        description: 'Should fail',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
        recurringInterval: 7, // Trying to make it recurring
      };

      await expect(service.createSubtask(input, testUser)).rejects.toThrow(
        /recurring/i
      );
    });

    it('should create subtask with recurringInterval explicitly null', async () => {
      const input = {
        title: 'Non-Recurring Subtask',
        description: 'Valid',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
        recurringInterval: undefined,
      };

      mockRepository.createTask.mockResolvedValue({ id: 'subtask-001' });

      const result = await service.createSubtask(input, testUser);

      expect(result).toEqual({ id: 'subtask-001' });
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          recurringInterval: undefined,
        })
      );
    });

    it('should create subtask without recurringInterval field (defaults to null)', async () => {
      const input = {
        title: 'Subtask without recurring field',
        description: 'Valid',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
        // recurringInterval not provided
      };

      mockRepository.createTask.mockResolvedValue({ id: 'subtask-001' });

      const result = await service.createSubtask(input, testUser);

      expect(result).toEqual({ id: 'subtask-001' });
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          recurringInterval: undefined, // Should default to null
        })
      );
    });
  });

  // ============================================
  // TEST 4: Inherit Department and Project
  // ============================================
  describe('Test 4: Inherit Department and Project from Parent', () => {
    it('should inherit departmentId from parent task', async () => {
      const parentTask = {
        id: 'parent-123',
        title: 'Parent',
        departmentId: 'dept-engineering',
        projectId: 'project-xyz',
        parentTaskId: null,
        ownerId: 'owner-123',
        dueDate: new Date('2025-12-31'),
        assignments: [{ userId: 'staff-123' }],
      };

      const input = {
        title: 'Subtask',
        description: 'Should inherit department',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(parentTask as any);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'subtask-001' });

      await service.createSubtask(input, testUser);

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: 'dept-engineering', // Inherited!
        })
      );
    });

    it('should inherit projectId from parent task (if parent has project)', async () => {
      const parentTask = {
        id: 'parent-123',
        title: 'Parent',
        departmentId: 'dept-456',
        projectId: 'project-abc',
        parentTaskId: null,
        ownerId: 'owner-123',
        dueDate: new Date('2025-12-31'),
        assignments: [{ userId: 'staff-123' }],
      };

      const input = {
        title: 'Subtask',
        description: 'Should inherit project',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(parentTask as any);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'subtask-001' });

      await service.createSubtask(input, testUser);

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-abc', // Inherited!
        })
      );
    });

    it('should inherit null projectId if parent has no project', async () => {
      const parentTask = {
        id: 'parent-123',
        title: 'Parent',
        departmentId: 'dept-456',
        projectId: null, // No project
        parentTaskId: null,
        ownerId: 'owner-123',
        dueDate: new Date('2025-12-31'),
        assignments: [{ userId: 'staff-123' }],
      };

      const input = {
        title: 'Subtask',
        description: 'Should inherit null project',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(parentTask as any);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'subtask-001' });

      await service.createSubtask(input, testUser);

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: undefined, // Inherited as null/undefined
        })
      );
    });
  });

  // ============================================
  // TEST 5: Subtask Deadline Validation
  // ============================================
  describe('Test 5: Subtask Deadline Must Be <= Parent Deadline', () => {
    it('should allow subtask deadline equal to parent deadline', async () => {
      const parentTask = {
        id: 'parent-123',
        title: 'Parent',
        departmentId: 'dept-456',
        projectId: null,
        parentTaskId: null,
        ownerId: 'owner-123',
        dueDate: new Date('2025-12-31'),
        assignments: [{ userId: 'staff-123' }],
      };

      const input = {
        title: 'Subtask',
        description: 'Same deadline',
        priority: 5,
        dueDate: new Date('2025-12-31'), // Same as parent
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(parentTask as any);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'subtask-001' });

      const result = await service.createSubtask(input, testUser);

      expect(result).toEqual({ id: 'subtask-001' });
    });

    it('should allow subtask deadline before parent deadline', async () => {
      const parentTask = {
        id: 'parent-123',
        title: 'Parent',
        departmentId: 'dept-456',
        projectId: null,
        parentTaskId: null,
        ownerId: 'owner-123',
        dueDate: new Date('2025-12-31'),
        assignments: [{ userId: 'staff-123' }],
      };

      const input = {
        title: 'Subtask',
        description: 'Earlier deadline',
        priority: 5,
        dueDate: new Date('2025-11-30'), // Before parent
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(parentTask as any);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'subtask-001' });

      const result = await service.createSubtask(input, testUser);

      expect(result).toEqual({ id: 'subtask-001' });
    });

    it('should REJECT subtask deadline after parent deadline', async () => {
      const parentTask = {
        id: 'parent-123',
        title: 'Parent',
        departmentId: 'dept-456',
        projectId: null,
        parentTaskId: null,
        ownerId: 'owner-123',
        dueDate: new Date('2025-12-31'),
        assignments: [{ userId: 'staff-123' }],
      };

      const input = {
        title: 'Subtask',
        description: 'Invalid deadline',
        priority: 5,
        dueDate: new Date('2026-01-15'), // After parent!
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(parentTask as any);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });

      await expect(service.createSubtask(input, testUser)).rejects.toThrow(
        /deadline.*parent/i
      );

      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // TEST 6: Assignee Validation
  // ============================================
  describe('Test 6: Assignee Validation', () => {
    const validParentTask = {
      id: 'parent-123',
      title: 'Parent',
      departmentId: 'dept-456',
      projectId: null,
      parentTaskId: null,
      ownerId: 'owner-123',
      dueDate: new Date('2025-12-31'),
      assignments: [{ userId: 'staff-123' }],
    };

    beforeEach(() => {
      mockRepository.getTaskByIdFull.mockResolvedValue(validParentTask as any);
    });

    it('should validate assignees exist', async () => {
      const input = {
        title: 'Subtask',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123', 'nonexistent-user'],
        parentTaskId: 'parent-123',
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: false,
        allActive: true,
      });

      await expect(service.createSubtask(input, testUser)).rejects.toThrow(
        /assignees not found/i
      );
    });

    it('should validate assignees are active', async () => {
      const input = {
        title: 'Subtask',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123', 'inactive-user'],
        parentTaskId: 'parent-123',
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: false,
      });

      await expect(service.createSubtask(input, testUser)).rejects.toThrow(
        /assignees are inactive/i
      );
    });

    it('should allow up to 5 assignees', async () => {
      const input = {
        title: 'Subtask',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'],
        parentTaskId: 'parent-123',
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'subtask-001' });

      const result = await service.createSubtask(input, testUser);

      expect(result).toEqual({ id: 'subtask-001' });
    });

    it('should reject more than 5 assignees', async () => {
      const input = {
        title: 'Subtask',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: [
          'user-1',
          'user-2',
          'user-3',
          'user-4',
          'user-5',
          'user-6',
        ],
        parentTaskId: 'parent-123',
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });

      await expect(service.createSubtask(input, testUser)).rejects.toThrow(
        /5 assignees/i
      );
    });
  });

  // ============================================
  // TEST 7: Action Logging
  // ============================================
  describe('Test 7: Action Logging', () => {
    it('should log subtask creation action', async () => {
      const parentTask = {
        id: 'parent-123',
        title: 'Parent',
        departmentId: 'dept-456',
        projectId: null,
        parentTaskId: null,
        ownerId: 'owner-123',
        dueDate: new Date('2025-12-31'),
        assignments: [{ userId: 'staff-123' }],
      };

      const input = {
        title: 'Subtask',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: ['staff-123'],
        parentTaskId: 'parent-123',
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(parentTask as any);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'subtask-001' });

      await service.createSubtask(input, testUser);

      expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
        'subtask-001',
        'staff-123',
        'CREATED',
        expect.objectContaining({
          title: 'Subtask',
          parentTaskId: 'parent-123',
        })
      );
    });
  });
});
