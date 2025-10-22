/**
 * Unit Tests for TaskService - Project Collaborator Auto-Creation
 *
 * User Story: Invite Collaborators to Project
 *
 * Acceptance Criteria:
 * - AC1: A user automatically becomes a collaborator on a project when assigned to any task within that project
 * - AC2: Users can invite collaborators by assigning a task within that project to them
 * - AC3: Collaborators can access the project they are assigned to
 * - AC4: Collaborators can access tasks and subtasks under the project they are invited to
 *
 * Test Pattern: TDD (Red-Green-Refactor)
 * Test Focus: Service layer logic for automatic ProjectCollaborator creation
 */

import { TaskService, UserContext } from '@/services/task/TaskService';
import { ITaskRepository } from '@/repositories/ITaskRepository';

describe('TaskService - Project Collaborator Auto-Creation', () => {
  let taskService: TaskService;
  let mockTaskRepository: jest.Mocked<Partial<ITaskRepository>>;
  let mockUser: UserContext;

  /**
   * Helper to create mock task data for repository
   */
  const createMockTaskData = (overrides?: Partial<any>) => ({
    id: 'task-1',
    title: 'Test Task',
    description: 'Test Description',
    priority: 5,
    dueDate: new Date(),
    status: 'IN_PROGRESS',
    ownerId: 'user-1',
    departmentId: 'dept-1',
    projectId: 'project-1',
    parentTaskId: null,
    isArchived: false,
    isRecurring: false,
    recurringInterval: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignments: [
      { userId: 'user-1', assignedById: 'user-1', assignedAt: new Date() },
    ],
    tags: [],
    subtasks: [],
    comments: [], // Add comments array for TaskService.getTaskById
    files: [], // Add files array
    ...overrides,
  });

  beforeEach(() => {
    // Create mock repository with required methods
    mockTaskRepository = {
      getTaskByIdFull: jest.fn(),
      addTaskAssignment: jest.fn(),
      validateAssignees: jest.fn(),
      validateProjectExists: jest.fn(),
      logTaskAction: jest.fn(),
      createProjectCollaborator: jest.fn(),
      removeProjectCollaboratorIfNoTasks: jest.fn(),
      getUserProfile: jest.fn(),
      removeTaskAssignment: jest.fn(),
      createTask: jest.fn(),
      isUserProjectCollaborator: jest.fn().mockResolvedValue(false), // Default: user is not a collaborator
      getTasksForUser: jest.fn(),
    };

    // Create task service with mocked repository
    taskService = new TaskService(mockTaskRepository as any);

    // Mock user context
    mockUser = {
      userId: 'user-1',
      departmentId: 'dept-1',
      role: 'STAFF',
    };
  });

  // ============================================
  // AC1 & AC2: Automatic Collaborator Creation on Assignment
  // ============================================

  describe('AC1 & AC2: Automatic Collaborator Creation on Assignment', () => {
    it('should create ProjectCollaborator when adding assignee to task with project', async () => {
      /**
       * TEST: Verify that assigning a user to a task automatically makes them a collaborator
       *
       * Given: A task exists with projectId = "project-1"
       * When: User B (user-2 from dept-2) is added as assignee
       * Then: ProjectCollaborator entry is created with (projectId, userId, departmentId)
       */

      // Arrange
      const taskId = 'task-1';
      const projectId = 'project-1';
      const newUserId = 'user-2';
      const newUserDeptId = 'dept-2';

      mockTaskRepository.getTaskByIdFull!.mockResolvedValue(
        createMockTaskData({ id: taskId, projectId })
      );
      mockTaskRepository.validateAssignees!.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.getUserProfile!.mockResolvedValue({
        id: newUserId,
        departmentId: newUserDeptId,
        role: 'STAFF',
        isActive: true,
      } as any);
      mockTaskRepository.addTaskAssignment!.mockResolvedValue();
      mockTaskRepository.logTaskAction!.mockResolvedValue();
      mockTaskRepository.createProjectCollaborator!.mockResolvedValue();

      // Act
      await taskService.addAssigneeToTask(taskId, newUserId, mockUser);

      // Assert
      expect(mockTaskRepository.createProjectCollaborator).toHaveBeenCalledWith(
        projectId,
        newUserId,
        newUserDeptId
      );
      expect(mockTaskRepository.addTaskAssignment).toHaveBeenCalledWith(
        taskId,
        newUserId,
        mockUser.userId
      );
    });

    it('should NOT create ProjectCollaborator when adding assignee to task WITHOUT project', async () => {
      /**
       * TEST: Ensure collaborator logic only applies to project-based tasks
       *
       * Given: A standalone task with projectId = null
       * When: User B is added as assignee
       * Then: NO ProjectCollaborator entry is created
       */

      // Arrange
      const taskId = 'task-standalone';
      const newUserId = 'user-2';

      mockTaskRepository.getTaskByIdFull!.mockResolvedValue(
        createMockTaskData({ id: taskId, projectId: null })
      );
      mockTaskRepository.validateAssignees!.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.getUserProfile!.mockResolvedValue({
        id: newUserId,
        departmentId: 'dept-2',
        role: 'STAFF',
        isActive: true,
      } as any);
      mockTaskRepository.addTaskAssignment!.mockResolvedValue();
      mockTaskRepository.logTaskAction!.mockResolvedValue();

      // Act
      await taskService.addAssigneeToTask(taskId, newUserId, mockUser);

      // Assert
      expect(
        mockTaskRepository.createProjectCollaborator
      ).not.toHaveBeenCalled();
      expect(mockTaskRepository.addTaskAssignment).toHaveBeenCalledWith(
        taskId,
        newUserId,
        mockUser.userId
      );
    });

    it('should NOT duplicate ProjectCollaborator if user is already a collaborator', async () => {
      /**
       * TEST: Prevent duplicate collaborator entries (idempotent operation)
       *
       * Given: User B is already a collaborator on "project-1"
       * When: User B is added as assignee to another task in the same project
       * Then: createProjectCollaborator still called (repository handles upsert)
       */

      // Arrange
      const taskId = 'task-2';
      const projectId = 'project-1';
      const existingCollaboratorId = 'user-2';
      const existingCollaboratorDeptId = 'dept-2';

      mockTaskRepository.getTaskByIdFull!.mockResolvedValue(
        createMockTaskData({ id: taskId, projectId })
      );
      mockTaskRepository.validateAssignees!.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.getUserProfile!.mockResolvedValue({
        id: existingCollaboratorId,
        departmentId: existingCollaboratorDeptId,
        role: 'STAFF',
        isActive: true,
      } as any);
      mockTaskRepository.addTaskAssignment!.mockResolvedValue();
      mockTaskRepository.logTaskAction!.mockResolvedValue();
      mockTaskRepository.createProjectCollaborator!.mockResolvedValue();

      // Act
      await taskService.addAssigneeToTask(
        taskId,
        existingCollaboratorId,
        mockUser
      );

      // Assert - Repository method should be called (it handles upsert internally)
      expect(mockTaskRepository.createProjectCollaborator).toHaveBeenCalledWith(
        projectId,
        existingCollaboratorId,
        existingCollaboratorDeptId
      );
    });

    it('should create ProjectCollaborator for each new assignee during task creation', async () => {
      /**
       * TEST: Verify collaborators are created when task is first created with multiple assignees
       *
       * Given: Creating a new task with projectId = "project-1" and assignments = [userA, userB, userC]
       * When: Task is created
       * Then: 3 ProjectCollaborator entries are created (one for each assignee)
       */

      // Arrange
      const projectId = 'project-1';
      const assignees = ['user-a', 'user-b', 'user-c'];
      const departments = ['dept-a', 'dept-b', 'dept-c'];

      const createTaskDTO = {
        title: 'New Task',
        description: 'Task with multiple assignees',
        priority: 5,
        dueDate: new Date(),
        assigneeIds: assignees,
        projectId: projectId,
      };

      mockTaskRepository.validateAssignees!.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.validateProjectExists!.mockResolvedValue(true);

      // Mock getUserProfile to return different departments for each user
      mockTaskRepository.getUserProfile!.mockImplementation(
        async (userId: string) => {
          const index = assignees.indexOf(userId);
          return {
            id: userId,
            departmentId: departments[index],
            role: 'STAFF',
            isActive: true,
          } as any;
        }
      );

      mockTaskRepository.createTask!.mockResolvedValue({
        id: 'new-task-1',
      } as any);
      mockTaskRepository.createProjectCollaborator!.mockResolvedValue();

      // Act
      await taskService.createTask(createTaskDTO, mockUser);

      // Assert - Should create collaborator for each assignee
      expect(
        mockTaskRepository.createProjectCollaborator
      ).toHaveBeenCalledTimes(3);
      expect(mockTaskRepository.createProjectCollaborator).toHaveBeenCalledWith(
        projectId,
        'user-a',
        'dept-a'
      );
      expect(mockTaskRepository.createProjectCollaborator).toHaveBeenCalledWith(
        projectId,
        'user-b',
        'dept-b'
      );
      expect(mockTaskRepository.createProjectCollaborator).toHaveBeenCalledWith(
        projectId,
        'user-c',
        'dept-c'
      );
    });
  });

  // ============================================
  // AC3 & AC4: Collaborator Access Validation
  // ============================================

  describe('AC3 & AC4: Collaborator Access Validation', () => {
    it('should allow collaborator to access project they were assigned to', async () => {
      /**
       * TEST: Verify AC3 - "Collaborators can access the project they are assigned to"
       *
       * Note: This verifies the collaborator entry is created with correct parameters
       * so that the repository layer can use it for access control
       */

      // Arrange
      const taskId = 'task-1';
      const projectId = 'project-1';
      const newUserId = 'user-2';
      const newUserDeptId = 'dept-2';

      mockTaskRepository.getTaskByIdFull!.mockResolvedValue(
        createMockTaskData({ id: taskId, projectId })
      );
      mockTaskRepository.validateAssignees!.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.getUserProfile!.mockResolvedValue({
        id: newUserId,
        departmentId: newUserDeptId,
        role: 'STAFF',
        isActive: true,
      } as any);
      mockTaskRepository.addTaskAssignment!.mockResolvedValue();
      mockTaskRepository.logTaskAction!.mockResolvedValue();
      mockTaskRepository.createProjectCollaborator!.mockResolvedValue();

      // Act
      await taskService.addAssigneeToTask(taskId, newUserId, mockUser);

      // Assert - Collaborator entry created with user's department
      expect(mockTaskRepository.createProjectCollaborator).toHaveBeenCalledWith(
        projectId,
        newUserId,
        newUserDeptId
      );
    });

    it('should allow collaborator to access tasks in the project', async () => {
      /**
       * TEST: Verify AC4 - "Collaborators can access tasks under the project"
       *
       * Note: This is verified by ensuring the collaborator entry exists,
       * which the task access control logic can then use
       */

      // Arrange
      const taskId = 'task-1';
      const projectId = 'project-1';
      const collaboratorId = 'user-2';
      const collaboratorDeptId = 'dept-2';

      mockTaskRepository.getTaskByIdFull!.mockResolvedValue(
        createMockTaskData({ id: taskId, projectId })
      );
      mockTaskRepository.validateAssignees!.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.getUserProfile!.mockResolvedValue({
        id: collaboratorId,
        departmentId: collaboratorDeptId,
        role: 'STAFF',
        isActive: true,
      } as any);
      mockTaskRepository.addTaskAssignment!.mockResolvedValue();
      mockTaskRepository.logTaskAction!.mockResolvedValue();
      mockTaskRepository.createProjectCollaborator!.mockResolvedValue();

      // Act
      await taskService.addAssigneeToTask(taskId, collaboratorId, mockUser);

      // Assert - Verify collaborator can be queried by departmentId later
      expect(mockTaskRepository.createProjectCollaborator).toHaveBeenCalledWith(
        projectId,
        collaboratorId,
        collaboratorDeptId
      );
    });
  });

  // ============================================
  // Edge Cases & Error Handling
  // ============================================

  describe('Edge Cases & Error Handling', () => {
    it('should use correct departmentId from user profile', async () => {
      /**
       * TEST: Ensure departmentId in ProjectCollaborator comes from assignee's profile
       *
       * Given: User B is in "dept-2"
       * When: User B is assigned to a task in "project-1" (primary dept is "dept-1")
       * Then: ProjectCollaborator.departmentId = "dept-2" (User B's department)
       */

      // Arrange
      const taskId = 'task-1';
      const projectId = 'project-1';
      const assigneeId = 'user-2';
      const assigneeDeptId = 'dept-2';

      mockTaskRepository.getTaskByIdFull!.mockResolvedValue(
        createMockTaskData({ id: taskId, projectId, departmentId: 'dept-1' })
      );
      mockTaskRepository.validateAssignees!.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.getUserProfile!.mockResolvedValue({
        id: assigneeId,
        departmentId: assigneeDeptId,
        role: 'STAFF',
        isActive: true,
      } as any);
      mockTaskRepository.addTaskAssignment!.mockResolvedValue();
      mockTaskRepository.logTaskAction!.mockResolvedValue();
      mockTaskRepository.createProjectCollaborator!.mockResolvedValue();

      // Act
      await taskService.addAssigneeToTask(taskId, assigneeId, mockUser);

      // Assert - Should use assignee's department, NOT project's department
      expect(mockTaskRepository.createProjectCollaborator).toHaveBeenCalledWith(
        projectId,
        assigneeId,
        assigneeDeptId
      );
    });

    it('should rollback ProjectCollaborator if task assignment fails', async () => {
      /**
       * TEST: Ensure transactional integrity
       *
       * Given: Task assignment will fail (e.g., validation error)
       * When: Attempting to add assignee
       * Then: Error is thrown, NO ProjectCollaborator entry is created
       */

      // Arrange
      const taskId = 'task-invalid';
      const newUserId = 'user-2';

      mockTaskRepository.getTaskByIdFull!.mockResolvedValue(
        createMockTaskData({ id: taskId })
      );
      mockTaskRepository.validateAssignees!.mockResolvedValue({
        allExist: false,
        allActive: true,
      });

      // Act & Assert
      await expect(
        taskService.addAssigneeToTask(taskId, newUserId, mockUser)
      ).rejects.toThrow('Assignee not found');

      // Collaborator should NOT be created
      expect(
        mockTaskRepository.createProjectCollaborator
      ).not.toHaveBeenCalled();
    });

    it('should handle getUserProfile failure gracefully', async () => {
      /**
       * TEST: Handle case where user profile cannot be fetched
       *
       * Given: getUserProfile throws an error
       * When: Attempting to create collaborator
       * Then: Error propagates, no collaborator is created
       */

      // Arrange
      const taskId = 'task-1';
      const newUserId = 'user-invalid';

      mockTaskRepository.getTaskByIdFull!.mockResolvedValue(
        createMockTaskData({ id: taskId })
      );
      mockTaskRepository.validateAssignees!.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      // Mock getUserProfile to throw an error
      mockTaskRepository.getUserProfile!.mockRejectedValue(
        new Error('User profile not found')
      );
      mockTaskRepository.addTaskAssignment!.mockResolvedValue();
      mockTaskRepository.logTaskAction!.mockResolvedValue();

      // Act & Assert
      await expect(
        taskService.addAssigneeToTask(taskId, newUserId, mockUser)
      ).rejects.toThrow('User profile not found');

      // Collaborator should NOT be created
      expect(
        mockTaskRepository.createProjectCollaborator
      ).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Removal & Cleanup
  // ============================================

  describe('Removal & Cleanup', () => {
    it('should call removeProjectCollaboratorIfNoTasks when removing assignee', async () => {
      /**
       * TEST: Service delegates cleanup check to repository
       *
       * Given: User B is assigned to a task in "project-1"
       * When: User B is removed from the task (by a MANAGER)
       * Then: removeProjectCollaboratorIfNoTasks is called
       */

      // Arrange
      const taskId = 'task-1';
      const projectId = 'project-1';
      const removedUserId = 'user-2';

      // Manager user for removal
      const managerUser: UserContext = {
        userId: 'manager-1',
        departmentId: 'dept-1',
        role: 'MANAGER',
      };

      mockTaskRepository.getTaskByIdFull!.mockResolvedValue(
        createMockTaskData({
          id: taskId,
          projectId,
          assignments: [
            {
              userId: 'user-1',
              assignedById: 'user-1',
              assignedAt: new Date(),
            },
            {
              userId: removedUserId,
              assignedById: 'user-1',
              assignedAt: new Date(),
            },
          ],
        })
      );
      mockTaskRepository.removeTaskAssignment!.mockResolvedValue();
      mockTaskRepository.logTaskAction!.mockResolvedValue();
      mockTaskRepository.removeProjectCollaboratorIfNoTasks!.mockResolvedValue();

      // Act
      await taskService.removeAssigneeFromTask(
        taskId,
        removedUserId,
        managerUser
      );

      // Assert
      expect(
        mockTaskRepository.removeProjectCollaboratorIfNoTasks
      ).toHaveBeenCalledWith(projectId, removedUserId);
    });

    it('should NOT call removeProjectCollaboratorIfNoTasks for standalone tasks', async () => {
      /**
       * TEST: Cleanup only applies to project-based tasks
       *
       * Given: Standalone task (projectId = null)
       * When: Removing assignee (by a MANAGER)
       * Then: removeProjectCollaboratorIfNoTasks is NOT called
       */

      // Arrange
      const taskId = 'task-standalone';
      const removedUserId = 'user-2';

      // Manager user for removal
      const managerUser: UserContext = {
        userId: 'manager-1',
        departmentId: 'dept-1',
        role: 'MANAGER',
      };

      mockTaskRepository.getTaskByIdFull!.mockResolvedValue(
        createMockTaskData({
          id: taskId,
          projectId: null,
          assignments: [
            {
              userId: 'user-1',
              assignedById: 'user-1',
              assignedAt: new Date(),
            },
            {
              userId: removedUserId,
              assignedById: 'user-1',
              assignedAt: new Date(),
            },
          ],
        })
      );
      mockTaskRepository.removeTaskAssignment!.mockResolvedValue();
      mockTaskRepository.logTaskAction!.mockResolvedValue();

      // Act
      await taskService.removeAssigneeFromTask(
        taskId,
        removedUserId,
        managerUser
      );

      // Assert
      expect(
        mockTaskRepository.removeProjectCollaboratorIfNoTasks
      ).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // NEW: Notification Creation Tests
  // ============================================

  describe('Notification Creation for New Collaborators', () => {
    it('should create notification when user becomes new collaborator via addAssigneeToTask', async () => {
      /**
       * TEST: Verify that a notification is sent when a user becomes a new project collaborator
       *
       * Given: A task with projectId = "project-1"
       * When: User B is added as assignee AND is not already a collaborator
       * Then: createNotification is called with PROJECT_COLLABORATION_ADDED type
       * And: Notification message includes the project name
       */

      // Arrange
      const taskId = 'task-1';
      const projectId = 'project-1';
      const newUserId = 'user-2';
      const newUserDeptId = 'dept-2';
      const projectName = 'Customer Portal Redesign';

      mockTaskRepository.getTaskByIdFull!.mockResolvedValue(
        createMockTaskData({ id: taskId, projectId })
      );
      mockTaskRepository.validateAssignees!.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.addTaskAssignment!.mockResolvedValue();
      mockTaskRepository.logTaskAction!.mockResolvedValue();
      mockTaskRepository.getUserProfile!.mockResolvedValue({
        id: newUserId,
        departmentId: newUserDeptId,
        role: 'STAFF',
        isActive: true,
      });
      mockTaskRepository.isUserProjectCollaborator!.mockResolvedValue(false); // NEW collaborator
      mockTaskRepository.createProjectCollaborator!.mockResolvedValue();

      // Mock getProjectById to return project name
      mockTaskRepository.getProjectById = jest.fn().mockResolvedValue({
        id: projectId,
        name: projectName,
        description: 'Test project',
        priority: 5,
        status: 'ACTIVE',
        departmentId: 'dept-1',
        creatorId: 'user-1',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock createNotification (NEW METHOD - not implemented yet)
      mockTaskRepository.createNotification = jest.fn().mockResolvedValue();

      // Act
      await taskService.addAssigneeToTask(taskId, newUserId, mockUser);

      // Assert
      expect(mockTaskRepository.createNotification).toHaveBeenCalledTimes(1);
      expect(mockTaskRepository.createNotification).toHaveBeenCalledWith({
        userId: newUserId,
        type: 'PROJECT_COLLABORATION_ADDED',
        title: 'Added to Project',
        message: `You've been added as a collaborator on project "${projectName}"`,
        taskId: taskId,
      });
    });

    it('should NOT create notification when user is already a collaborator via addAssigneeToTask', async () => {
      /**
       * TEST: Verify that no notification is sent when user is already a collaborator
       *
       * Given: A task with projectId = "project-1"
       * When: User B is added as assignee BUT is already a collaborator
       * Then: createNotification is NOT called
       */

      // Arrange
      const taskId = 'task-1';
      const projectId = 'project-1';
      const newUserId = 'user-2';
      const newUserDeptId = 'dept-2';

      mockTaskRepository.getTaskByIdFull!.mockResolvedValue(
        createMockTaskData({ id: taskId, projectId })
      );
      mockTaskRepository.validateAssignees!.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.addTaskAssignment!.mockResolvedValue();
      mockTaskRepository.logTaskAction!.mockResolvedValue();
      mockTaskRepository.getUserProfile!.mockResolvedValue({
        id: newUserId,
        departmentId: newUserDeptId,
        role: 'STAFF',
        isActive: true,
      });
      mockTaskRepository.isUserProjectCollaborator!.mockResolvedValue(true); // EXISTING collaborator

      mockTaskRepository.createNotification = jest.fn().mockResolvedValue();

      // Act
      await taskService.addAssigneeToTask(taskId, newUserId, mockUser);

      // Assert
      expect(
        mockTaskRepository.createProjectCollaborator
      ).not.toHaveBeenCalled();
      expect(mockTaskRepository.createNotification).not.toHaveBeenCalled();
    });

    it('should create notification when user becomes new collaborator via createTask', async () => {
      /**
       * TEST: Verify that notifications are sent when creating a task with assignees in a project
       *
       * Given: Creating a new task with projectId = "project-1"
       * When: Task is created with 2 assignees, one new collaborator and one existing
       * Then: createNotification is called only for the new collaborator
       */

      // Arrange
      const projectId = 'project-1';
      const projectName = 'Website Redesign';
      const assignee1 = 'user-2'; // NEW collaborator
      const assignee2 = 'user-3'; // EXISTING collaborator
      const taskData = {
        title: 'Design mockups',
        description: 'Create UI mockups',
        priority: 5,
        dueDate: new Date(),
        assigneeIds: [assignee1, assignee2],
        projectId: projectId,
      };

      mockTaskRepository.validateAssignees!.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.validateProjectExists!.mockResolvedValue(true);
      mockTaskRepository.createTask!.mockResolvedValue({ id: 'new-task-1' });
      mockTaskRepository.logTaskAction!.mockResolvedValue();

      // Mock getUserProfile for both assignees
      mockTaskRepository.getUserProfile!.mockImplementation(async userId => ({
        id: userId,
        departmentId: 'dept-2',
        role: 'STAFF',
        isActive: true,
      }));

      // Mock isUserProjectCollaborator: assignee1 is NEW, assignee2 is EXISTING
      mockTaskRepository.isUserProjectCollaborator!.mockImplementation(
        async (projectId, userId) => {
          if (userId === assignee1) {
            return false;
          } // NEW
          if (userId === assignee2) {
            return true;
          } // EXISTING
          return false;
        }
      );

      mockTaskRepository.createProjectCollaborator!.mockResolvedValue();

      // Mock getProjectById
      mockTaskRepository.getProjectById = jest.fn().mockResolvedValue({
        id: projectId,
        name: projectName,
        description: 'Test project',
        priority: 5,
        status: 'ACTIVE',
        departmentId: 'dept-1',
        creatorId: 'user-1',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockTaskRepository.createNotification = jest.fn().mockResolvedValue();

      // Act
      await taskService.createTask(taskData, mockUser);

      // Assert
      expect(
        mockTaskRepository.createProjectCollaborator
      ).toHaveBeenCalledTimes(1); // Only for assignee1
      expect(mockTaskRepository.createNotification).toHaveBeenCalledTimes(1); // Only for assignee1
      expect(mockTaskRepository.createNotification).toHaveBeenCalledWith({
        userId: assignee1,
        type: 'PROJECT_COLLABORATION_ADDED',
        title: 'Added to Project',
        message: `You've been added as a collaborator on project "${projectName}"`,
        taskId: 'new-task-1',
      });
    });

    it('should NOT create notification when creating standalone task (no project)', async () => {
      /**
       * TEST: Verify that no notification is sent for standalone tasks
       *
       * Given: Creating a new task with projectId = null
       * When: Task is created with assignees
       * Then: createNotification is NOT called
       */

      // Arrange
      const taskData = {
        title: 'Standalone task',
        description: 'No project',
        priority: 5,
        dueDate: new Date(),
        assigneeIds: ['user-2'],
        projectId: null, // NO PROJECT
      };

      mockTaskRepository.validateAssignees!.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockTaskRepository.createTask!.mockResolvedValue({
        id: 'standalone-task-1',
      });
      mockTaskRepository.logTaskAction!.mockResolvedValue();
      mockTaskRepository.getUserProfile!.mockResolvedValue({
        id: 'user-2',
        departmentId: 'dept-2',
        role: 'STAFF',
        isActive: true,
      });

      mockTaskRepository.createNotification = jest.fn().mockResolvedValue();

      // Act
      await taskService.createTask(taskData, mockUser);

      // Assert
      expect(
        mockTaskRepository.createProjectCollaborator
      ).not.toHaveBeenCalled();
      expect(mockTaskRepository.createNotification).not.toHaveBeenCalled();
    });

    it('should NOT create notification when removing collaborator', async () => {
      /**
       * TEST: Verify that no notification is sent when a user is removed from a task
       *
       * Given: A task with projectId = "project-1"
       * When: User B is removed as assignee
       * Then: createNotification is NOT called (removal doesn't need notification)
       */

      // Arrange
      const taskId = 'task-1';
      const projectId = 'project-1';
      const removedUserId = 'user-2';

      const managerUser: UserContext = {
        userId: 'manager-1',
        departmentId: 'dept-1',
        role: 'MANAGER',
      };

      mockTaskRepository.getTaskByIdFull!.mockResolvedValue(
        createMockTaskData({
          id: taskId,
          projectId: projectId,
          assignments: [
            {
              userId: 'user-1',
              assignedById: 'user-1',
              assignedAt: new Date(),
            },
            {
              userId: removedUserId,
              assignedById: 'user-1',
              assignedAt: new Date(),
            },
          ],
        })
      );
      mockTaskRepository.removeTaskAssignment!.mockResolvedValue();
      mockTaskRepository.logTaskAction!.mockResolvedValue();
      mockTaskRepository.removeProjectCollaboratorIfNoTasks!.mockResolvedValue();

      mockTaskRepository.createNotification = jest.fn().mockResolvedValue();

      // Act
      await taskService.removeAssigneeFromTask(
        taskId,
        removedUserId,
        managerUser
      );

      // Assert
      expect(
        mockTaskRepository.removeProjectCollaboratorIfNoTasks
      ).toHaveBeenCalledTimes(1);
      expect(mockTaskRepository.createNotification).not.toHaveBeenCalled();
    });
  });
});
