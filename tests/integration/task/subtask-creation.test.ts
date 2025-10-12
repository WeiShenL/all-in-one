/**
 * @jest-environment node
 *
 * Integration Tests for Subtask Creation - SCRUM-65
 *
 * Tests the complete subtask creation flow with real database operations
 *
 * Test Coverage:
 * - Test 1: Basic subtask creation with parent relationship
 * - Test 2: 2-level maximum depth enforcement (no sub-subtasks)
 * - Test 3: Creator must be assigned to parent task
 * - Test 4: Subtask deadline validation (must be <= parent deadline)
 * - Test 5: Subtasks cannot be recurring
 * - Test 6: Inheritance of department and project from parent
 * - Test 7: Transaction rollback on failure
 * - Test 8: Multiple subtasks under same parent
 */

import { Client } from 'pg';
import { SubtaskService } from '@/app/server/services/SubtaskService';
import { PrismaTaskRepository } from '@/repositories/PrismaTaskRepository';
import { PrismaClient } from '@prisma/client';

describe('Integration Tests - Subtask Creation (SCRUM-65)', () => {
  let pgClient: Client;
  let prisma: PrismaClient;
  let service: SubtaskService;
  let repository: PrismaTaskRepository;

  // Test data IDs
  let testDepartmentId: string;
  let testProjectId: string;
  let testStaffUserId: string;
  let testStaffUser2Id: string;
  let testParentTaskId: string;

  // Track created items for cleanup
  const createdTaskIds: string[] = [];
  const createdUserIds: string[] = [];

  // Generate unique emails to avoid conflicts
  const testRunId = Date.now();
  const staff1Email = `staff1-${testRunId}@test.com`;
  const staff2Email = `staff2-${testRunId}@test.com`;

  beforeAll(async () => {
    // Setup PostgreSQL connection
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Setup Prisma
    prisma = new PrismaClient();
    repository = new PrismaTaskRepository(prisma);
    service = new SubtaskService(repository);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CREATE TEST DEPARTMENT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const deptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      ['Test Dept - Subtask Tests']
    );
    testDepartmentId = deptResult.rows[0].id;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CREATE TEST USERS FIRST (needed for project creator)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const user1Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'STAFF', $3, true, NOW(), NOW())
       RETURNING id`,
      [staff1Email, 'Staff User 1', testDepartmentId]
    );
    testStaffUserId = user1Result.rows[0].id;
    createdUserIds.push(testStaffUserId);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CREATE TEST PROJECT (after users)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const projectResult = await pgClient.query(
      `INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 5, 'ACTIVE', $3, $4, false, NOW(), NOW())
       RETURNING id`,
      [
        'Test Project',
        'Test project for subtask tests',
        testDepartmentId,
        testStaffUserId,
      ]
    );
    testProjectId = projectResult.rows[0].id;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CREATE SECOND TEST USER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const user2Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'STAFF', $3, true, NOW(), NOW())
       RETURNING id`,
      [staff2Email, 'Staff User 2', testDepartmentId]
    );
    testStaffUser2Id = user2Result.rows[0].id;
    createdUserIds.push(testStaffUser2Id);
  });

  afterAll(async () => {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CLEANUP (in reverse order of creation to handle foreign keys)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Delete tasks (cascade will handle assignments, logs, etc.)
    for (const taskId of createdTaskIds) {
      await pgClient.query(`DELETE FROM "task" WHERE id = $1`, [taskId]);
    }

    // Delete parent task
    if (testParentTaskId) {
      await pgClient.query(`DELETE FROM "task" WHERE id = $1`, [
        testParentTaskId,
      ]);
    }

    // Delete project (must be before users because of creatorId foreign key)
    if (testProjectId) {
      await pgClient.query(`DELETE FROM "project" WHERE id = $1`, [
        testProjectId,
      ]);
    }

    // Delete users
    for (const userId of createdUserIds) {
      await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
        userId,
      ]);
    }

    // Delete department
    if (testDepartmentId) {
      await pgClient.query(`DELETE FROM "department" WHERE id = $1`, [
        testDepartmentId,
      ]);
    }

    await pgClient.end();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CREATE PARENT TASK BEFORE EACH TEST
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const parentResult = await pgClient.query(
      `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "projectId", "parentTaskId", "recurringInterval", "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 5, $3, 'TO_DO', $4, $5, $6, NULL, NULL, false, NOW(), NOW())
       RETURNING id`,
      [
        'Parent Task',
        'Parent task for subtask tests',
        new Date('2025-12-31'),
        testStaffUserId,
        testDepartmentId,
        testProjectId,
      ]
    );
    testParentTaskId = parentResult.rows[0].id;

    // Assign staff user to parent task
    await pgClient.query(
      `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
       VALUES ($1, $2, $2, NOW())`,
      [testParentTaskId, testStaffUserId]
    );
  });

  afterEach(async () => {
    // Clean up created subtasks
    for (const taskId of createdTaskIds) {
      await pgClient.query(`DELETE FROM "task" WHERE id = $1`, [taskId]);
    }
    createdTaskIds.length = 0; // Clear array

    // Delete parent task
    if (testParentTaskId) {
      await pgClient.query(`DELETE FROM "task" WHERE id = $1`, [
        testParentTaskId,
      ]);
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 1: Basic Subtask Creation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should create subtask in database with parent relationship', async () => {
    const result = await service.createSubtask(
      {
        title: 'Test Subtask',
        description: 'Integration test subtask',
        priority: 7,
        dueDate: new Date('2025-12-30'),
        assigneeIds: [testStaffUserId],
        parentTaskId: testParentTaskId,
        tags: ['test', 'integration'],
      },
      {
        userId: testStaffUserId,
        role: 'STAFF',
        departmentId: testDepartmentId,
      }
    );

    createdTaskIds.push(result.id);

    // Verify in database
    const subtaskResult = await pgClient.query(
      `SELECT * FROM "task" WHERE id = $1`,
      [result.id]
    );

    expect(subtaskResult.rows).toHaveLength(1);
    const subtask = subtaskResult.rows[0];
    expect(subtask.title).toBe('Test Subtask');
    expect(subtask.parentTaskId).toBe(testParentTaskId);
    expect(subtask.departmentId).toBe(testDepartmentId);
    expect(subtask.projectId).toBe(testProjectId);
    expect(subtask.recurringInterval).toBeNull();

    // Verify assignment
    const assignmentResult = await pgClient.query(
      `SELECT * FROM "task_assignment" WHERE "taskId" = $1`,
      [result.id]
    );
    expect(assignmentResult.rows).toHaveLength(1);
    expect(assignmentResult.rows[0].userId).toBe(testStaffUserId);
  }, 30000);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 2: 2-Level Maximum (No Sub-Subtasks)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should enforce 2-level maximum depth via database query', async () => {
    // Create level 1 subtask
    const level1Result = await service.createSubtask(
      {
        title: 'Level 1 Subtask',
        description: 'First level',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: [testStaffUserId],
        parentTaskId: testParentTaskId,
      },
      {
        userId: testStaffUserId,
        role: 'STAFF',
        departmentId: testDepartmentId,
      }
    );
    createdTaskIds.push(level1Result.id);

    // Try to create level 2 subtask (should fail)
    await expect(
      service.createSubtask(
        {
          title: 'Level 2 Subtask (INVALID)',
          description: 'Should fail',
          priority: 5,
          dueDate: new Date('2025-12-30'),
          assigneeIds: [testStaffUserId],
          parentTaskId: level1Result.id, // Parent is already a subtask!
        },
        {
          userId: testStaffUserId,
          role: 'STAFF',
          departmentId: testDepartmentId,
        }
      )
    ).rejects.toThrow('Maximum depth is 2 levels');

    // Verify no level 2 subtask in database
    const level2Result = await pgClient.query(
      `SELECT * FROM "task" WHERE "parentTaskId" = $1`,
      [level1Result.id]
    );
    expect(level2Result.rows).toHaveLength(0);
  }, 30000);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 3: Creator Must Be Assigned to Parent
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should enforce creator assignment via database lookup', async () => {
    // testStaffUser2Id is NOT assigned to parent task

    await expect(
      service.createSubtask(
        {
          title: 'Unauthorized Subtask',
          description: 'Should fail',
          priority: 5,
          dueDate: new Date('2025-12-30'),
          assigneeIds: [testStaffUser2Id],
          parentTaskId: testParentTaskId,
        },
        {
          userId: testStaffUser2Id, // Not assigned to parent!
          role: 'STAFF',
          departmentId: testDepartmentId,
        }
      )
    ).rejects.toThrow('must be assigned to the parent task');

    // Verify no subtask was created
    const subtasksResult = await pgClient.query(
      `SELECT * FROM "task" WHERE "parentTaskId" = $1`,
      [testParentTaskId]
    );
    expect(subtasksResult.rows).toHaveLength(0);
  }, 30000);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 4: Deadline Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should enforce deadline constraint with database timestamps', async () => {
    // Parent deadline is 2025-12-31
    // Try to create subtask with deadline AFTER parent

    await expect(
      service.createSubtask(
        {
          title: 'Invalid Deadline Subtask',
          description: 'Deadline after parent',
          priority: 5,
          dueDate: new Date('2026-01-15'), // After parent!
          assigneeIds: [testStaffUserId],
          parentTaskId: testParentTaskId,
        },
        {
          userId: testStaffUserId,
          role: 'STAFF',
          departmentId: testDepartmentId,
        }
      )
    ).rejects.toThrow('deadline cannot be after parent');

    // Verify no subtask created
    const count = await pgClient.query(
      `SELECT COUNT(*) FROM "task" WHERE "parentTaskId" = $1`,
      [testParentTaskId]
    );
    expect(parseInt(count.rows[0].count)).toBe(0);
  }, 30000);

  it('should allow subtask deadline equal to parent deadline', async () => {
    const result = await service.createSubtask(
      {
        title: 'Same Deadline Subtask',
        description: 'Valid',
        priority: 5,
        dueDate: new Date('2025-12-31'), // Same as parent
        assigneeIds: [testStaffUserId],
        parentTaskId: testParentTaskId,
      },
      {
        userId: testStaffUserId,
        role: 'STAFF',
        departmentId: testDepartmentId,
      }
    );
    createdTaskIds.push(result.id);

    // Verify in database
    const subtaskResult = await pgClient.query(
      `SELECT "dueDate" FROM "task" WHERE id = $1`,
      [result.id]
    );
    expect(subtaskResult.rows[0].dueDate).toBeTruthy();
  }, 30000);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 5: Subtasks Cannot Be Recurring
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should reject recurring subtask and verify in database', async () => {
    await expect(
      service.createSubtask(
        {
          title: 'Recurring Subtask (INVALID)',
          description: 'Should fail',
          priority: 5,
          dueDate: new Date('2025-12-30'),
          assigneeIds: [testStaffUserId],
          parentTaskId: testParentTaskId,
          recurringInterval: 7, // Try to make recurring
        },
        {
          userId: testStaffUserId,
          role: 'STAFF',
          departmentId: testDepartmentId,
        }
      )
    ).rejects.toThrow('cannot be set as recurring');

    // Verify no recurring subtasks exist
    const recurringResult = await pgClient.query(
      `SELECT * FROM "task" WHERE "parentTaskId" = $1 AND "recurringInterval" IS NOT NULL`,
      [testParentTaskId]
    );
    expect(recurringResult.rows).toHaveLength(0);
  }, 30000);

  it('should store recurringInterval as null in database', async () => {
    const result = await service.createSubtask(
      {
        title: 'Non-Recurring Subtask',
        description: 'Valid',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: [testStaffUserId],
        parentTaskId: testParentTaskId,
      },
      {
        userId: testStaffUserId,
        role: 'STAFF',
        departmentId: testDepartmentId,
      }
    );
    createdTaskIds.push(result.id);

    // Verify recurringInterval is null in database
    const subtaskResult = await pgClient.query(
      `SELECT "recurringInterval" FROM "task" WHERE id = $1`,
      [result.id]
    );
    expect(subtaskResult.rows[0].recurringInterval).toBeNull();
  }, 30000);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 6: Inheritance from Parent
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should inherit department and project from parent in database', async () => {
    const result = await service.createSubtask(
      {
        title: 'Inherited Subtask',
        description: 'Should inherit dept and project',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: [testStaffUserId],
        parentTaskId: testParentTaskId,
      },
      {
        userId: testStaffUserId,
        role: 'STAFF',
        departmentId: testDepartmentId,
      }
    );
    createdTaskIds.push(result.id);

    // Verify inheritance in database
    const subtaskResult = await pgClient.query(
      `SELECT "departmentId", "projectId" FROM "task" WHERE id = $1`,
      [result.id]
    );
    const subtask = subtaskResult.rows[0];
    expect(subtask.departmentId).toBe(testDepartmentId);
    expect(subtask.projectId).toBe(testProjectId);

    // Verify it matches parent
    const parentResult = await pgClient.query(
      `SELECT "departmentId", "projectId" FROM "task" WHERE id = $1`,
      [testParentTaskId]
    );
    expect(subtask.departmentId).toBe(parentResult.rows[0].departmentId);
    expect(subtask.projectId).toBe(parentResult.rows[0].projectId);
  }, 30000);

  it('should handle null projectId inheritance', async () => {
    // Create parent without project
    const parentNoProject = await pgClient.query(
      `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "projectId", "parentTaskId", "recurringInterval", "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 5, $3, 'TO_DO', $4, $5, NULL, NULL, NULL, false, NOW(), NOW())
       RETURNING id`,
      [
        'Parent Without Project',
        'No project',
        new Date('2025-12-31'),
        testStaffUserId,
        testDepartmentId,
      ]
    );
    const parentNoProjectId = parentNoProject.rows[0].id;

    // Assign to parent
    await pgClient.query(
      `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
       VALUES ($1, $2, $2, NOW())`,
      [parentNoProjectId, testStaffUserId]
    );

    const result = await service.createSubtask(
      {
        title: 'Subtask With Null Project',
        description: 'Should inherit null project',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: [testStaffUserId],
        parentTaskId: parentNoProjectId,
      },
      {
        userId: testStaffUserId,
        role: 'STAFF',
        departmentId: testDepartmentId,
      }
    );
    createdTaskIds.push(result.id);

    // Verify projectId is null
    const subtaskResult = await pgClient.query(
      `SELECT "projectId" FROM "task" WHERE id = $1`,
      [result.id]
    );
    expect(subtaskResult.rows[0].projectId).toBeNull();

    // Cleanup
    await pgClient.query(`DELETE FROM "task" WHERE id = $1`, [
      parentNoProjectId,
    ]);
  }, 30000);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 7: Action Logging
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should log subtask creation action in database', async () => {
    const result = await service.createSubtask(
      {
        title: 'Logged Subtask',
        description: 'Should have log entry',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: [testStaffUserId],
        parentTaskId: testParentTaskId,
      },
      {
        userId: testStaffUserId,
        role: 'STAFF',
        departmentId: testDepartmentId,
      }
    );
    createdTaskIds.push(result.id);

    // Verify log entry exists
    const logResult = await pgClient.query(
      `SELECT * FROM "task_log" WHERE "taskId" = $1 AND action = 'CREATED'`,
      [result.id]
    );
    expect(logResult.rows).toHaveLength(1);
    const log = logResult.rows[0];
    expect(log.userId).toBe(testStaffUserId);
    expect(log.metadata).toBeTruthy();
    expect(log.metadata.parentTaskId).toBe(testParentTaskId);
  }, 30000);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 8: Multiple Subtasks
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should allow multiple subtasks under same parent', async () => {
    // Create 3 subtasks
    const result1 = await service.createSubtask(
      {
        title: 'Subtask 1',
        description: 'First subtask',
        priority: 5,
        dueDate: new Date('2025-12-30'),
        assigneeIds: [testStaffUserId],
        parentTaskId: testParentTaskId,
      },
      {
        userId: testStaffUserId,
        role: 'STAFF',
        departmentId: testDepartmentId,
      }
    );
    createdTaskIds.push(result1.id);

    const result2 = await service.createSubtask(
      {
        title: 'Subtask 2',
        description: 'Second subtask',
        priority: 7,
        dueDate: new Date('2025-12-29'),
        assigneeIds: [testStaffUserId],
        parentTaskId: testParentTaskId,
      },
      {
        userId: testStaffUserId,
        role: 'STAFF',
        departmentId: testDepartmentId,
      }
    );
    createdTaskIds.push(result2.id);

    const result3 = await service.createSubtask(
      {
        title: 'Subtask 3',
        description: 'Third subtask',
        priority: 3,
        dueDate: new Date('2025-12-28'),
        assigneeIds: [testStaffUserId],
        parentTaskId: testParentTaskId,
      },
      {
        userId: testStaffUserId,
        role: 'STAFF',
        departmentId: testDepartmentId,
      }
    );
    createdTaskIds.push(result3.id);

    // Query all subtasks
    const subtasksResult = await pgClient.query(
      `SELECT * FROM "task" WHERE "parentTaskId" = $1 ORDER BY "createdAt" ASC`,
      [testParentTaskId]
    );

    expect(subtasksResult.rows).toHaveLength(3);
    expect(subtasksResult.rows[0].title).toBe('Subtask 1');
    expect(subtasksResult.rows[1].title).toBe('Subtask 2');
    expect(subtasksResult.rows[2].title).toBe('Subtask 3');

    // Verify all have correct parent
    subtasksResult.rows.forEach(subtask => {
      expect(subtask.parentTaskId).toBe(testParentTaskId);
    });
  }, 30000);
});
