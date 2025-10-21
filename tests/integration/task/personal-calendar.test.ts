/**
 * @jest-environment node
 *
 * Integration Tests for Personal Calendar
 *
 * Tests the personal calendar task fetching with real database operations:
 * - Personal task viewing (CIT001)
 * - Tasks assigned to user only
 * - Recurring task handling
 * - Completed task visibility
 *
 * Test Coverage:
 * - AC: Personal calendar displays ONLY tasks assigned to the user
 * - AC: Completed tasks are visible with visual distinction
 * - AC: Recurring tasks show future occurrences correctly
 */

import { Client } from 'pg';
import { TaskService } from '@/app/server/services/TaskService';
import { PrismaClient } from '@prisma/client';

describe('Integration Tests - Personal Calendar', () => {
  let pgClient: Client;
  let prisma: PrismaClient;
  let taskService: TaskService;

  // Test data IDs
  let deptId: string;
  let user1Id: string; // Primary user
  let user2Id: string; // Other user
  let managerId: string;

  // Track created resources for comprehensive cleanup
  const createdTaskIds: string[] = [];
  const createdUserIds: string[] = [];

  // Generate unique namespace for parallel test execution
  const testNamespace = `personalcal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  /**
   * Helper function to create test user
   */
  async function createTestUser(
    email: string,
    name: string,
    role: 'STAFF' | 'MANAGER'
  ): Promise<string> {
    const userResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [email, name, role, deptId]
    );
    const userId = userResult.rows[0].id;
    createdUserIds.push(userId);
    return userId;
  }

  /**
   * Helper function to create test task
   */
  async function createTestTask(
    title: string,
    description: string,
    priority: number,
    dueDate: Date,
    status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED',
    ownerId: string,
    recurringInterval: number | null = null,
    isArchived: boolean = false
  ): Promise<string> {
    const taskResult = await pgClient.query(
      `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "recurringInterval", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id`,
      [
        title,
        description,
        priority,
        dueDate,
        status,
        ownerId,
        deptId,
        isArchived,
        recurringInterval,
      ]
    );
    const taskId = taskResult.rows[0].id;
    createdTaskIds.push(taskId);
    return taskId;
  }

  /**
   * Helper function to assign task to user
   */
  async function assignTask(taskId: string, userId: string): Promise<void> {
    await pgClient.query(
      `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
       VALUES ($1, $2, $3, NOW())`,
      [taskId, userId, managerId]
    );
  }

  beforeAll(async () => {
    // Connect to database
    pgClient = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
    });
    await pgClient.connect();

    // Initialize Prisma client and service
    prisma = new PrismaClient();
    taskService = new TaskService(prisma);

    // Create test department with unique name
    const deptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      [`Personal Calendar Dept ${testNamespace}`]
    );
    deptId = deptResult.rows[0].id;

    // Create test users with namespaced emails
    managerId = await createTestUser(
      `manager-${testNamespace}@test.com`,
      'Test Manager',
      'MANAGER'
    );
    user1Id = await createTestUser(
      `user1-${testNamespace}@test.com`,
      'User One',
      'STAFF'
    );
    user2Id = await createTestUser(
      `user2-${testNamespace}@test.com`,
      'User Two',
      'STAFF'
    );
  }, 60000);

  afterAll(async () => {
    // Clean up in proper order to respect foreign key constraints

    // 1. Delete task assignments first
    if (createdTaskIds.length > 0) {
      await pgClient.query(
        `DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)`,
        [createdTaskIds]
      );
    }

    // 2. Delete created tasks
    if (createdTaskIds.length > 0) {
      await pgClient.query(`DELETE FROM "task" WHERE id = ANY($1)`, [
        createdTaskIds,
      ]);
    }

    // 3. Clean up test users
    if (createdUserIds.length > 0) {
      await pgClient.query(`DELETE FROM "user_profile" WHERE id = ANY($1)`, [
        createdUserIds,
      ]);
    }

    // 4. Clean up test department
    if (deptId) {
      await pgClient.query(`DELETE FROM "department" WHERE id = $1`, [deptId]);
    }

    await pgClient.end();
    await prisma.$disconnect();
  });

  describe('Personal Task Fetching (CIT001)', () => {
    it('should fetch only tasks assigned to the authenticated user', async () => {
      // Create task assigned to user1
      const task1Id = await createTestTask(
        'User1 Task',
        'Assigned to user1',
        5,
        new Date('2025-12-31'),
        'TO_DO',
        managerId
      );
      await assignTask(task1Id, user1Id);

      // Create task assigned to user2 (should NOT appear for user1)
      const task2Id = await createTestTask(
        'User2 Task',
        'Assigned to user2 only',
        5,
        new Date('2025-12-31'),
        'TO_DO',
        managerId
      );
      await assignTask(task2Id, user2Id);

      // Get tasks for user1
      const user1Tasks = await taskService.getByAssignee(user1Id);

      // Verify only user1's tasks are returned
      expect(user1Tasks).toBeDefined();
      const user1TaskIds = user1Tasks!.map((t: any) => t.id);
      expect(user1TaskIds).toContain(task1Id);
      expect(user1TaskIds).not.toContain(task2Id);
    }, 40000);

    it('should not return tasks assigned to other users', async () => {
      // Create multiple tasks for user2
      for (let i = 1; i <= 3; i++) {
        const taskId = await createTestTask(
          `User2 Task ${i}`,
          'Should not appear for user1',
          5,
          new Date('2025-12-31'),
          'TO_DO',
          managerId
        );
        await assignTask(taskId, user2Id);
      }

      // Get tasks for user1
      const user1Tasks = await taskService.getByAssignee(user1Id);

      // Verify none of user2's tasks appear
      const user1TaskTitles = user1Tasks!.map((t: any) => t.title);
      expect(user1TaskTitles).not.toContain('User2 Task 1');
      expect(user1TaskTitles).not.toContain('User2 Task 2');
      expect(user1TaskTitles).not.toContain('User2 Task 3');
    }, 40000);

    it('should include task details needed for calendar display', async () => {
      // Create task with all details
      const taskId = await createTestTask(
        'Detailed Task',
        'Task with full details',
        8,
        new Date('2025-12-31'),
        'IN_PROGRESS',
        managerId,
        7 // Weekly recurring
      );
      await assignTask(taskId, user1Id);

      // Get tasks
      const tasks = await taskService.getByAssignee(user1Id);
      const task = tasks!.find((t: any) => t.id === taskId);

      // Verify calendar-required fields
      expect(task).toBeDefined();
      expect(task!.id).toBeDefined();
      expect(task!.title).toBe('Detailed Task');
      expect(task!.description).toBe('Task with full details');
      expect(task!.priority).toBe(8);
      expect(task!.dueDate).toBeDefined();
      expect(task!.status).toBe('IN_PROGRESS');
      expect(task!.owner).toBeDefined();
      expect(task!.department).toBeDefined();
      expect(task!.recurringInterval).toBe(7);
    }, 40000);
  });

  describe('Completed Task Visibility (CIT006)', () => {
    it('should show completed tasks on personal calendar', async () => {
      // Create completed task
      const taskId = await createTestTask(
        'Completed Task',
        'Task that is done',
        5,
        new Date('2025-10-15'),
        'COMPLETED',
        managerId
      );
      await assignTask(taskId, user1Id);

      // Get tasks
      const tasks = await taskService.getByAssignee(user1Id);

      // Verify completed task is included
      const completedTask = tasks!.find((t: any) => t.id === taskId);
      expect(completedTask).toBeDefined();
      expect(completedTask!.status).toBe('COMPLETED');
    }, 40000);

    it('should include status field for visual distinction of completed tasks', async () => {
      // Create mix of tasks with different statuses
      const statuses: Array<'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'> =
        ['TO_DO', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'];

      for (const status of statuses) {
        const taskId = await createTestTask(
          `${status} Task`,
          `Task with ${status} status`,
          5,
          new Date('2025-12-31'),
          status,
          managerId
        );
        await assignTask(taskId, user1Id);
      }

      // Get tasks
      const tasks = await taskService.getByAssignee(user1Id);

      // Verify all statuses are present
      const taskStatuses = tasks!.map((t: any) => t.status);
      expect(taskStatuses).toContain('TO_DO');
      expect(taskStatuses).toContain('IN_PROGRESS');
      expect(taskStatuses).toContain('COMPLETED');
      expect(taskStatuses).toContain('BLOCKED');
    }, 40000);
  });

  describe('Recurring Task Handling (CIT007)', () => {
    it('should include recurring task metadata', async () => {
      // Create recurring task
      const taskId = await createTestTask(
        'Weekly Standup',
        'Recurring weekly meeting',
        5,
        new Date('2025-12-31'),
        'TO_DO',
        managerId,
        7 // Weekly
      );
      await assignTask(taskId, user1Id);

      // Get tasks
      const tasks = await taskService.getByAssignee(user1Id);
      const recurringTask = tasks!.find((t: any) => t.id === taskId);

      // Verify recurring metadata is present
      expect(recurringTask).toBeDefined();
      expect(recurringTask!.recurringInterval).toBe(7);
    }, 40000);

    it('should handle non-recurring tasks correctly', async () => {
      // Create non-recurring task
      const taskId = await createTestTask(
        'One-time Task',
        'Single occurrence',
        5,
        new Date('2025-12-31'),
        'TO_DO',
        managerId,
        null // Not recurring
      );
      await assignTask(taskId, user1Id);

      // Get tasks
      const tasks = await taskService.getByAssignee(user1Id);
      const oneTimeTask = tasks!.find((t: any) => t.id === taskId);

      // Verify non-recurring task
      expect(oneTimeTask).toBeDefined();
      expect(oneTimeTask!.recurringInterval).toBeNull();
    }, 40000);
  });

  describe('Edge Cases', () => {
    it('should handle empty results when user has no assignments', async () => {
      // Create new user with no tasks
      const newUserId = await createTestUser(
        `newuser-${testNamespace}@test.com`,
        'New User',
        'STAFF'
      );

      // Get tasks
      const tasks = await taskService.getByAssignee(newUserId);

      // Verify empty result
      expect(tasks).toBeDefined();
      expect(tasks!.length).toBe(0);
    }, 40000);

    it('should not return archived tasks', async () => {
      // Create archived task
      const taskId = await createTestTask(
        'Archived Task',
        'Should not appear',
        5,
        new Date('2025-12-31'),
        'COMPLETED',
        managerId,
        null,
        true // Archived
      );
      await assignTask(taskId, user1Id);

      // Get tasks
      const tasks = await taskService.getByAssignee(user1Id);

      // Verify archived task is not included
      const archivedTask = tasks!.find((t: any) => t.id === taskId);
      expect(archivedTask).toBeUndefined();
    }, 40000);
  });
});
