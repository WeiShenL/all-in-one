/**
 * Integration tests for HR/Admin Company Dashboard
 *
 * User Story: As an HR/Admin, I want to view a company-wide dashboard of all tasks
 * across the organization, so that I can have a complete overview for reporting
 * and administrative functions.
 *
 * Test Coverage:
 * - API access control (only HR/Admin can access getCompanyTasks)
 * - canEdit logic for HR/Admin with and without Manager role
 * - Filtering capabilities by department, project, and assignee
 * - Combined role scenarios (HR/Admin + Manager)
 */

import { PrismaClient } from '@prisma/client';
import { appRouter } from '../../src/app/server/routers/_app';
import { createInnerTRPCContext } from '../../src/app/server/trpc';

const prisma = new PrismaClient();

// Generate unique test IDs based on namespace to avoid conflicts in parallel test runs
function generateTestIds(testNamespace: string) {
  // Create a hash from the namespace to generate consistent but unique IDs
  const hash = testNamespace.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  // Generate valid UUID v4 format
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where x is any hexadecimal digit and y is one of 8, 9, A, or B
  const baseId = Math.abs(hash).toString(16).padStart(8, '0');

  // Create valid UUID v4 segments
  const createUuid = (prefix: string, suffix: string) => {
    const segment1 = prefix.padStart(8, '0');
    const segment2 = baseId.substring(0, 4);
    const segment3 = '4' + baseId.substring(4, 7); // 4xxx (version 4)
    const segment4 = '8' + suffix.substring(0, 3); // 8xxx (variant)
    // For segment5, we need exactly 12 characters
    const segment5 = (
      suffix.substring(3, 7) +
      baseId.substring(7, 8) +
      '0000'
    ).padStart(12, '0');
    return `${segment1}-${segment2}-${segment3}-${segment4}-${segment5}`;
  };

  return {
    // Departments
    DEPT_ROOT: createUuid('10000000', '0001'),
    DEPT_ENGINEERING: createUuid('10000000', '0002'),
    DEPT_SALES: createUuid('10000000', '0003'),
    DEPT_HR: createUuid('10000000', '0004'),
    DEPT_ENGINEERING_DEV: createUuid('10000000', '0005'),

    // Users
    USER_HR_ADMIN_ONLY: createUuid('20000000', '0001'),
    USER_HR_ADMIN_AND_MANAGER: createUuid('20000000', '0002'),
    USER_MANAGER_ONLY: createUuid('20000000', '0003'),
    USER_STAFF: createUuid('20000000', '0004'),
    USER_STAFF_SALES: createUuid('20000000', '0005'),

    // Projects
    PROJECT_ENG: createUuid('30000000', '0001'),
    PROJECT_SALES: createUuid('30000000', '0002'),

    // Tasks
    TASK_ENG_ASSIGNED: createUuid('40000000', '0001'),
    TASK_ENG_UNASSIGNED: createUuid('40000000', '0002'),
    TASK_SALES_ASSIGNED: createUuid('40000000', '0003'),
    TASK_HR_ASSIGNED: createUuid('40000000', '0004'),
    TASK_ENG_DEV_ASSIGNED: createUuid('40000000', '0005'),
  };
}

describe('HR/Admin Company Dashboard - Integration Tests', () => {
  // Unique namespace for this test run
  const testNamespace = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const TEST_IDS = generateTestIds(testNamespace);

  async function setupTestData() {
    // Create departments with unique names
    await prisma.department.createMany({
      data: [
        {
          id: TEST_IDS.DEPT_ROOT,
          name: `Root Test Dept-${testNamespace}`,
          parentId: null,
          isActive: true,
        },
        {
          id: TEST_IDS.DEPT_ENGINEERING,
          name: `Engineering Test Dept-${testNamespace}`,
          parentId: TEST_IDS.DEPT_ROOT,
          isActive: true,
        },
        {
          id: TEST_IDS.DEPT_ENGINEERING_DEV,
          name: `Engineering Dev Team-${testNamespace}`,
          parentId: TEST_IDS.DEPT_ENGINEERING,
          isActive: true,
        },
        {
          id: TEST_IDS.DEPT_SALES,
          name: `Sales Test Dept-${testNamespace}`,
          parentId: TEST_IDS.DEPT_ROOT,
          isActive: true,
        },
        {
          id: TEST_IDS.DEPT_HR,
          name: `HR Test Dept-${testNamespace}`,
          parentId: TEST_IDS.DEPT_ROOT,
          isActive: true,
        },
      ],
    });

    // Create users with unique emails
    await prisma.userProfile.createMany({
      data: [
        {
          id: TEST_IDS.USER_HR_ADMIN_ONLY,
          email: `hr-admin@${testNamespace}.com`,
          name: 'HR Admin User',
          role: 'HR_ADMIN',
          departmentId: TEST_IDS.DEPT_HR,
          isActive: true,
        },
        {
          id: TEST_IDS.USER_HR_ADMIN_AND_MANAGER,
          email: `hr-admin-manager@${testNamespace}.com`,
          name: 'HR Admin Manager',
          role: 'HR_ADMIN',
          departmentId: TEST_IDS.DEPT_ENGINEERING,
          isActive: true,
        },
        {
          id: TEST_IDS.USER_MANAGER_ONLY,
          email: `manager-only@${testNamespace}.com`,
          name: 'Manager Only',
          role: 'MANAGER',
          departmentId: TEST_IDS.DEPT_ENGINEERING,
          isActive: true,
        },
        {
          id: TEST_IDS.USER_STAFF,
          email: `staff-engineering@${testNamespace}.com`,
          name: 'Engineering Staff',
          role: 'STAFF',
          departmentId: TEST_IDS.DEPT_ENGINEERING,
          isActive: true,
        },
        {
          id: TEST_IDS.USER_STAFF_SALES,
          email: `staff-sales@${testNamespace}.com`,
          name: 'Sales Staff',
          role: 'STAFF',
          departmentId: TEST_IDS.DEPT_SALES,
          isActive: true,
        },
      ],
    });

    // Create projects with unique names
    await prisma.project.createMany({
      data: [
        {
          id: TEST_IDS.PROJECT_ENG,
          name: `Engineering Project-${testNamespace}`,
          description: 'Engineering project',
          status: 'ACTIVE',
          creatorId: TEST_IDS.USER_STAFF,
          departmentId: TEST_IDS.DEPT_ENGINEERING,
        },
        {
          id: TEST_IDS.PROJECT_SALES,
          name: `Sales Project-${testNamespace}`,
          description: 'Sales project',
          status: 'ACTIVE',
          creatorId: TEST_IDS.USER_STAFF_SALES,
          departmentId: TEST_IDS.DEPT_SALES,
        },
      ],
    });

    // Create tasks
    await prisma.task.createMany({
      data: [
        {
          id: TEST_IDS.TASK_ENG_UNASSIGNED,
          title: 'Engineering Unassigned Task',
          description: 'Task in engineering dept',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'TO_DO',
          ownerId: TEST_IDS.USER_STAFF,
          departmentId: TEST_IDS.DEPT_ENGINEERING,
          projectId: TEST_IDS.PROJECT_ENG,
        },
        {
          id: TEST_IDS.TASK_ENG_ASSIGNED,
          title: 'Engineering Assigned Task',
          description: 'Assigned task in engineering dept',
          priority: 7,
          dueDate: new Date('2025-12-31'),
          status: 'IN_PROGRESS',
          ownerId: TEST_IDS.USER_STAFF,
          departmentId: TEST_IDS.DEPT_ENGINEERING,
          projectId: TEST_IDS.PROJECT_ENG,
        },
        {
          id: TEST_IDS.TASK_SALES_ASSIGNED,
          title: 'Sales Assigned Task',
          description: 'Assigned task in sales dept',
          priority: 6,
          dueDate: new Date('2025-12-31'),
          status: 'TO_DO',
          ownerId: TEST_IDS.USER_STAFF_SALES,
          departmentId: TEST_IDS.DEPT_SALES,
          projectId: TEST_IDS.PROJECT_SALES,
        },
        {
          id: TEST_IDS.TASK_HR_ASSIGNED,
          title: 'HR Assigned Task',
          description: 'Assigned task in HR dept',
          priority: 8,
          dueDate: new Date('2025-12-31'),
          status: 'COMPLETED',
          ownerId: TEST_IDS.USER_HR_ADMIN_ONLY,
          departmentId: TEST_IDS.DEPT_HR,
          projectId: null,
        },
        {
          id: TEST_IDS.TASK_ENG_DEV_ASSIGNED,
          title: 'Dev Team Assigned Task',
          description: 'Assigned task in dev team',
          priority: 9,
          dueDate: new Date('2025-12-31'),
          status: 'IN_PROGRESS',
          ownerId: TEST_IDS.USER_STAFF,
          departmentId: TEST_IDS.DEPT_ENGINEERING_DEV,
          projectId: TEST_IDS.PROJECT_ENG,
        },
      ],
    });

    // Create task assignments
    await prisma.taskAssignment.createMany({
      data: [
        {
          taskId: TEST_IDS.TASK_ENG_ASSIGNED,
          userId: TEST_IDS.USER_STAFF,
          assignedById: TEST_IDS.USER_STAFF,
        },
        {
          taskId: TEST_IDS.TASK_SALES_ASSIGNED,
          userId: TEST_IDS.USER_STAFF_SALES,
          assignedById: TEST_IDS.USER_STAFF_SALES,
        },
        {
          taskId: TEST_IDS.TASK_HR_ASSIGNED,
          userId: TEST_IDS.USER_HR_ADMIN_ONLY,
          assignedById: TEST_IDS.USER_HR_ADMIN_ONLY,
        },
        {
          taskId: TEST_IDS.TASK_ENG_DEV_ASSIGNED,
          userId: TEST_IDS.USER_STAFF,
          assignedById: TEST_IDS.USER_STAFF,
        },
      ],
    });
  }

  async function cleanupTestData() {
    // Delete in reverse order of foreign key constraints using specific IDs
    // Use direct IDs, not relation filters
    // This prevents orphaned data issues in parallel test execution

    const taskIds = [
      TEST_IDS.TASK_ENG_UNASSIGNED,
      TEST_IDS.TASK_ENG_ASSIGNED,
      TEST_IDS.TASK_SALES_ASSIGNED,
      TEST_IDS.TASK_HR_ASSIGNED,
      TEST_IDS.TASK_ENG_DEV_ASSIGNED,
    ];

    const projectIds = [TEST_IDS.PROJECT_ENG, TEST_IDS.PROJECT_SALES];

    const userIds = [
      TEST_IDS.USER_HR_ADMIN_ONLY,
      TEST_IDS.USER_HR_ADMIN_AND_MANAGER,
      TEST_IDS.USER_MANAGER_ONLY,
      TEST_IDS.USER_STAFF,
      TEST_IDS.USER_STAFF_SALES,
    ];

    const deptIds = [
      TEST_IDS.DEPT_ENGINEERING_DEV,
      TEST_IDS.DEPT_ENGINEERING,
      TEST_IDS.DEPT_SALES,
      TEST_IDS.DEPT_HR,
      TEST_IDS.DEPT_ROOT,
    ];

    // Also cleanup any leftover archived tasks from this namespace
    await prisma.task.deleteMany({
      where: {
        title: {
          contains: testNamespace,
        },
      },
    });

    // Delete task assignments first
    await prisma.taskAssignment.deleteMany({
      where: {
        taskId: {
          in: taskIds,
        },
      },
    });

    // Delete tasks (works even if owner relation is broken)
    await prisma.task.deleteMany({
      where: {
        id: {
          in: taskIds,
        },
      },
    });

    // Delete projects
    await prisma.project.deleteMany({
      where: {
        id: {
          in: projectIds,
        },
      },
    });

    // Delete users
    await prisma.userProfile.deleteMany({
      where: {
        id: {
          in: userIds,
        },
      },
    });

    // Delete departments (in correct order - children first)
    await prisma.department.deleteMany({
      where: {
        id: {
          in: deptIds,
        },
      },
    });
  }

  beforeAll(async () => {
    // First, clean up any orphaned tasks that might cause Prisma relation errors
    // This handles tasks where the owner or department was deleted in previous failed test runs
    await prisma.$executeRaw`
      DELETE FROM "task"
      WHERE "ownerId" NOT IN (SELECT id FROM "user_profile")
         OR "departmentId" NOT IN (SELECT id FROM "department")
    `;

    // Cleanup existing test data
    await cleanupTestData();

    // Setup test data
    await setupTestData();
  }, 60000);

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  }, 60000);

  describe('Access Control - getCompanyTasks', () => {
    it('UAA0015: should allow HR/Admin user to access getCompanyTasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: TEST_IDS.DEPT_ROOT,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    }, 30000);

    it('UAA0026: should deny STAFF user access to getCompanyTasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_STAFF },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.task.getCompanyTasks({ departmentId: TEST_IDS.DEPT_ROOT })
      ).rejects.toThrow(/only.*hr.*admin/i);
    }, 30000);

    it('should deny MANAGER (without HR/Admin) access to getCompanyTasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_MANAGER_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.task.getCompanyTasks({ departmentId: TEST_IDS.DEPT_ROOT })
      ).rejects.toThrow(/only.*hr.*admin/i);
    }, 30000);

    it('should allow HR/Admin + Manager combined role to access getCompanyTasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_AND_MANAGER },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: TEST_IDS.DEPT_ROOT,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    }, 30000);
  });

  describe('canEdit Logic - HR/Admin without Manager Role', () => {
    it('UAA0015: HR/Admin WITHOUT Manager role should have canEdit=false for tasks in departments they do not manage', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: TEST_IDS.DEPT_ROOT,
      });

      // Find engineering task
      const engTask = result.find(
        (t: any) => t.id === TEST_IDS.TASK_ENG_ASSIGNED
      );
      expect(engTask).toBeDefined();
      if (engTask) {
        expect(engTask.canEdit).toBe(false);
      }

      // Find sales task
      const salesTask = result.find(
        (t: any) => t.id === TEST_IDS.TASK_SALES_ASSIGNED
      );
      expect(salesTask).toBeDefined();
      if (salesTask) {
        expect(salesTask.canEdit).toBe(false);
      }
    }, 30000);

    it('UAA0026: HR/Admin WITHOUT Manager role should have canEdit=true for tasks in their own department', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: TEST_IDS.DEPT_ROOT,
      });

      // Find HR department task
      const hrTask = result.find(
        (t: any) => t.id === TEST_IDS.TASK_HR_ASSIGNED
      );
      expect(hrTask).toBeDefined();
      if (hrTask) {
        expect(hrTask.canEdit).toBe(true);
      }
    }, 30000);
  });

  describe('canEdit Logic - HR/Admin with Manager Role', () => {
    it('UAA0016: HR/Admin WITH Manager role should have canEdit=true for tasks in departments they manage', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_AND_MANAGER },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: TEST_IDS.DEPT_ROOT,
      });

      // Find engineering task (user is manager of Engineering dept)
      const engTask = result.find(
        (t: any) => t.id === TEST_IDS.TASK_ENG_ASSIGNED
      );
      expect(engTask).toBeDefined();
      if (engTask) {
        expect(engTask.canEdit).toBe(true);
      }

      // Find task in subordinate department (Engineering > Dev)
      const engDevTask = result.find(
        (t: any) => t.id === TEST_IDS.TASK_ENG_DEV_ASSIGNED
      );
      expect(engDevTask).toBeDefined();
      if (engDevTask) {
        expect(engDevTask.canEdit).toBe(true);
      }
    }, 30000);

    it('UAA0016: HR/Admin WITH Manager role should have canEdit=false for tasks outside their managed hierarchy', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_AND_MANAGER },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: TEST_IDS.DEPT_ROOT,
      });

      // Find sales task (user is not manager of Sales dept)
      const salesTask = result.find(
        (t: any) => t.id === TEST_IDS.TASK_SALES_ASSIGNED
      );
      expect(salesTask).toBeDefined();
      if (salesTask) {
        expect(salesTask.canEdit).toBe(false);
      }
    }, 30000);
  });

  describe('System-Wide View - All Tasks Visible', () => {
    it('should return tasks from ALL departments for HR/Admin', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({});

      // Should see tasks from multiple departments
      const departmentIds = new Set(result.map((t: any) => t.departmentId));

      expect(departmentIds.has(TEST_IDS.DEPT_ENGINEERING)).toBe(true);
      expect(departmentIds.has(TEST_IDS.DEPT_SALES)).toBe(true);
      expect(departmentIds.has(TEST_IDS.DEPT_HR)).toBe(true);
      expect(departmentIds.size).toBeGreaterThanOrEqual(3);
    }, 30000);

    it('should include both assigned and unassigned tasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({});

      const assignedTask = result.find(
        (t: any) => t.id === TEST_IDS.TASK_ENG_ASSIGNED
      );
      const unassignedTask = result.find(
        (t: any) => t.id === TEST_IDS.TASK_ENG_UNASSIGNED
      );

      expect(assignedTask).toBeDefined();
      expect(unassignedTask).toBeDefined();
    }, 30000);
  });

  describe('Filtering Capabilities', () => {
    it('should filter tasks by department', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: TEST_IDS.DEPT_ENGINEERING,
      });

      // All tasks should be from Engineering department or its children
      result.forEach((task: any) => {
        expect([
          TEST_IDS.DEPT_ENGINEERING,
          TEST_IDS.DEPT_ENGINEERING_DEV,
        ]).toContain(task.departmentId);
      });
    }, 30000);

    it('should filter tasks by project', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: TEST_IDS.DEPT_ROOT,
        projectId: TEST_IDS.PROJECT_ENG,
      });

      // All tasks should belong to the specified project
      result.forEach((task: any) => {
        expect(task.projectId).toBe(TEST_IDS.PROJECT_ENG);
      });
    }, 30000);

    it('should filter tasks by assignee', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: TEST_IDS.DEPT_ROOT,
        assigneeId: TEST_IDS.USER_STAFF,
      });

      // All tasks should have the specified assignee
      result.forEach((task: any) => {
        const hasAssignee = task.assignments.some(
          (a: any) => a.userId === TEST_IDS.USER_STAFF
        );
        expect(hasAssignee).toBe(true);
      });
    }, 30000);

    it('should support multiple filters simultaneously', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: TEST_IDS.DEPT_ENGINEERING,
        projectId: TEST_IDS.PROJECT_ENG,
      });

      // All tasks should match both filters
      result.forEach((task: any) => {
        expect([
          TEST_IDS.DEPT_ENGINEERING,
          TEST_IDS.DEPT_ENGINEERING_DEV,
        ]).toContain(task.departmentId);
        expect(task.projectId).toBe(TEST_IDS.PROJECT_ENG);
      });
    }, 30000);

    it('should filter by task status', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: TEST_IDS.DEPT_ROOT,
        status: 'IN_PROGRESS',
      });

      result.forEach((task: any) => {
        expect(task.status).toBe('IN_PROGRESS');
      });
    }, 30000);
  });

  describe('Response Structure', () => {
    it('should include all necessary task fields', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: TEST_IDS.DEPT_ROOT,
      });

      expect(result.length).toBeGreaterThan(0);
      const task = result[0];

      // Verify required fields
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('description');
      expect(task).toHaveProperty('priority');
      expect(task).toHaveProperty('dueDate');
      expect(task).toHaveProperty('status');
      expect(task).toHaveProperty('departmentId');
      expect(task).toHaveProperty('canEdit');
      expect(task).toHaveProperty('assignments');
      expect(task).toHaveProperty('department');
    }, 30000);

    it('should include department information', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({});

      const task = result[0];
      expect(task.department).toBeDefined();
      expect(task.department).toHaveProperty('id');
      expect(task.department).toHaveProperty('name');
    }, 30000);

    it('should include assignment information', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({});

      const assignedTask = result.find(
        (t: any) => t.id === TEST_IDS.TASK_ENG_ASSIGNED
      );
      expect(assignedTask).toBeDefined();
      if (assignedTask) {
        expect(Array.isArray(assignedTask.assignments)).toBe(true);
        expect(assignedTask.assignments.length).toBeGreaterThan(0);
        expect(assignedTask.assignments[0]).toHaveProperty('userId');
        expect(assignedTask.assignments[0]).toHaveProperty('user');
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    it('should handle archived tasks based on filter', async () => {
      // Create unique IDs using testNamespace
      const archivedIds = [
        `archived-1-${testNamespace}`,
        `archived-2-${testNamespace}`,
      ];

      // Create tasks OUTSIDE transaction
      await prisma.task.createMany({
        data: [
          {
            id: archivedIds[0],
            title: `Archived Task 1 ${testNamespace}`,
            description: 'Test archived task for filtering',
            priority: 5,
            dueDate: new Date('2025-12-31'),
            status: 'COMPLETED',
            ownerId: TEST_IDS.USER_HR_ADMIN_ONLY,
            departmentId: TEST_IDS.DEPT_ENGINEERING,
            projectId: TEST_IDS.PROJECT_ENG,
            isArchived: true,
          },
          {
            id: archivedIds[1],
            title: `Archived Task 2 ${testNamespace}`,
            description: 'Another archived task for filtering',
            priority: 3,
            dueDate: new Date('2025-11-30'),
            status: 'COMPLETED',
            ownerId: TEST_IDS.USER_HR_ADMIN_ONLY,
            departmentId: TEST_IDS.DEPT_SALES,
            projectId: TEST_IDS.PROJECT_SALES,
            isArchived: true,
          },
        ],
      });

      try {
        const ctx = createInnerTRPCContext({
          session: {
            user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
            expires: new Date(Date.now() + 86400000).toISOString(),
          },
        });
        const caller = appRouter.createCaller(ctx);

        const resultWithArchived = await caller.task.getCompanyTasks({
          departmentId: TEST_IDS.DEPT_ROOT,
          includeArchived: true,
        });
        const resultWithoutArchived = await caller.task.getCompanyTasks({
          departmentId: TEST_IDS.DEPT_ROOT,
          includeArchived: false,
        });

        // Assert on YOUR specific tasks only
        expect(
          resultWithArchived.some(
            (t: { id: string }) => t.id === archivedIds[0]
          )
        ).toBe(true);
        expect(
          resultWithArchived.some(
            (t: { id: string }) => t.id === archivedIds[1]
          )
        ).toBe(true);

        expect(
          resultWithoutArchived.some(
            (t: { id: string }) => t.id === archivedIds[0]
          )
        ).toBe(false);
        expect(
          resultWithoutArchived.some(
            (t: { id: string }) => t.id === archivedIds[1]
          )
        ).toBe(false);
      } finally {
        // Clean up your tasks
        await prisma.task.deleteMany({
          where: { id: { in: archivedIds } },
        });
      }
    }, 30000);

    it('should return empty array when no tasks match filters', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: '99999999-9999-4000-8000-999999999999',
      });

      expect(result).toEqual([]);
    }, 30000);

    it('should handle tasks with no project', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({
        departmentId: TEST_IDS.DEPT_ROOT,
      });

      const taskWithoutProject = result.find((t: any) => !t.projectId);
      expect(taskWithoutProject).toBeDefined();
    }, 30000);
  });
});
