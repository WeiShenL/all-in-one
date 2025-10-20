/**
 * @jest-environment node
 *
 * Integration Tests for Manager Operations (SCRUM-15)
 *
 * Tests the complete manager task management flow with real database operations:
 * - Manager can assign staff from ANY department to accessible tasks
 * - Manager can remove assignees from accessible tasks
 * - Manager can comment on accessible tasks
 * - Manager can edit accessible tasks (title, description, priority, status, comments, recurring)
 * - Task owner never changes
 *
 * Test Coverage:
 * - AC1 & AC2: Manager assign staff to tasks via assignee hierarchy
 * - AC3: Manager remove assignees (staff cannot)
 * - AC4: Manager comment on accessible tasks
 * - AC5: Manager edit task properties, own comments, and recurring settings
 * - AC6: Owner immutability
 */

import { Client } from 'pg';
import { TaskService } from '@/services/task/TaskService';
import { PrismaClient } from '@prisma/client';
import { PrismaTaskRepository } from '@/repositories/PrismaTaskRepository';
import { TaskStatus } from '@/domain/task/Task';

// ============================================
// MOCK RESEND TO PREVENT ACTUAL EMAIL SENDING
// ============================================
// Manager operations call addAssigneeToTask/removeAssigneeToTask/addCommentToTask which trigger notifications
// Mock Resend to prevent hitting rate limits
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest
        .fn()
        .mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

describe('Integration Tests - Manager Operations (SCRUM-15)', () => {
  let pgClient: Client;
  let prisma: PrismaClient;
  let taskService: TaskService;

  // Test data IDs
  let salesDeptId: string;
  let salesRegion1DeptId: string; // Subordinate to sales
  let engineeringDeptId: string; // Peer department
  let hrDeptId: string; // Different department

  let managerId: string; // Manager of Sales
  let staffInSalesId: string;
  let staffInSalesRegion1Id: string;
  let staffInEngineeringId: string;
  let staffInHrId: string;
  let regularStaffId: string; // Non-manager staff

  // Track created tasks for cleanup
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    // Connect to database
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Initialize Prisma client and service
    prisma = new PrismaClient();
    const repository = new PrismaTaskRepository(prisma);
    taskService = new TaskService(repository);

    // Clean up any leftover test data
    await pgClient.query(
      `DELETE FROM "task_assignment" WHERE "assignedById" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@manager-ops-test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "comment" WHERE "userId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@manager-ops-test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "task_log" WHERE "userId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@manager-ops-test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "task" WHERE "ownerId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@manager-ops-test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@manager-ops-test.com'`
    );
    await pgClient.query(
      `DELETE FROM "department" WHERE name IN ('Sales-Test', 'Sales-Region1-Test', 'Engineering-Test', 'HR-Test')`
    );

    // Create Sales department (manager's department)
    const salesDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      ['Sales-Test']
    );
    salesDeptId = salesDeptResult.rows[0].id;

    // Create Sales-Region1 department (subordinate to Sales)
    const salesRegion1DeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
       RETURNING id`,
      ['Sales-Region1-Test', salesDeptId]
    );
    salesRegion1DeptId = salesRegion1DeptResult.rows[0].id;

    // Create Engineering department (peer department)
    const engineeringDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      ['Engineering-Test']
    );
    engineeringDeptId = engineeringDeptResult.rows[0].id;

    // Create HR department (different department)
    const hrDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      ['HR-Test']
    );
    hrDeptId = hrDeptResult.rows[0].id;

    // Create manager in Sales department
    const managerResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['manager@manager-ops-test.com', 'Sales Manager', 'MANAGER', salesDeptId]
    );
    managerId = managerResult.rows[0].id;

    // Create staff in Sales department
    const staffInSalesResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['staff-sales@manager-ops-test.com', 'Sales Staff', 'STAFF', salesDeptId]
    );
    staffInSalesId = staffInSalesResult.rows[0].id;

    // Create staff in Sales-Region1 department
    const staffInSalesRegion1Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'staff-region1@manager-ops-test.com',
        'Region1 Staff',
        'STAFF',
        salesRegion1DeptId,
      ]
    );
    staffInSalesRegion1Id = staffInSalesRegion1Result.rows[0].id;

    // Create staff in Engineering department
    const staffInEngineeringResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'staff-eng@manager-ops-test.com',
        'Engineering Staff',
        'STAFF',
        engineeringDeptId,
      ]
    );
    staffInEngineeringId = staffInEngineeringResult.rows[0].id;

    // Create staff in HR department
    const staffInHrResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['staff-hr@manager-ops-test.com', 'HR Staff', 'STAFF', hrDeptId]
    );
    staffInHrId = staffInHrResult.rows[0].id;

    // Create regular staff (non-manager)
    const regularStaffResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'regular-staff@manager-ops-test.com',
        'Regular Staff',
        'STAFF',
        salesDeptId,
      ]
    );
    regularStaffId = regularStaffResult.rows[0].id;
  }, 300000); // 5 minute timeout

  afterAll(async () => {
    // Clean up in correct order (respecting foreign keys)
    if (createdTaskIds.length > 0) {
      // 1. Delete task logs first (FK to tasks and users)
      await pgClient.query(`DELETE FROM "task_log" WHERE "taskId" = ANY($1)`, [
        createdTaskIds,
      ]);
      // 2. Delete task assignments (FK to tasks)
      await pgClient.query(
        `DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)`,
        [createdTaskIds]
      );
      // 3. Delete comments (FK to tasks and users)
      await pgClient.query(`DELETE FROM "comment" WHERE "taskId" = ANY($1)`, [
        createdTaskIds,
      ]);
      // 4. Delete tasks (FK to users)
      await pgClient.query(`DELETE FROM "task" WHERE id = ANY($1)`, [
        createdTaskIds,
      ]);
    }

    // 5. Delete test users (FK to departments)
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@manager-ops-test.com'`
    );

    // 6. Delete test departments (last, no dependencies)
    await pgClient.query(
      `DELETE FROM "department" WHERE name IN ('Sales-Test', 'Sales-Region1-Test', 'Engineering-Test', 'HR-Test')`
    );

    // Disconnect
    await prisma.$disconnect();
    await pgClient.end();
  }, 300000); // 5 minute timeout

  describe('AC1 & AC2: Manager Assign Staff to Accessible Tasks', () => {
    it('should allow manager to assign staff from ANY department to task they have access to', async () => {
      // Create task in Engineering dept with Sales-Region1 staff assigned
      const result = await taskService.createTask(
        {
          title: 'Cross-department Task',
          description: 'Task in Engineering with Sales assignee',
          priority: 5,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          assigneeIds: [staffInSalesRegion1Id], // Assignee from Sales-Region1 (manager's subordinate)
        },
        {
          userId: staffInEngineeringId,
          role: 'STAFF',
          departmentId: engineeringDeptId,
        }
      );
      const taskId = result.id;
      createdTaskIds.push(taskId);

      // Manager should be able to access this task via assignee hierarchy
      // And assign HR staff (from completely different department)
      const task = await taskService.addAssigneeToTask(
        taskId,
        staffInHrId, // HR staff - different department!
        {
          userId: managerId,
          role: 'MANAGER',
          departmentId: salesDeptId,
        }
      );

      expect(task).toBeDefined();
      expect(task.getAssignees()).toContain(staffInHrId);
      expect(task.getAssignees()).toContain(staffInSalesRegion1Id);
    }, 300000); // 5 minute timeout

    it('should reject manager assigning to task they cannot access', async () => {
      // Create task in Engineering with Engineering assignee only
      const result = await taskService.createTask(
        {
          title: 'Engineering Only Task',
          description: 'No Sales hierarchy access',
          priority: 5,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          assigneeIds: [staffInEngineeringId], // Only Engineering staff
        },
        {
          userId: staffInEngineeringId,
          role: 'STAFF',
          departmentId: engineeringDeptId,
        }
      );
      const taskId = result.id;
      createdTaskIds.push(taskId);

      // Manager should NOT be able to access this task
      await expect(
        taskService.addAssigneeToTask(taskId, staffInHrId, {
          userId: managerId,
          role: 'MANAGER',
          departmentId: salesDeptId,
        })
      ).rejects.toThrow('Unauthorized');
    }, 300000); // 5 minute timeout
  });

  describe('AC3: Manager Remove Assignees', () => {
    it('should allow manager to remove assignee from accessible task', async () => {
      // Create task with multiple assignees including one from manager's dept
      const result = await taskService.createTask(
        {
          title: 'Multi-assignee Task',
          description: 'Task with multiple assignees',
          priority: 5,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          assigneeIds: [staffInEngineeringId, staffInSalesId, staffInHrId],
        },
        {
          userId: staffInEngineeringId,
          role: 'STAFF',
          departmentId: engineeringDeptId,
        }
      );
      const taskId = result.id;
      createdTaskIds.push(taskId);

      // Manager can access via staffInSalesId and remove HR staff
      const task = await taskService.removeAssigneeFromTask(
        taskId,
        staffInHrId,
        {
          userId: managerId,
          role: 'MANAGER',
          departmentId: salesDeptId,
        }
      );

      expect(task).toBeDefined();
      expect(task.getAssignees()).not.toContain(staffInHrId);
      expect(task.getAssignees()).toContain(staffInEngineeringId);
      expect(task.getAssignees()).toContain(staffInSalesId);
    }, 300000); // 5 minute timeout

    it('should reject staff trying to remove assignee', async () => {
      // Create task with multiple assignees
      const result = await taskService.createTask(
        {
          title: 'Staff Cannot Remove',
          description: 'Staff cannot remove assignees',
          priority: 5,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          assigneeIds: [regularStaffId, staffInSalesId],
        },
        {
          userId: regularStaffId,
          role: 'STAFF',
          departmentId: salesDeptId,
        }
      );
      const taskId = result.id;
      createdTaskIds.push(taskId);

      // Staff should NOT be able to remove assignee
      await expect(
        taskService.removeAssigneeFromTask(taskId, staffInSalesId, {
          userId: regularStaffId,
          role: 'STAFF',
          departmentId: salesDeptId,
        })
      ).rejects.toThrow();
    }, 300000); // 5 minute timeout

    it('should reject removing last assignee', async () => {
      // Create task with only 1 assignee
      const result = await taskService.createTask(
        {
          title: 'Single Assignee Task',
          description: 'Cannot remove last assignee',
          priority: 5,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          assigneeIds: [staffInSalesId],
        },
        {
          userId: staffInSalesId,
          role: 'STAFF',
          departmentId: salesDeptId,
        }
      );
      const taskId = result.id;
      createdTaskIds.push(taskId);

      // Manager should NOT be able to remove last assignee
      await expect(
        taskService.removeAssigneeFromTask(taskId, staffInSalesId, {
          userId: managerId,
          role: 'MANAGER',
          departmentId: salesDeptId,
        })
      ).rejects.toThrow('at least 1 assignee');
    }, 300000); // 5 minute timeout
  });

  describe('AC4: Manager Comment on Accessible Tasks', () => {
    it('should allow manager to comment on accessible task', async () => {
      // Create task with assignee from manager's subordinate dept
      const result = await taskService.createTask(
        {
          title: 'Commentable Task',
          description: 'Manager can comment',
          priority: 5,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          assigneeIds: [staffInSalesRegion1Id],
        },
        {
          userId: staffInEngineeringId,
          role: 'STAFF',
          departmentId: engineeringDeptId,
        }
      );
      const taskId = result.id;
      createdTaskIds.push(taskId);

      // Manager can comment via assignee hierarchy
      const task = await taskService.addCommentToTask(
        taskId,
        'Great work team!',
        {
          userId: managerId,
          role: 'MANAGER',
          departmentId: salesDeptId,
        }
      );

      expect(task).toBeDefined();
      const comments = task.getComments();
      expect(comments.length).toBeGreaterThan(0);
      expect(comments[comments.length - 1].content).toBe('Great work team!');
      expect(comments[comments.length - 1].authorId).toBe(managerId);
    }, 300000); // 5 minute timeout
  });

  describe('AC5: Manager Edit Accessible Tasks', () => {
    let taskId: string;

    beforeEach(async () => {
      // Create task for editing
      const result = await taskService.createTask(
        {
          title: 'Original Title',
          description: 'Original Description',
          priority: 5,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          assigneeIds: [staffInSalesId], // Manager can access via this assignee
        },
        {
          userId: staffInEngineeringId,
          role: 'STAFF',
          departmentId: engineeringDeptId,
        }
      );
      taskId = result.id;
      createdTaskIds.push(taskId);
    }, 300000); // 5 minute timeout

    it('should allow manager to edit task title', async () => {
      const task = await taskService.updateTaskTitle(taskId, 'New Title', {
        userId: managerId,
        role: 'MANAGER',
        departmentId: salesDeptId,
      });

      expect(task.getTitle()).toBe('New Title');
    }, 300000); // 5 minute timeout

    it('should allow manager to edit task description', async () => {
      const task = await taskService.updateTaskDescription(
        taskId,
        'New Description',
        {
          userId: managerId,
          role: 'MANAGER',
          departmentId: salesDeptId,
        }
      );

      expect(task.getDescription()).toBe('New Description');
    }, 300000); // 5 minute timeout

    it('should allow manager to edit task priority', async () => {
      const task = await taskService.updateTaskPriority(taskId, 8, {
        userId: managerId,
        role: 'MANAGER',
        departmentId: salesDeptId,
      });

      expect(task.getPriority().getLevel()).toBe(8);
    }, 300000); // 5 minute timeout

    it('should allow manager to edit task status', async () => {
      const task = await taskService.updateTaskStatus(
        taskId,
        TaskStatus.IN_PROGRESS,
        {
          userId: managerId,
          role: 'MANAGER',
          departmentId: salesDeptId,
        }
      );

      expect(task.getStatus()).toBe(TaskStatus.IN_PROGRESS);
    }, 300000); // 5 minute timeout

    it('should allow manager to edit their own comment', async () => {
      // Manager adds a comment
      let task = await taskService.addCommentToTask(
        taskId,
        'Original comment',
        {
          userId: managerId,
          role: 'MANAGER',
          departmentId: salesDeptId,
        }
      );

      const commentId = task.getComments()[0].id;

      // Manager edits their comment
      task = await taskService.updateComment(
        taskId,
        commentId,
        'Updated comment',
        {
          userId: managerId,
          role: 'MANAGER',
          departmentId: salesDeptId,
        }
      );

      const updatedComment = task.getComments().find(c => c.id === commentId);
      expect(updatedComment?.content).toBe('Updated comment');
    }, 300000); // 5 minute timeout

    it('should allow manager to make task recurring', async () => {
      // Update task to be recurring (every 7 days)
      const task = await taskService.updateTaskRecurring(taskId, true, 7, {
        userId: managerId,
        role: 'MANAGER',
        departmentId: salesDeptId,
      });

      expect(task.getRecurringInterval()).toBe(7);
    }, 300000); // 5 minute timeout

    it('should allow manager to disable recurring task', async () => {
      // First make it recurring
      await taskService.updateTaskRecurring(taskId, true, 7, {
        userId: managerId,
        role: 'MANAGER',
        departmentId: salesDeptId,
      });

      // Then disable recurring
      const task = await taskService.updateTaskRecurring(taskId, false, null, {
        userId: managerId,
        role: 'MANAGER',
        departmentId: salesDeptId,
      });

      expect(task.getRecurringInterval()).toBeNull();
    }, 300000); // 5 minute timeout
  });

  describe('AC6: Owner Immutability', () => {
    it('should preserve task owner when manager adds assignee', async () => {
      const result = await taskService.createTask(
        {
          title: 'Owner Test Task',
          description: 'Owner should never change',
          priority: 5,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          assigneeIds: [staffInSalesId],
        },
        {
          userId: staffInEngineeringId,
          role: 'STAFF',
          departmentId: engineeringDeptId,
        }
      );
      const taskId = result.id;
      const originalOwnerId = staffInEngineeringId; // Creator becomes owner
      createdTaskIds.push(taskId);

      // Manager adds assignee
      const task = await taskService.addAssigneeToTask(taskId, staffInHrId, {
        userId: managerId,
        role: 'MANAGER',
        departmentId: salesDeptId,
      });

      expect(task.getOwnerId()).toBe(originalOwnerId);
    }, 300000); // 5 minute timeout

    it('should preserve task owner when manager removes assignee', async () => {
      const result = await taskService.createTask(
        {
          title: 'Owner Removal Test',
          description: 'Owner preserved on removal',
          priority: 5,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          assigneeIds: [staffInEngineeringId, staffInSalesId, staffInHrId],
        },
        {
          userId: staffInEngineeringId,
          role: 'STAFF',
          departmentId: engineeringDeptId,
        }
      );
      const taskId = result.id;
      const originalOwnerId = staffInEngineeringId; // Creator becomes owner
      createdTaskIds.push(taskId);

      // Manager removes assignee
      const task = await taskService.removeAssigneeFromTask(
        taskId,
        staffInHrId,
        {
          userId: managerId,
          role: 'MANAGER',
          departmentId: salesDeptId,
        }
      );

      expect(task.getOwnerId()).toBe(originalOwnerId);
    }, 300000); // 5 minute timeout

    it('should preserve owner even when owner is removed from assignees', async () => {
      const result = await taskService.createTask(
        {
          title: 'Owner Self-Remove Test',
          description: 'Owner preserved even when removed from assignees',
          priority: 5,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          assigneeIds: [staffInEngineeringId, staffInSalesId],
        },
        {
          userId: staffInEngineeringId,
          role: 'STAFF',
          departmentId: engineeringDeptId,
        }
      );
      const taskId = result.id;
      const originalOwnerId = staffInEngineeringId; // Creator becomes owner
      createdTaskIds.push(taskId);

      // Manager removes owner from assignees
      const task = await taskService.removeAssigneeFromTask(
        taskId,
        staffInEngineeringId,
        {
          userId: managerId,
          role: 'MANAGER',
          departmentId: salesDeptId,
        }
      );

      // Owner field should remain unchanged
      expect(task.getOwnerId()).toBe(originalOwnerId);
      // But owner is no longer in assignees
      expect(task.getAssignees()).not.toContain(originalOwnerId);
    }, 300000); // 5 minute timeout
  });
});
