/**
 * @jest-environment node
 *
 * Integration Tests for Task Repository - Project Collaborator Operations
 * SCRUM-XX: Invite Collaborators to Project
 *
 * Tests the 4 new repository methods for managing ProjectCollaborator entries:
 * 1. getUserProfile - Retrieve user profile with departmentId
 * 2. isUserProjectCollaborator - Check if user is already a collaborator
 * 3. createProjectCollaborator - Create collaborator entry
 * 4. removeProjectCollaboratorIfNoTasks - Cleanup when no tasks remain
 *
 * PARALLEL EXECUTION: Uses timestamp-based unique IDs (Date.now()) to avoid conflicts
 */

import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { PrismaTaskRepository } from '../../../src/repositories/PrismaTaskRepository';

describe('Integration Tests - Task Repository Project Collaborator', () => {
  let prisma: PrismaClient;
  let taskRepository: PrismaTaskRepository;
  let pgClient: Client;

  // Generate unique test run ID to avoid conflicts
  const testRunId = Date.now();

  // Test data IDs
  let testDeptEngId: string;
  let testDeptSalesId: string;
  let testUserStaffAId: string;
  let testUserStaffBId: string;
  let testUserInactiveId: string;
  let testProject1Id: string;
  let testProject2Id: string;
  let testTask1Id: string;
  let testTask2Id: string;
  let testTask3Id: string;

  // Track created entries for cleanup
  const createdCollaborators: Array<{ projectId: string; userId: string }> = [];

  beforeAll(async () => {
    // Initialize database connections
    pgClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await pgClient.connect();

    prisma = new PrismaClient();
    taskRepository = new PrismaTaskRepository(prisma);

    // Create test departments
    const deptEngResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      [`Engineering ${testRunId}`]
    );
    testDeptEngId = deptEngResult.rows[0].id;

    const deptSalesResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      [`Sales ${testRunId}`]
    );
    testDeptSalesId = deptSalesResult.rows[0].id;

    // Create test users
    const userAResult = await pgClient.query(
      `INSERT INTO "user_profile" ("id", "email", "name", "role", "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'STAFF', $3, true, NOW(), NOW())
       RETURNING id`,
      [`staffa.${testRunId}@test.com`, `Staff A ${testRunId}`, testDeptEngId]
    );
    testUserStaffAId = userAResult.rows[0].id;

    const userBResult = await pgClient.query(
      `INSERT INTO "user_profile" ("id", "email", "name", "role", "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'STAFF', $3, true, NOW(), NOW())
       RETURNING id`,
      [`staffb.${testRunId}@test.com`, `Staff B ${testRunId}`, testDeptSalesId]
    );
    testUserStaffBId = userBResult.rows[0].id;

    const userInactiveResult = await pgClient.query(
      `INSERT INTO "user_profile" ("id", "email", "name", "role", "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'STAFF', $3, false, NOW(), NOW())
       RETURNING id`,
      [
        `inactive.${testRunId}@test.com`,
        `Inactive User ${testRunId}`,
        testDeptEngId,
      ]
    );
    testUserInactiveId = userInactiveResult.rows[0].id;

    // Create test projects
    const project1Result = await pgClient.query(
      `INSERT INTO "project" ("id", "name", "description", "priority", "status", "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'Test project 1', 5, 'ACTIVE', $2, $3, false, NOW(), NOW())
       RETURNING id`,
      [`Project 1 ${testRunId}`, testDeptEngId, testUserStaffAId]
    );
    testProject1Id = project1Result.rows[0].id;

    const project2Result = await pgClient.query(
      `INSERT INTO "project" ("id", "name", "description", "priority", "status", "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'Test project 2', 5, 'ACTIVE', $2, $3, false, NOW(), NOW())
       RETURNING id`,
      [`Project 2 ${testRunId}`, testDeptEngId, testUserStaffAId]
    );
    testProject2Id = project2Result.rows[0].id;

    // Create test tasks
    const task1Result = await pgClient.query(
      `INSERT INTO "task" ("id", "title", "description", "priority", "dueDate", "status", "ownerId", "departmentId", "projectId", "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'Test task 1', 5, NOW() + interval '7 days', 'TO_DO', $2, $3, $4, false, NOW(), NOW())
       RETURNING id`,
      [`Task 1 ${testRunId}`, testUserStaffAId, testDeptEngId, testProject1Id]
    );
    testTask1Id = task1Result.rows[0].id;

    const task2Result = await pgClient.query(
      `INSERT INTO "task" ("id", "title", "description", "priority", "dueDate", "status", "ownerId", "departmentId", "projectId", "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'Test task 2', 5, NOW() + interval '7 days', 'TO_DO', $2, $3, $4, false, NOW(), NOW())
       RETURNING id`,
      [`Task 2 ${testRunId}`, testUserStaffAId, testDeptEngId, testProject1Id]
    );
    testTask2Id = task2Result.rows[0].id;

    const task3Result = await pgClient.query(
      `INSERT INTO "task" ("id", "title", "description", "priority", "dueDate", "status", "ownerId", "departmentId", "projectId", "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'Test task 3', 5, NOW() + interval '7 days', 'TO_DO', $2, $3, $4, false, NOW(), NOW())
       RETURNING id`,
      [`Task 3 ${testRunId}`, testUserStaffAId, testDeptEngId, testProject2Id]
    );
    testTask3Id = task3Result.rows[0].id;
  });

  afterEach(async () => {
    // Clean up collaborators created in individual tests
    // Error handling: continue cleanup even if some deletions fail
    for (const collab of createdCollaborators) {
      try {
        await pgClient.query(
          `DELETE FROM "project_collaborator" WHERE "projectId" = $1 AND "userId" = $2`,
          [collab.projectId, collab.userId]
        );
      } catch (error) {
        console.error(`Failed to cleanup collaborator:`, error);
      }
    }
    createdCollaborators.length = 0;
  });

  afterAll(async () => {
    // Comprehensive cleanup in reverse dependency order
    try {
      await pgClient.query(
        `DELETE FROM "project_collaborator" WHERE "projectId" IN ($1, $2)`,
        [testProject1Id, testProject2Id]
      );
      await pgClient.query(
        `DELETE FROM "task_assignment" WHERE "taskId" IN ($1, $2, $3)`,
        [testTask1Id, testTask2Id, testTask3Id]
      );
      await pgClient.query(`DELETE FROM "task" WHERE "id" IN ($1, $2, $3)`, [
        testTask1Id,
        testTask2Id,
        testTask3Id,
      ]);
      await pgClient.query(`DELETE FROM "project" WHERE "id" IN ($1, $2)`, [
        testProject1Id,
        testProject2Id,
      ]);
      await pgClient.query(
        `DELETE FROM "user_profile" WHERE "id" IN ($1, $2, $3)`,
        [testUserStaffAId, testUserStaffBId, testUserInactiveId]
      );
      await pgClient.query(`DELETE FROM "department" WHERE "id" IN ($1, $2)`, [
        testDeptEngId,
        testDeptSalesId,
      ]);
    } catch (error) {
      console.error('Cleanup failed:', error);
    }

    await pgClient.end();
    await prisma.$disconnect();
  });

  // ============================================
  // TEST SUITE 1: getUserProfile
  // ============================================

  describe('getUserProfile', () => {
    it('should return user profile with departmentId for active user', async () => {
      const profile = await taskRepository.getUserProfile(testUserStaffAId);

      expect(profile).not.toBeNull();
      expect(profile?.id).toBe(testUserStaffAId);
      expect(profile?.departmentId).toBe(testDeptEngId);
      expect(profile?.role).toBe('STAFF');
      expect(profile?.isActive).toBe(true);
    });

    it('should return user profile for inactive user', async () => {
      const profile = await taskRepository.getUserProfile(testUserInactiveId);

      expect(profile).not.toBeNull();
      expect(profile?.id).toBe(testUserInactiveId);
      expect(profile?.isActive).toBe(false);
    });

    it('should return null for non-existent user', async () => {
      const profile = await taskRepository.getUserProfile('non-existent-id');

      expect(profile).toBeNull();
    });

    it('should return correct departmentId for users in different departments', async () => {
      const profileA = await taskRepository.getUserProfile(testUserStaffAId);
      const profileB = await taskRepository.getUserProfile(testUserStaffBId);

      expect(profileA?.departmentId).toBe(testDeptEngId);
      expect(profileB?.departmentId).toBe(testDeptSalesId);
    });
  });

  // ============================================
  // TEST SUITE 2: isUserProjectCollaborator
  // ============================================

  describe('isUserProjectCollaborator', () => {
    it('should return false when user is not a collaborator', async () => {
      const isCollaborator = await taskRepository.isUserProjectCollaborator(
        testProject1Id,
        testUserStaffAId
      );

      expect(isCollaborator).toBe(false);
    });

    it('should return true when user is a collaborator', async () => {
      // Create collaborator entry
      await pgClient.query(
        `INSERT INTO "project_collaborator" ("projectId", "userId", "departmentId", "addedAt")
         VALUES ($1, $2, $3, NOW())`,
        [testProject1Id, testUserStaffAId, testDeptEngId]
      );
      createdCollaborators.push({
        projectId: testProject1Id,
        userId: testUserStaffAId,
      });

      const isCollaborator = await taskRepository.isUserProjectCollaborator(
        testProject1Id,
        testUserStaffAId
      );

      expect(isCollaborator).toBe(true);
    });

    it('should return false for different project', async () => {
      // User is collaborator on PROJECT_1, not PROJECT_2
      await pgClient.query(
        `INSERT INTO "project_collaborator" ("projectId", "userId", "departmentId", "addedAt")
         VALUES ($1, $2, $3, NOW())`,
        [testProject1Id, testUserStaffAId, testDeptEngId]
      );
      createdCollaborators.push({
        projectId: testProject1Id,
        userId: testUserStaffAId,
      });

      const isCollaborator = await taskRepository.isUserProjectCollaborator(
        testProject2Id,
        testUserStaffAId
      );

      expect(isCollaborator).toBe(false);
    });
  });

  // ============================================
  // TEST SUITE 3: createProjectCollaborator
  // ============================================

  describe('createProjectCollaborator', () => {
    it('should create a new collaborator entry', async () => {
      await taskRepository.createProjectCollaborator(
        testProject1Id,
        testUserStaffAId,
        testDeptEngId
      );
      createdCollaborators.push({
        projectId: testProject1Id,
        userId: testUserStaffAId,
      });

      // Verify in database
      const result = await pgClient.query(
        `SELECT * FROM "project_collaborator" WHERE "projectId" = $1 AND "userId" = $2`,
        [testProject1Id, testUserStaffAId]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].projectId).toBe(testProject1Id);
      expect(result.rows[0].userId).toBe(testUserStaffAId);
      expect(result.rows[0].departmentId).toBe(testDeptEngId);
    });

    it('should handle duplicate creation gracefully (upsert)', async () => {
      // Create first time
      await taskRepository.createProjectCollaborator(
        testProject1Id,
        testUserStaffAId,
        testDeptEngId
      );
      createdCollaborators.push({
        projectId: testProject1Id,
        userId: testUserStaffAId,
      });

      // Try to create again - should not throw error
      await expect(
        taskRepository.createProjectCollaborator(
          testProject1Id,
          testUserStaffAId,
          testDeptEngId
        )
      ).resolves.not.toThrow();

      // Verify still only 1 entry
      const result = await pgClient.query(
        `SELECT * FROM "project_collaborator" WHERE "projectId" = $1 AND "userId" = $2`,
        [testProject1Id, testUserStaffAId]
      );

      expect(result.rows).toHaveLength(1);
    });

    it('should create multiple collaborators for same project', async () => {
      await taskRepository.createProjectCollaborator(
        testProject1Id,
        testUserStaffAId,
        testDeptEngId
      );
      createdCollaborators.push({
        projectId: testProject1Id,
        userId: testUserStaffAId,
      });

      await taskRepository.createProjectCollaborator(
        testProject1Id,
        testUserStaffBId,
        testDeptSalesId
      );
      createdCollaborators.push({
        projectId: testProject1Id,
        userId: testUserStaffBId,
      });

      const result = await pgClient.query(
        `SELECT * FROM "project_collaborator" WHERE "projectId" = $1`,
        [testProject1Id]
      );

      expect(result.rows).toHaveLength(2);
    });
  });

  // ============================================
  // TEST SUITE 4: removeProjectCollaboratorIfNoTasks
  // ============================================

  describe('removeProjectCollaboratorIfNoTasks', () => {
    it('should remove collaborator when user has NO active tasks', async () => {
      // Create collaborator entry
      await pgClient.query(
        `INSERT INTO "project_collaborator" ("projectId", "userId", "departmentId", "addedAt")
         VALUES ($1, $2, $3, NOW())`,
        [testProject1Id, testUserStaffAId, testDeptEngId]
      );

      // Remove collaborator (no active tasks for this user)
      await taskRepository.removeProjectCollaboratorIfNoTasks(
        testProject1Id,
        testUserStaffAId
      );

      // Verify deletion
      const result = await pgClient.query(
        `SELECT * FROM "project_collaborator" WHERE "projectId" = $1 AND "userId" = $2`,
        [testProject1Id, testUserStaffAId]
      );

      expect(result.rows).toHaveLength(0);
    });

    it('should NOT remove collaborator when user has active tasks', async () => {
      // Create collaborator entry
      await pgClient.query(
        `INSERT INTO "project_collaborator" ("projectId", "userId", "departmentId", "addedAt")
         VALUES ($1, $2, $3, NOW())`,
        [testProject1Id, testUserStaffBId, testDeptSalesId]
      );
      createdCollaborators.push({
        projectId: testProject1Id,
        userId: testUserStaffBId,
      });

      // Create task assignment for user
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [testTask1Id, testUserStaffBId, testUserStaffAId]
      );

      // Try to remove collaborator (should NOT remove because user has active task)
      await taskRepository.removeProjectCollaboratorIfNoTasks(
        testProject1Id,
        testUserStaffBId
      );

      // Verify NOT deleted
      const result = await pgClient.query(
        `SELECT * FROM "project_collaborator" WHERE "projectId" = $1 AND "userId" = $2`,
        [testProject1Id, testUserStaffBId]
      );

      expect(result.rows).toHaveLength(1);

      // Cleanup
      await pgClient.query(
        `DELETE FROM "task_assignment" WHERE "taskId" = $1 AND "userId" = $2`,
        [testTask1Id, testUserStaffBId]
      );
    });

    it('should only count ACTIVE (non-archived) tasks', async () => {
      // Create collaborator entry
      await pgClient.query(
        `INSERT INTO "project_collaborator" ("projectId", "userId", "departmentId", "addedAt")
         VALUES ($1, $2, $3, NOW())`,
        [testProject1Id, testUserStaffBId, testDeptSalesId]
      );

      // Create task assignment for ARCHIVED task
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [testTask1Id, testUserStaffBId, testUserStaffAId]
      );

      // Archive the task
      await pgClient.query(
        `UPDATE "task" SET "isArchived" = true WHERE "id" = $1`,
        [testTask1Id]
      );

      // Remove collaborator (should remove because archived tasks don't count)
      await taskRepository.removeProjectCollaboratorIfNoTasks(
        testProject1Id,
        testUserStaffBId
      );

      // Verify deletion
      const result = await pgClient.query(
        `SELECT * FROM "project_collaborator" WHERE "projectId" = $1 AND "userId" = $2`,
        [testProject1Id, testUserStaffBId]
      );

      expect(result.rows).toHaveLength(0);

      // Cleanup
      await pgClient.query(
        `DELETE FROM "task_assignment" WHERE "taskId" = $1 AND "userId" = $2`,
        [testTask1Id, testUserStaffBId]
      );
      await pgClient.query(
        `UPDATE "task" SET "isArchived" = false WHERE "id" = $1`,
        [testTask1Id]
      );
    });

    it('should handle case where collaborator does not exist (no error)', async () => {
      // Try to remove non-existent collaborator - should not throw error
      await expect(
        taskRepository.removeProjectCollaboratorIfNoTasks(
          testProject1Id,
          testUserStaffAId
        )
      ).resolves.not.toThrow();
    });

    it('should only remove for specific project (not other projects)', async () => {
      // Create collaborators for both projects
      await pgClient.query(
        `INSERT INTO "project_collaborator" ("projectId", "userId", "departmentId", "addedAt")
         VALUES ($1, $2, $3, NOW()), ($4, $2, $3, NOW())`,
        [testProject1Id, testUserStaffBId, testDeptSalesId, testProject2Id]
      );
      createdCollaborators.push(
        {
          projectId: testProject1Id,
          userId: testUserStaffBId,
        },
        {
          projectId: testProject2Id,
          userId: testUserStaffBId,
        }
      );

      // Remove from PROJECT_1 only
      await taskRepository.removeProjectCollaboratorIfNoTasks(
        testProject1Id,
        testUserStaffBId
      );

      // Verify PROJECT_1 removed
      const result1 = await pgClient.query(
        `SELECT * FROM "project_collaborator" WHERE "projectId" = $1 AND "userId" = $2`,
        [testProject1Id, testUserStaffBId]
      );
      expect(result1.rows).toHaveLength(0);

      // Verify PROJECT_2 still exists
      const result2 = await pgClient.query(
        `SELECT * FROM "project_collaborator" WHERE "projectId" = $1 AND "userId" = $2`,
        [testProject2Id, testUserStaffBId]
      );
      expect(result2.rows).toHaveLength(1);
    });
  });
});
