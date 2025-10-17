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

// Test IDs using proper UUID v4 format
const TEST_IDS = {
  // Departments
  DEPT_ROOT: '10000000-0000-4000-8000-000000000001',
  DEPT_ENGINEERING: '10000000-0000-4000-8000-000000000002',
  DEPT_SALES: '10000000-0000-4000-8000-000000000003',
  DEPT_HR: '10000000-0000-4000-8000-000000000004',
  DEPT_ENGINEERING_DEV: '10000000-0000-4000-8000-000000000005',

  // Users
  USER_HR_ADMIN_ONLY: '20000000-0000-4000-8000-000000000001',
  USER_HR_ADMIN_AND_MANAGER: '20000000-0000-4000-8000-000000000002',
  USER_MANAGER_ONLY: '20000000-0000-4000-8000-000000000003',
  USER_STAFF: '20000000-0000-4000-8000-000000000004',
  USER_STAFF_SALES: '20000000-0000-4000-8000-000000000005',

  // Projects
  PROJECT_ENG: '30000000-0000-4000-8000-000000000001',
  PROJECT_SALES: '30000000-0000-4000-8000-000000000002',

  // Tasks
  TASK_ENG_ASSIGNED: '40000000-0000-4000-8000-000000000001',
  TASK_ENG_UNASSIGNED: '40000000-0000-4000-8000-000000000002',
  TASK_SALES_ASSIGNED: '40000000-0000-4000-8000-000000000003',
  TASK_HR_ASSIGNED: '40000000-0000-4000-8000-000000000004',
  TASK_ENG_DEV_ASSIGNED: '40000000-0000-4000-8000-000000000005',
};

describe('HR/Admin Company Dashboard - Integration Tests', () => {
  beforeAll(async () => {
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

      const result = await caller.task.getCompanyTasks({});

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

      await expect(caller.task.getCompanyTasks({})).rejects.toThrow(
        /only.*hr.*admin/i
      );
    }, 30000);

    it('should deny MANAGER (without HR/Admin) access to getCompanyTasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_MANAGER_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      await expect(caller.task.getCompanyTasks({})).rejects.toThrow(
        /only.*hr.*admin/i
      );
    }, 30000);

    it('should allow HR/Admin + Manager combined role to access getCompanyTasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_AND_MANAGER },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getCompanyTasks({});

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

      const result = await caller.task.getCompanyTasks({});

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

      const result = await caller.task.getCompanyTasks({});

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

      const result = await caller.task.getCompanyTasks({});

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

      const result = await caller.task.getCompanyTasks({});

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

      const result = await caller.task.getCompanyTasks({});

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
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_HR_ADMIN_ONLY },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const resultWithArchived = await caller.task.getCompanyTasks({
        includeArchived: true,
      });
      const resultWithoutArchived = await caller.task.getCompanyTasks({
        includeArchived: false,
      });

      expect(resultWithArchived.length).toBeGreaterThanOrEqual(
        resultWithoutArchived.length
      );
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

      const result = await caller.task.getCompanyTasks({});

      const taskWithoutProject = result.find((t: any) => !t.projectId);
      expect(taskWithoutProject).toBeDefined();
    }, 30000);
  });
});

// Helper functions
async function setupTestData() {
  // Create departments
  await prisma.department.createMany({
    data: [
      {
        id: TEST_IDS.DEPT_ROOT,
        name: 'Root Test Dept',
        parentId: null,
        isActive: true,
      },
      {
        id: TEST_IDS.DEPT_ENGINEERING,
        name: 'Engineering Test Dept',
        parentId: TEST_IDS.DEPT_ROOT,
        isActive: true,
      },
      {
        id: TEST_IDS.DEPT_ENGINEERING_DEV,
        name: 'Engineering Dev Team',
        parentId: TEST_IDS.DEPT_ENGINEERING,
        isActive: true,
      },
      {
        id: TEST_IDS.DEPT_SALES,
        name: 'Sales Test Dept',
        parentId: TEST_IDS.DEPT_ROOT,
        isActive: true,
      },
      {
        id: TEST_IDS.DEPT_HR,
        name: 'HR Test Dept',
        parentId: TEST_IDS.DEPT_ROOT,
        isActive: true,
      },
    ],
  });

  // Create users
  await prisma.userProfile.createMany({
    data: [
      {
        id: TEST_IDS.USER_HR_ADMIN_ONLY,
        email: 'hradmin.only@test.com',
        name: 'HR Admin Only',
        role: 'STAFF',
        isHrAdmin: true,
        departmentId: TEST_IDS.DEPT_HR,
        isActive: true,
      },
      {
        id: TEST_IDS.USER_HR_ADMIN_AND_MANAGER,
        email: 'hradmin.manager@test.com',
        name: 'HR Admin and Manager',
        role: 'MANAGER',
        isHrAdmin: true,
        departmentId: TEST_IDS.DEPT_ENGINEERING,
        isActive: true,
      },
      {
        id: TEST_IDS.USER_MANAGER_ONLY,
        email: 'manager.only@test.com',
        name: 'Manager Only',
        role: 'MANAGER',
        isHrAdmin: false,
        departmentId: TEST_IDS.DEPT_SALES,
        isActive: true,
      },
      {
        id: TEST_IDS.USER_STAFF,
        email: 'staff@test.com',
        name: 'Staff User',
        role: 'STAFF',
        isHrAdmin: false,
        departmentId: TEST_IDS.DEPT_ENGINEERING,
        isActive: true,
      },
      {
        id: TEST_IDS.USER_STAFF_SALES,
        email: 'staff.sales@test.com',
        name: 'Sales Staff',
        role: 'STAFF',
        isHrAdmin: false,
        departmentId: TEST_IDS.DEPT_SALES,
        isActive: true,
      },
    ],
  });

  // Create projects
  await prisma.project.createMany({
    data: [
      {
        id: TEST_IDS.PROJECT_ENG,
        name: 'Engineering Project',
        description: 'Test engineering project',
        priority: 5,
        status: 'ACTIVE',
        departmentId: TEST_IDS.DEPT_ENGINEERING,
        creatorId: TEST_IDS.USER_HR_ADMIN_AND_MANAGER,
        isArchived: false,
      },
      {
        id: TEST_IDS.PROJECT_SALES,
        name: 'Sales Project',
        description: 'Test sales project',
        priority: 7,
        status: 'ACTIVE',
        departmentId: TEST_IDS.DEPT_SALES,
        creatorId: TEST_IDS.USER_MANAGER_ONLY,
        isArchived: false,
      },
    ],
  });

  // Create tasks
  await prisma.task.createMany({
    data: [
      {
        id: TEST_IDS.TASK_ENG_ASSIGNED,
        title: 'Engineering Task - Assigned',
        description: 'Test task assigned to staff',
        priority: 5,
        status: 'IN_PROGRESS',
        ownerId: TEST_IDS.USER_HR_ADMIN_AND_MANAGER,
        departmentId: TEST_IDS.DEPT_ENGINEERING,
        projectId: TEST_IDS.PROJECT_ENG,
        isArchived: false,
        dueDate: new Date('2025-12-31'),
      },
      {
        id: TEST_IDS.TASK_ENG_UNASSIGNED,
        title: 'Engineering Task - Unassigned',
        description: 'Test task with no assignees',
        priority: 3,
        status: 'TO_DO',
        ownerId: TEST_IDS.USER_HR_ADMIN_AND_MANAGER,
        departmentId: TEST_IDS.DEPT_ENGINEERING,
        projectId: TEST_IDS.PROJECT_ENG,
        isArchived: false,
        dueDate: new Date('2025-12-31'),
      },
      {
        id: TEST_IDS.TASK_SALES_ASSIGNED,
        title: 'Sales Task - Assigned',
        description: 'Test sales task',
        priority: 7,
        status: 'TO_DO',
        ownerId: TEST_IDS.USER_MANAGER_ONLY,
        departmentId: TEST_IDS.DEPT_SALES,
        projectId: TEST_IDS.PROJECT_SALES,
        isArchived: false,
        dueDate: new Date('2025-12-31'),
      },
      {
        id: TEST_IDS.TASK_HR_ASSIGNED,
        title: 'HR Task - Assigned',
        description: 'Test HR task',
        priority: 5,
        status: 'IN_PROGRESS',
        ownerId: TEST_IDS.USER_HR_ADMIN_ONLY,
        departmentId: TEST_IDS.DEPT_HR,
        projectId: null,
        isArchived: false,
        dueDate: new Date('2025-12-31'),
      },
      {
        id: TEST_IDS.TASK_ENG_DEV_ASSIGNED,
        title: 'Engineering Dev Task',
        description: 'Test task in subordinate department',
        priority: 6,
        status: 'TO_DO',
        ownerId: TEST_IDS.USER_HR_ADMIN_AND_MANAGER,
        departmentId: TEST_IDS.DEPT_ENGINEERING_DEV,
        projectId: null,
        isArchived: false,
        dueDate: new Date('2025-12-31'),
      },
    ],
  });

  // Create task assignments
  await prisma.taskAssignment.createMany({
    data: [
      {
        taskId: TEST_IDS.TASK_ENG_ASSIGNED,
        userId: TEST_IDS.USER_STAFF,
        assignedById: TEST_IDS.USER_HR_ADMIN_AND_MANAGER,
      },
      {
        taskId: TEST_IDS.TASK_SALES_ASSIGNED,
        userId: TEST_IDS.USER_STAFF_SALES,
        assignedById: TEST_IDS.USER_MANAGER_ONLY,
      },
      {
        taskId: TEST_IDS.TASK_HR_ASSIGNED,
        userId: TEST_IDS.USER_HR_ADMIN_ONLY,
        assignedById: TEST_IDS.USER_HR_ADMIN_ONLY,
      },
      {
        taskId: TEST_IDS.TASK_ENG_DEV_ASSIGNED,
        userId: TEST_IDS.USER_STAFF,
        assignedById: TEST_IDS.USER_HR_ADMIN_AND_MANAGER,
      },
    ],
  });
}

async function cleanupTestData() {
  // Delete in reverse order of foreign key constraints
  await prisma.taskAssignment.deleteMany({
    where: {
      taskId: {
        in: Object.values(TEST_IDS).filter(id => id.startsWith('40000000')),
      },
    },
  });

  await prisma.task.deleteMany({
    where: {
      id: {
        in: Object.values(TEST_IDS).filter(id => id.startsWith('40000000')),
      },
    },
  });

  await prisma.project.deleteMany({
    where: {
      id: {
        in: Object.values(TEST_IDS).filter(id => id.startsWith('30000000')),
      },
    },
  });

  await prisma.userProfile.deleteMany({
    where: {
      id: {
        in: Object.values(TEST_IDS).filter(id => id.startsWith('20000000')),
      },
    },
  });

  await prisma.department.deleteMany({
    where: {
      id: {
        in: Object.values(TEST_IDS).filter(id => id.startsWith('10000000')),
      },
    },
  });
}
