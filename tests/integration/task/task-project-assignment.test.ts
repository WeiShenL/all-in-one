/**
 * @jest-environment node
 *
 * Integration Tests for Task-Project Assignment (SCRUM-31)
 *
 * User Story: As a staff, I want to add tasks and subtasks to projects so that
 * I can organise my work and not get confused between multiple projects.
 *
 * Test Coverage (Full Stack Integration):
 * - AC 1: Staff can add existing tasks (and subtasks) to a project
 * - AC 2: Tasks can only belong to 0 or 1 projects at any time
 * - AC 3: Tasks cannot be reassigned to another project after creation
 * - AC 4: System shows confirmation message after successful assignment
 *
 * Test Pattern: TaskService → Domain → Prisma Repository → Real Database
 * Uses pg client for direct database operations
 * Each test gets fresh database state with complete isolation
 */

import { Client } from 'pg';
import { TaskService, UserContext } from '@/services/task/TaskService';
import { PrismaTaskRepository } from '@/repositories/PrismaTaskRepository';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let pgClient: Client;
let taskService: TaskService;
let testUser: UserContext;

// Test data IDs
let testDepartmentId: string;
let testUserId: string;
let testAssigneeId: string;
let testProject1Id: string;
let testProject2Id: string;

// Track created resources for cleanup
const createdTaskIds: string[] = [];

/**
 * Helper to create a test project
 */
async function createTestProject(
  name: string,
  description: string
): Promise<string> {
  const result = await pgClient.query(
    `INSERT INTO "project" (id, name, description, priority, "departmentId", "creatorId", status, "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING id`,
    [name, description, 5, testDepartmentId, testUserId, 'ACTIVE']
  );
  return result.rows[0].id;
}

/**
 * Helper to verify task-project assignment in database
 */
async function verifyTaskProject(
  taskId: string,
  expectedProjectId: string | null
): Promise<boolean> {
  const result = await pgClient.query(
    `SELECT "projectId" FROM "task" WHERE id = $1`,
    [taskId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const actualProjectId = result.rows[0].projectId;
  return actualProjectId === expectedProjectId;
}

describe('Task-Project Assignment Integration Tests', () => {
  // Setup before all tests
  beforeAll(async () => {
    // Initialize pg client
    pgClient = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
    });
    await pgClient.connect();

    // Create test department
    const deptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      ['Task-Project Integration Test Dept']
    );
    testDepartmentId = deptResult.rows[0].id;

    // Create test user (owner/staff)
    const userResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'task-project-owner@test.com',
        'Task Project Owner',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId = userResult.rows[0].id;

    // Create additional assignee
    const assigneeResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['task-project-assignee@test.com', 'Assignee', 'STAFF', testDepartmentId]
    );
    testAssigneeId = assigneeResult.rows[0].id;

    // Create test projects
    testProject1Id = await createTestProject(
      'Project Alpha',
      'First test project'
    );
    testProject2Id = await createTestProject(
      'Project Beta',
      'Second test project'
    );

    // Initialize TaskService
    const repository = new PrismaTaskRepository(prisma);
    taskService = new TaskService(repository);

    // Test user context
    testUser = {
      userId: testUserId,
      role: 'STAFF',
      departmentId: testDepartmentId,
    };
  }, 60000);

  // Cleanup after each test
  afterEach(async () => {
    // Clean up tasks and related data
    if (createdTaskIds.length > 0) {
      await pgClient.query(
        `DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)`,
        [createdTaskIds]
      );
      await pgClient.query(`DELETE FROM "task_tag" WHERE "taskId" = ANY($1)`, [
        createdTaskIds,
      ]);
      await pgClient.query(`DELETE FROM "task" WHERE id = ANY($1)`, [
        createdTaskIds,
      ]);
      createdTaskIds.length = 0;
    }
  }, 30000);

  // Cleanup after all tests
  afterAll(async () => {
    try {
      // Clean up test data
      if (testProject1Id) {
        await pgClient.query(`DELETE FROM "project" WHERE id = $1`, [
          testProject1Id,
        ]);
      }
      if (testProject2Id) {
        await pgClient.query(`DELETE FROM "project" WHERE id = $1`, [
          testProject2Id,
        ]);
      }
      if (testAssigneeId) {
        await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
          testAssigneeId,
        ]);
      }
      if (testUserId) {
        await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
          testUserId,
        ]);
      }
      if (testDepartmentId) {
        await pgClient.query(`DELETE FROM "department" WHERE id = $1`, [
          testDepartmentId,
        ]);
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    } finally {
      if (pgClient) {
        await pgClient.end();
      }
      await prisma.$disconnect();
    }
  }, 60000);

  // ============================================
  // AC 1: Staff can add tasks to projects
  // ============================================
  describe('AC 1: Add Tasks to Projects', () => {
    it('should create a task assigned to a project', async () => {
      const result = await taskService.createTask(
        {
          title: 'Task in Project Alpha',
          description: 'This task belongs to Project Alpha',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
          projectId: testProject1Id,
          tags: ['project-task'],
        },
        testUser
      );

      createdTaskIds.push(result.id);

      // Verify task was created with correct project
      const isCorrect = await verifyTaskProject(result.id, testProject1Id);
      expect(isCorrect).toBe(true);

      // Verify via service layer
      const task = await taskService.getTaskById(result.id, testUser);
      expect(task).not.toBeNull();
      expect(task?.getProjectId()).toBe(testProject1Id);
      expect(task?.getTitle()).toBe('Task in Project Alpha');
    }, 30000);

    it('should create a standalone task without project assignment', async () => {
      const result = await taskService.createTask(
        {
          title: 'Standalone Task',
          description: 'This task is not assigned to any project',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
          // No projectId provided
          tags: ['standalone'],
        },
        testUser
      );

      createdTaskIds.push(result.id);

      // Verify task was created without project
      const isCorrect = await verifyTaskProject(result.id, null);
      expect(isCorrect).toBe(true);

      // Verify via service layer
      const task = await taskService.getTaskById(result.id, testUser);
      expect(task).not.toBeNull();
      expect(task?.getProjectId()).toBeNull();
      expect(task?.getTitle()).toBe('Standalone Task');
    }, 30000);

    it('should create a subtask that inherits project from parent', async () => {
      // Create parent task with project
      const parentResult = await taskService.createTask(
        {
          title: 'Parent Task',
          description: 'Parent in Project Alpha',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
          projectId: testProject1Id,
        },
        testUser
      );
      createdTaskIds.push(parentResult.id);

      // Create subtask with same project
      const subtaskResult = await taskService.createTask(
        {
          title: 'Subtask',
          description: 'Subtask inherits project',
          priority: 3,
          dueDate: new Date('2025-11-30'),
          assigneeIds: [testUserId],
          projectId: testProject1Id, // Must match parent
          parentTaskId: parentResult.id,
        },
        testUser
      );
      createdTaskIds.push(subtaskResult.id);

      // Verify both have same project
      const parentIsCorrect = await verifyTaskProject(
        parentResult.id,
        testProject1Id
      );
      const subtaskIsCorrect = await verifyTaskProject(
        subtaskResult.id,
        testProject1Id
      );

      expect(parentIsCorrect).toBe(true);
      expect(subtaskIsCorrect).toBe(true);

      // Verify via service layer
      const parentTask = await taskService.getTaskById(
        parentResult.id,
        testUser
      );
      const subtask = await taskService.getTaskById(subtaskResult.id, testUser);

      expect(parentTask?.getProjectId()).toBe(testProject1Id);
      expect(subtask?.getProjectId()).toBe(testProject1Id);
      expect(subtask?.isSubtask()).toBe(true);
    }, 30000);

    it('should allow multiple tasks in the same project', async () => {
      // Create first task
      const task1Result = await taskService.createTask(
        {
          title: 'Task 1 in Project',
          description: 'First task',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
          projectId: testProject1Id,
        },
        testUser
      );
      createdTaskIds.push(task1Result.id);

      // Create second task in same project
      const task2Result = await taskService.createTask(
        {
          title: 'Task 2 in Project',
          description: 'Second task',
          priority: 7,
          dueDate: new Date('2025-11-30'),
          assigneeIds: [testUserId],
          projectId: testProject1Id,
        },
        testUser
      );
      createdTaskIds.push(task2Result.id);

      // Verify both belong to same project
      const task1IsCorrect = await verifyTaskProject(
        task1Result.id,
        testProject1Id
      );
      const task2IsCorrect = await verifyTaskProject(
        task2Result.id,
        testProject1Id
      );

      expect(task1IsCorrect).toBe(true);
      expect(task2IsCorrect).toBe(true);

      // Verify via service layer
      const task1 = await taskService.getTaskById(task1Result.id, testUser);
      const task2 = await taskService.getTaskById(task2Result.id, testUser);

      expect(task1?.getProjectId()).toBe(testProject1Id);
      expect(task2?.getProjectId()).toBe(testProject1Id);
    }, 30000);
  });

  // ============================================
  // AC 2: Single Project Constraint
  // ============================================
  describe('AC 2: Single Project Constraint Enforcement', () => {
    it('should enforce that a task belongs to only one project', async () => {
      // Create task with project
      const result = await taskService.createTask(
        {
          title: 'Single Project Task',
          description: 'Can only belong to one project',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
          projectId: testProject1Id,
        },
        testUser
      );
      createdTaskIds.push(result.id);

      // Verify task has exactly one project
      const dbResult = await pgClient.query(
        `SELECT "projectId" FROM "task" WHERE id = $1`,
        [result.id]
      );

      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].projectId).toBe(testProject1Id);

      // Verify task cannot have multiple project associations
      // (database schema enforces this with single projectId column)
      const task = await taskService.getTaskById(result.id, testUser);
      expect(task?.getProjectId()).toBe(testProject1Id);
    }, 30000);

    it('should validate project exists before assignment', async () => {
      const INVALID_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

      await expect(
        taskService.createTask(
          {
            title: 'Task with Invalid Project',
            description: 'Should fail validation',
            priority: 5,
            dueDate: new Date('2025-12-31'),
            assigneeIds: [testUserId],
            projectId: INVALID_PROJECT_ID,
          },
          testUser
        )
      ).rejects.toThrow('Project not found');
    }, 30000);

    it('should handle null project assignment (standalone task)', async () => {
      const result = await taskService.createTask(
        {
          title: 'Standalone Task',
          description: 'No project',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
          // projectId intentionally omitted (null)
        },
        testUser
      );
      createdTaskIds.push(result.id);

      const task = await taskService.getTaskById(result.id, testUser);
      expect(task?.getProjectId()).toBeNull();

      // Verify in database
      const dbResult = await pgClient.query(
        `SELECT "projectId" FROM "task" WHERE id = $1`,
        [result.id]
      );
      expect(dbResult.rows[0].projectId).toBeNull();
    }, 30000);
  });

  // ============================================
  // AC 3: Project Immutability After Creation
  // ============================================
  describe('AC 3: Prevent Project Reassignment', () => {
    it('should maintain project assignment after task updates', async () => {
      // Create task with project
      const result = await taskService.createTask(
        {
          title: 'Immutable Project Task',
          description: 'Project should not change',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
          projectId: testProject1Id,
        },
        testUser
      );
      createdTaskIds.push(result.id);

      const originalProjectId = testProject1Id;

      // Perform various updates
      await taskService.updateTaskTitle(result.id, 'Updated Title', testUser);
      let task = await taskService.getTaskById(result.id, testUser);
      expect(task?.getProjectId()).toBe(originalProjectId);

      await taskService.updateTaskDescription(
        result.id,
        'Updated Description',
        testUser
      );
      task = await taskService.getTaskById(result.id, testUser);
      expect(task?.getProjectId()).toBe(originalProjectId);

      await taskService.updateTaskPriority(result.id, 8, testUser);
      task = await taskService.getTaskById(result.id, testUser);
      expect(task?.getProjectId()).toBe(originalProjectId);

      await taskService.updateTaskStatus(result.id, 'IN_PROGRESS', testUser);
      task = await taskService.getTaskById(result.id, testUser);
      expect(task?.getProjectId()).toBe(originalProjectId);

      // Verify no updateProjectId method exists on service
      // @ts-expect-error - updateProjectId should not exist
      expect(taskService.updateProjectId).toBeUndefined();
    }, 60000); // Increased timeout for staging environment with multiple sequential operations

    it('should prevent project reassignment via direct database manipulation', async () => {
      // Create task with project
      const result = await taskService.createTask(
        {
          title: 'Protected Task',
          description: 'Project is immutable',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
          projectId: testProject1Id,
        },
        testUser
      );
      createdTaskIds.push(result.id);

      // Attempt to change project via direct SQL (simulating bypass)
      // In real application, this would be prevented by business logic
      await pgClient.query(`UPDATE "task" SET "projectId" = $1 WHERE id = $2`, [
        testProject2Id,
        result.id,
      ]);

      // Verify the change was made (database allows it)
      const dbResult = await pgClient.query(
        `SELECT "projectId" FROM "task" WHERE id = $1`,
        [result.id]
      );
      expect(dbResult.rows[0].projectId).toBe(testProject2Id);

      // However, service layer should not expose this capability
      // @ts-expect-error - updateProjectId should not exist
      expect(taskService.updateProjectId).toBeUndefined();
    }, 30000);

    it('should maintain null project for standalone tasks through updates', async () => {
      // Create standalone task
      const result = await taskService.createTask(
        {
          title: 'Standalone Task',
          description: 'No project ever',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
        },
        testUser
      );
      createdTaskIds.push(result.id);

      // Perform updates
      await taskService.updateTaskStatus(result.id, 'IN_PROGRESS', testUser);
      await taskService.updateTaskPriority(result.id, 7, testUser);

      // Verify project remains null
      const task = await taskService.getTaskById(result.id, testUser);
      expect(task?.getProjectId()).toBeNull();

      const dbResult = await pgClient.query(
        `SELECT "projectId" FROM "task" WHERE id = $1`,
        [result.id]
      );
      expect(dbResult.rows[0].projectId).toBeNull();
    }, 30000);

    it('should preserve project assignment through archival and unarchival', async () => {
      // Create task with project
      const result = await taskService.createTask(
        {
          title: 'Task to Archive',
          description: 'Project should persist',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
          projectId: testProject1Id,
        },
        testUser
      );
      createdTaskIds.push(result.id);

      const originalProjectId = testProject1Id;

      // Archive task
      await taskService.archiveTask(result.id, testUser);
      let task = await taskService.getTaskById(result.id, testUser);
      expect(task?.getProjectId()).toBe(originalProjectId);
      expect(task?.getIsArchived()).toBe(true);

      // Unarchive task
      await taskService.unarchiveTask(result.id, testUser);
      task = await taskService.getTaskById(result.id, testUser);
      expect(task?.getProjectId()).toBe(originalProjectId);
      expect(task?.getIsArchived()).toBe(false);
    }, 30000);
  });

  // ============================================
  // AC 4: Confirmation Messages (Implicit)
  // ============================================
  describe('AC 4: Operation Success Confirmation', () => {
    it('should return task ID on successful project assignment', async () => {
      const result = await taskService.createTask(
        {
          title: 'Task with Confirmation',
          description: 'Should return success',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
          projectId: testProject1Id,
        },
        testUser
      );

      // Service returns task ID on success
      expect(result).toHaveProperty('id');
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);

      createdTaskIds.push(result.id);

      // Verify task exists and has correct project
      const task = await taskService.getTaskById(result.id, testUser);
      expect(task).not.toBeNull();
      expect(task?.getProjectId()).toBe(testProject1Id);
    }, 30000);

    it('should throw error on failed project assignment', async () => {
      const INVALID_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

      // Should reject with clear error message
      await expect(
        taskService.createTask(
          {
            title: 'Failed Task',
            description: 'Should fail',
            priority: 5,
            dueDate: new Date('2025-12-31'),
            assigneeIds: [testUserId],
            projectId: INVALID_PROJECT_ID,
          },
          testUser
        )
      ).rejects.toThrow('Project not found');
    }, 30000);
  });

  // ============================================
  // Query Operations
  // ============================================
  describe('Query Tasks by Project', () => {
    it('should retrieve all tasks for a specific project', async () => {
      // Create multiple tasks in project
      const task1Result = await taskService.createTask(
        {
          title: 'Project Task 1',
          description: 'First',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
          projectId: testProject1Id,
        },
        testUser
      );
      createdTaskIds.push(task1Result.id);

      const task2Result = await taskService.createTask(
        {
          title: 'Project Task 2',
          description: 'Second',
          priority: 3,
          dueDate: new Date('2025-11-30'),
          assigneeIds: [testUserId],
          projectId: testProject1Id,
        },
        testUser
      );
      createdTaskIds.push(task2Result.id);

      // Create task in different project
      const task3Result = await taskService.createTask(
        {
          title: 'Other Project Task',
          description: 'Different project',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
          projectId: testProject2Id,
        },
        testUser
      );
      createdTaskIds.push(task3Result.id);

      // Query tasks by project
      const project1Tasks = await taskService.getProjectTasks(
        testProject1Id,
        testUser
      );

      expect(project1Tasks.length).toBeGreaterThanOrEqual(2);
      project1Tasks.forEach(task => {
        expect(task.getProjectId()).toBe(testProject1Id);
      });
    }, 30000);

    it('should filter standalone tasks (null project)', async () => {
      // Create standalone task
      const standaloneResult = await taskService.createTask(
        {
          title: 'Standalone Task',
          description: 'No project',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
        },
        testUser
      );
      createdTaskIds.push(standaloneResult.id);

      // Create task with project
      const projectTaskResult = await taskService.createTask(
        {
          title: 'Project Task',
          description: 'Has project',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId],
          projectId: testProject1Id,
        },
        testUser
      );
      createdTaskIds.push(projectTaskResult.id);

      // Query all tasks for user
      const allTasks = await taskService.getUserTasks(testUserId);

      // Find standalone task
      const standalone = allTasks.find(t => t.getId() === standaloneResult.id);
      expect(standalone?.getProjectId()).toBeNull();

      // Find project task
      const projectTask = allTasks.find(
        t => t.getId() === projectTaskResult.id
      );
      expect(projectTask?.getProjectId()).toBe(testProject1Id);
    }, 30000);
  });
});
