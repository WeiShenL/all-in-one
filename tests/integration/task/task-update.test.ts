/**
 * @jest-environment node
 *
 * Integration Tests for Task Update Operations
 *
 * Tests all UPDATE operations (AC 1-7, 9-10):
 * - AC 1: Update Deadline
 * - AC 2: Update Priority (1-10 scale)
 * - AC 3: Add/Remove Tags
 * - AC 4: Update Title and Description
 * - AC 5: Update Status
 * - AC 7: Add Assignees (max 5)
 * - AC 9: Changes Reflected Within 10 Seconds
 * - AC 10: Update Recurring Settings
 *
 * Test Pattern: TaskService → Domain → Prisma Repository → Real Database
 * Uses pg client for database operations
 *
 * Each test gets a fresh database with complete isolation
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
let testAssignee2Id: string;
let testAssignee3Id: string;
let testAssignee4Id: string;
let testAssignee5Id: string;
let testProjectId: string;

// Track created tasks and tags for cleanup
const createdTaskIds: string[] = [];
const createdTagIds: string[] = [];

/**
 * Helper to create a task with assignment for testing
 */
async function createTaskWithAssignment(taskData: {
  id: string;
  title: string;
  description?: string;
  priority?: number;
  dueDate?: Date;
  status?: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED';
  recurringInterval?: number | null;
  parentTaskId?: string | null;
}) {
  const taskResult = await pgClient.query(
    `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "projectId", status, "recurringInterval", "parentTaskId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
     RETURNING *`,
    [
      taskData.id,
      taskData.title,
      taskData.description || 'Test description',
      taskData.priority || 5,
      taskData.dueDate || new Date('2025-12-31'),
      testUserId,
      testDepartmentId,
      testProjectId,
      taskData.status || 'TO_DO',
      taskData.recurringInterval !== undefined
        ? taskData.recurringInterval
        : null,
      taskData.parentTaskId !== undefined ? taskData.parentTaskId : null,
    ]
  );
  const task = taskResult.rows[0];
  createdTaskIds.push(task.id);

  // Assign user to task for authorization
  await pgClient.query(
    `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
     VALUES ($1, $2, $3, NOW())`,
    [task.id, testUserId, testUserId]
  );

  return task;
}

describe('Task Update Integration Tests', () => {
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
      ['Test Engineering Dept']
    );
    testDepartmentId = deptResult.rows[0].id;

    // Create test user (owner)
    const userResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'task-update-owner@test.com',
        'Task Update Owner',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId = userResult.rows[0].id;

    // Create additional assignees
    const assignee2Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['assignee2@test.com', 'Assignee 2', 'STAFF', testDepartmentId]
    );
    testAssignee2Id = assignee2Result.rows[0].id;

    const assignee3Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['assignee3@test.com', 'Assignee 3', 'STAFF', testDepartmentId]
    );
    testAssignee3Id = assignee3Result.rows[0].id;

    const assignee4Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['assignee4@test.com', 'Assignee 4', 'STAFF', testDepartmentId]
    );
    testAssignee4Id = assignee4Result.rows[0].id;

    const assignee5Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['assignee5@test.com', 'Assignee 5', 'STAFF', testDepartmentId]
    );
    testAssignee5Id = assignee5Result.rows[0].id;

    // Create test project
    const projectResult = await pgClient.query(
      `INSERT INTO "project" (id, name, description, priority, "departmentId", "creatorId", status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id`,
      [
        'Test Project',
        'Integration test project',
        5,
        testDepartmentId,
        testUserId,
        'ACTIVE',
      ]
    );
    testProjectId = projectResult.rows[0].id;

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

    // Clean up tags
    if (createdTagIds.length > 0) {
      await pgClient.query(`DELETE FROM "tag" WHERE id = ANY($1)`, [
        createdTagIds,
      ]);
      createdTagIds.length = 0;
    }
  }, 30000);

  // Cleanup after all tests
  afterAll(async () => {
    try {
      // Clean up test data
      if (testProjectId) {
        await pgClient.query(`DELETE FROM "project" WHERE id = $1`, [
          testProjectId,
        ]);
      }
      if (testAssignee2Id) {
        await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
          testAssignee2Id,
        ]);
      }
      if (testAssignee3Id) {
        await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
          testAssignee3Id,
        ]);
      }
      if (testAssignee4Id) {
        await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
          testAssignee4Id,
        ]);
      }
      if (testAssignee5Id) {
        await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
          testAssignee5Id,
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
  // AC 4: Update Title and Description
  // ============================================
  describe('Update Title and Description (AC 4)', () => {
    it('should update task title', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Original Title',
        description: 'Original description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.updateTaskTitle(
        task.id,
        'UPDATED: New Task Title',
        testUser
      );

      expect(updatedTask.getTitle()).toBe('UPDATED: New Task Title');
    }, 30000);

    it('should update task description', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Task',
        description: 'Original description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.updateTaskDescription(
        task.id,
        'UPDATED: This is the new description with more details.',
        testUser
      );

      expect(updatedTask.getDescription()).toContain('UPDATED:');
    }, 30000);
  });

  // ============================================
  // AC 2: Update Priority (1-10 scale)
  // ============================================
  describe('Update Priority (AC 2)', () => {
    it('should update priority to 8', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174002',
        title: 'Priority Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.updateTaskPriority(
        task.id,
        8,
        testUser
      );

      expect(updatedTask.getPriorityBucket()).toBe(8);
    }, 30000);

    it('should reject invalid priority (> 10)', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174003',
        title: 'Priority Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      await expect(
        taskService.updateTaskPriority(task.id, 15, testUser)
      ).rejects.toThrow();
    }, 30000);
  });

  // ============================================
  // AC 1: Update Deadline
  // ============================================
  describe('Update Deadline (AC 1)', () => {
    it('should update deadline', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174004',
        title: 'Deadline Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const newDeadline = new Date('2026-06-30');
      const updatedTask = await taskService.updateTaskDeadline(
        task.id,
        newDeadline,
        testUser
      );

      expect(updatedTask.getDueDate().getFullYear()).toBe(2026);
    }, 30000);

    it('should reject subtask deadline after parent deadline', async () => {
      // Create parent task
      const parentTask = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174005',
        title: 'Parent Task',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2026-06-30'),
        status: 'TO_DO',
      });

      // Create subtask with parentTaskId
      const subtaskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "projectId", "parentTaskId", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING *`,
        [
          '223e4567-e89b-12d3-a456-426614174000',
          'Subtask',
          'Test',
          3,
          new Date('2026-05-30'),
          testUserId,
          testDepartmentId,
          testProjectId,
          parentTask.id,
          'TO_DO',
        ]
      );
      const subtask = subtaskResult.rows[0];
      createdTaskIds.push(subtask.id);

      // Assign user to subtask for authorization
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [subtask.id, testUserId, testUserId]
      );

      // Try to update subtask deadline to after parent deadline
      await expect(
        taskService.updateTaskDeadline(
          subtask.id,
          new Date('2027-01-01'),
          testUser
        )
      ).rejects.toThrow();
    }, 30000);
  });

  // ============================================
  // AC 5: Update Status
  // ============================================
  describe('Update Status (AC 5)', () => {
    it('should update status to IN_PROGRESS', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174006',
        title: 'Status Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.updateTaskStatus(
        task.id,
        'IN_PROGRESS',
        testUser
      );

      expect(updatedTask.getStatus()).toBe('IN_PROGRESS');
    }, 30000);

    it('should update status to COMPLETED', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174007',
        title: 'Status Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.updateTaskStatus(
        task.id,
        'COMPLETED',
        testUser
      );

      expect(updatedTask.getStatus()).toBe('COMPLETED');
    }, 30000);
  });

  // ============================================
  // AC 3: Add/Remove Tags
  // ============================================
  describe('Add/Remove Tags (AC 3)', () => {
    it('should add tag "urgent"', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174008',
        title: 'Tag Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.addTagToTask(
        task.id,
        'urgent',
        testUser
      );

      expect(Array.from(updatedTask.getTags())).toContain('urgent');

      // Track created tag for cleanup
      const tagResult = await pgClient.query(
        `SELECT id FROM "tag" WHERE name = $1`,
        ['urgent']
      );
      if (tagResult.rows.length > 0) {
        createdTagIds.push(tagResult.rows[0].id);
      }
    }, 30000);

    it('should add multiple tags', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174009',
        title: 'Tag Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      await taskService.addTagToTask(task.id, 'urgent', testUser);
      const updatedTask = await taskService.addTagToTask(
        task.id,
        'backend',
        testUser
      );

      const tags = Array.from(updatedTask.getTags());
      expect(tags).toContain('urgent');
      expect(tags).toContain('backend');

      // Track created tags for cleanup
      const tagResult = await pgClient.query(
        `SELECT id FROM "tag" WHERE name IN ($1, $2)`,
        ['urgent', 'backend']
      );
      tagResult.rows.forEach(row => createdTagIds.push(row.id));
    }, 30000);

    it('should remove tag', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174010',
        title: 'Tag Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      await taskService.addTagToTask(task.id, 'urgent', testUser);
      await taskService.addTagToTask(task.id, 'backend', testUser);
      const updatedTask = await taskService.removeTagFromTask(
        task.id,
        'urgent',
        testUser
      );

      const tags = Array.from(updatedTask.getTags());
      expect(tags).not.toContain('urgent');
      expect(tags).toContain('backend');

      // Track created tags for cleanup
      const tagResult = await pgClient.query(
        `SELECT id FROM "tag" WHERE name IN ($1, $2)`,
        ['urgent', 'backend']
      );
      tagResult.rows.forEach(row => createdTagIds.push(row.id));
    }, 30000);
  });

  // ============================================
  // AC 7: Add Assignees (max 5)
  // ============================================
  describe('Add Assignees (AC 7 - max 5)', () => {
    it('should add assignees up to 5', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174011',
        title: 'Assignee Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      // Add second assignment manually (helper already created first one)
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [task.id, testAssignee2Id, testUserId]
      );

      // Add 3rd, 4th, 5th via service
      await taskService.addAssigneeToTask(task.id, testAssignee3Id, testUser);

      await taskService.addAssigneeToTask(task.id, testAssignee4Id, testUser);

      const updatedTask = await taskService.addAssigneeToTask(
        task.id,
        testAssignee5Id,
        testUser
      );

      expect(Array.from(updatedTask.getAssignees()).length).toBe(5);
    }, 30000);

    it('should reject adding 6th assignee', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174012',
        title: 'Assignee Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      // Add 4 more (total will be 5)
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW()), ($4, $5, $6, NOW()), ($7, $8, $9, NOW()), ($10, $11, $12, NOW())`,
        [
          task.id,
          testAssignee2Id,
          testUserId,
          task.id,
          testAssignee3Id,
          testUserId,
          task.id,
          testAssignee4Id,
          testUserId,
          task.id,
          testAssignee5Id,
          testUserId,
        ]
      );

      // Try to add 6th assignee (using assignee3 as the 6th)
      await expect(
        taskService.addAssigneeToTask(task.id, testAssignee3Id, testUser)
      ).rejects.toThrow();
    }, 30000);
  });

  // ============================================
  // AC 10: Update Recurring Settings
  // ============================================
  describe('Update Recurring Settings (AC 10)', () => {
    it('should enable recurring (every 7 days)', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174013',
        title: 'Recurring Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.updateTaskRecurring(
        task.id,
        true,
        7,
        testUser
      );

      expect(updatedTask.getRecurringInterval()).toBe(7);
      expect(updatedTask.isTaskRecurring()).toBe(true);
    }, 30000);

    it('should disable recurring', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174014',
        title: 'Recurring Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        recurringInterval: 7,
      });

      const updatedTask = await taskService.updateTaskRecurring(
        task.id,
        false,
        null,
        testUser
      );

      expect(updatedTask.getRecurringInterval()).toBeNull();
      expect(updatedTask.isTaskRecurring()).toBe(false);
    }, 30000);
  });

  // ============================================
  // AC 9: Changes Reflected Within 10 Seconds
  // ============================================
  describe('Changes Reflected (AC 9)', () => {
    it('should reflect changes within 10 seconds', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174015',
        title: 'Performance Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const beforeUpdate = new Date();
      await taskService.updateTaskTitle(
        task.id,
        'FINAL: Timestamp Test',
        testUser
      );
      const afterUpdate = new Date();

      const timeDiff = afterUpdate.getTime() - beforeUpdate.getTime();
      expect(timeDiff).toBeLessThan(10000);
    }, 30000);
  });
});
