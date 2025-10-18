import { PrismaClient } from '@prisma/client';
import { appRouter } from '@/app/server/routers/_app';
import { createInnerTRPCContext } from '@/app/server/trpc';

const prisma = new PrismaClient();

// Use proper UUIDs for test data (valid v4 format)
const TEST_IDS = {
  DEPT_ENGINEERING: '11111111-1111-4111-8111-111111111111',
  DEPT_DEVELOPERS: '22222222-2222-4222-8222-222222222222',
  DEPT_SUPPORT: '33333333-3333-4333-8333-333333333333',
  USER_MANAGER: '44444444-4444-4444-8444-444444444444',
  USER_STAFF_DEV1: '55555555-5555-4555-8555-555555555555',
  USER_STAFF_SUPPORT1: '66666666-6666-4666-8666-666666666666',
  USER_STAFF_DEV2: '77777777-7777-4777-8777-777777777777',
  TASK_DEV1_ASSIGNED: '88888888-8888-4888-8888-888888888888',
  TASK_SUPPORT1_ASSIGNED: '99999999-9999-4999-8999-999999999999',
  TASK_UNASSIGNED: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

describe('Task API Permissions', () => {
  let testDepartments: any[];
  let testUsers: any[];
  let testTasks: any[];

  beforeAll(async () => {
    // Cleanup any existing test data first
    // Delete in correct order to respect foreign key constraints

    // 1. Delete task assignments first
    await prisma.taskAssignment.deleteMany({
      where: {
        OR: [
          {
            taskId: {
              in: Object.values(TEST_IDS).filter(
                id =>
                  id.startsWith('8') || id.startsWith('9') || id.startsWith('a')
              ),
            },
          },
          {
            userId: {
              in: Object.values(TEST_IDS).filter(
                id =>
                  id.startsWith('4') ||
                  id.startsWith('5') ||
                  id.startsWith('6') ||
                  id.startsWith('7')
              ),
            },
          },
        ],
      },
    });

    // 2. Delete tasks second (before users since tasks reference users as owners)
    // Delete ALL tasks that reference our test users as owners
    await prisma.task.deleteMany({
      where: {
        OR: [
          {
            id: {
              in: Object.values(TEST_IDS).filter(
                id =>
                  id.startsWith('8') || id.startsWith('9') || id.startsWith('a')
              ),
            },
          },
          {
            ownerId: {
              in: Object.values(TEST_IDS).filter(
                id =>
                  id.startsWith('4') ||
                  id.startsWith('5') ||
                  id.startsWith('6') ||
                  id.startsWith('7')
              ),
            },
          },
        ],
      },
    });

    // 3. Delete user profiles third (after tasks are deleted)
    await prisma.userProfile.deleteMany({
      where: {
        id: {
          in: Object.values(TEST_IDS).filter(
            id =>
              id.startsWith('4') ||
              id.startsWith('5') ||
              id.startsWith('6') ||
              id.startsWith('7')
          ),
        },
      },
    });

    // 4. Delete departments last (after users are deleted)
    await prisma.department.deleteMany({
      where: {
        id: {
          in: Object.values(TEST_IDS).filter(
            id => id.startsWith('1') || id.startsWith('2') || id.startsWith('3')
          ),
        },
      },
    });

    // Setup test data
    // Create departments hierarchy: Engineering > Developers > Support Team
    // Must be sequential due to foreign key constraints
    const deptEngineering = await prisma.department.create({
      data: {
        id: TEST_IDS.DEPT_ENGINEERING,
        name: 'Engineering Test',
        parentId: null,
        isActive: true,
      },
    });

    const deptDevelopers = await prisma.department.create({
      data: {
        id: TEST_IDS.DEPT_DEVELOPERS,
        name: 'Developers Test',
        parentId: TEST_IDS.DEPT_ENGINEERING,
        isActive: true,
      },
    });

    const deptSupport = await prisma.department.create({
      data: {
        id: TEST_IDS.DEPT_SUPPORT,
        name: 'Support Test',
        parentId: TEST_IDS.DEPT_ENGINEERING,
        isActive: true,
      },
    });

    testDepartments = [deptEngineering, deptDevelopers, deptSupport];

    // Create test users
    testUsers = await Promise.all([
      // Manager of Engineering
      prisma.userProfile.create({
        data: {
          id: TEST_IDS.USER_MANAGER,
          email: 'manager.eng@test.com',
          name: 'Engineering Manager',
          role: 'MANAGER',
          departmentId: TEST_IDS.DEPT_ENGINEERING,
          isActive: true,
        },
      }),
      // Staff in Developers
      prisma.userProfile.create({
        data: {
          id: TEST_IDS.USER_STAFF_DEV1,
          email: 'dev1@test.com',
          name: 'Developer 1',
          role: 'STAFF',
          departmentId: TEST_IDS.DEPT_DEVELOPERS,
          isActive: true,
        },
      }),
      // Staff in Support
      prisma.userProfile.create({
        data: {
          id: TEST_IDS.USER_STAFF_SUPPORT1,
          email: 'support1@test.com',
          name: 'Support Staff 1',
          role: 'STAFF',
          departmentId: TEST_IDS.DEPT_SUPPORT,
          isActive: true,
        },
      }),
      // Another staff in Developers (not assigned to tasks)
      prisma.userProfile.create({
        data: {
          id: TEST_IDS.USER_STAFF_DEV2,
          email: 'dev2@test.com',
          name: 'Developer 2',
          role: 'STAFF',
          departmentId: TEST_IDS.DEPT_DEVELOPERS,
          isActive: true,
        },
      }),
    ]);

    // Create test tasks
    const task1 = await prisma.task.create({
      data: {
        id: TEST_IDS.TASK_DEV1_ASSIGNED,
        title: 'Task assigned to Dev1',
        description: 'Test task 1',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        ownerId: TEST_IDS.USER_MANAGER,
        departmentId: TEST_IDS.DEPT_DEVELOPERS,
        isArchived: false,
      },
    });

    const task2 = await prisma.task.create({
      data: {
        id: TEST_IDS.TASK_SUPPORT1_ASSIGNED,
        title: 'Task assigned to Support1',
        description: 'Test task 2',
        priority: 3,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        ownerId: TEST_IDS.USER_MANAGER,
        departmentId: TEST_IDS.DEPT_SUPPORT,
        isArchived: false,
      },
    });

    const task3 = await prisma.task.create({
      data: {
        id: TEST_IDS.TASK_UNASSIGNED,
        title: 'Unassigned task in Developers',
        description: 'Test task 3',
        priority: 7,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        ownerId: TEST_IDS.USER_MANAGER,
        departmentId: TEST_IDS.DEPT_DEVELOPERS,
        isArchived: false,
      },
    });

    // Create task assignments
    await Promise.all([
      prisma.taskAssignment.create({
        data: {
          taskId: TEST_IDS.TASK_DEV1_ASSIGNED,
          userId: TEST_IDS.USER_STAFF_DEV1,
          assignedById: TEST_IDS.USER_MANAGER,
        },
      }),
      prisma.taskAssignment.create({
        data: {
          taskId: TEST_IDS.TASK_SUPPORT1_ASSIGNED,
          userId: TEST_IDS.USER_STAFF_SUPPORT1,
          assignedById: TEST_IDS.USER_MANAGER,
        },
      }),
    ]);

    testTasks = [task1, task2, task3];
  }, 60000);

  afterAll(async () => {
    // Cleanup test data (with null checks in case beforeAll failed)
    if (testTasks?.length) {
      await prisma.taskAssignment.deleteMany({
        where: {
          taskId: {
            in: testTasks.map(t => t.id),
          },
        },
      });

      await prisma.task.deleteMany({
        where: {
          id: {
            in: testTasks.map(t => t.id),
          },
        },
      });
    }

    if (testUsers?.length) {
      await prisma.userProfile.deleteMany({
        where: {
          id: {
            in: testUsers.map(u => u.id),
          },
        },
      });
    }

    if (testDepartments?.length) {
      await prisma.department.deleteMany({
        where: {
          id: {
            in: testDepartments.map(d => d.id),
          },
        },
      });
    }

    await prisma.$disconnect();
  }, 60000);

  describe('getUserTasks', () => {
    it('should return canEdit=true for all personal tasks (STAFF user)', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_STAFF_DEV1 },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getUserTasks({
        userId: TEST_IDS.USER_STAFF_DEV1,
        includeArchived: false,
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // All tasks should have canEdit=true since they're assigned to the user
      result.forEach((task: any) => {
        expect(task.canEdit).toBe(true);
      });
    }, 25000);

    it('should return canEdit=true for all personal tasks (MANAGER user)', async () => {
      const taskId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      // Create a task assigned to the manager
      await prisma.task.create({
        data: {
          id: taskId,
          title: 'Task assigned to Manager',
          description: 'Manager task',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'TO_DO',
          ownerId: TEST_IDS.USER_MANAGER,
          departmentId: TEST_IDS.DEPT_ENGINEERING,
          isArchived: false,
        },
      });

      await prisma.taskAssignment.create({
        data: {
          taskId: taskId,
          userId: TEST_IDS.USER_MANAGER,
          assignedById: TEST_IDS.USER_MANAGER,
        },
      });

      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_MANAGER },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getUserTasks({
        userId: TEST_IDS.USER_MANAGER,
        includeArchived: false,
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // All tasks should have canEdit=true
      result.forEach((task: any) => {
        expect(task.canEdit).toBe(true);
      });

      // Cleanup
      await prisma.taskAssignment.deleteMany({
        where: { taskId },
      });
      await prisma.task.delete({
        where: { id: taskId },
      });
    }, 25000);

    it('should only return tasks assigned to the user', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_STAFF_DEV1 },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getUserTasks({
        userId: TEST_IDS.USER_STAFF_DEV1,
        includeArchived: false,
      });

      // Should only have task-dev1-assigned
      const taskIds = result.map((t: any) => t.id);
      expect(taskIds).toContain(TEST_IDS.TASK_DEV1_ASSIGNED);
      expect(taskIds).not.toContain(TEST_IDS.TASK_SUPPORT1_ASSIGNED);
      expect(taskIds).not.toContain(TEST_IDS.TASK_UNASSIGNED);
    }, 25000);
  });

  describe('getDepartmentTasksForUser', () => {
    it('should return canEdit=true for staff assigned tasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_STAFF_DEV1 },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getDepartmentTasksForUser();

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // Find the task assigned to this staff member
      const assignedTask = result.find(
        (t: any) => t.id === TEST_IDS.TASK_DEV1_ASSIGNED
      );
      expect(assignedTask).toBeDefined();
      if (assignedTask) {
        expect(assignedTask.canEdit).toBe(true);
      }
    }, 25000);

    it('should return canEdit=false for staff non-assigned tasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_STAFF_DEV2 },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getDepartmentTasksForUser();

      expect(result).toBeDefined();

      // Dev2 is not assigned to any tasks in their department
      result.forEach((task: any) => {
        expect(task.canEdit).toBe(false);
      });
    }, 25000);

    it('should return canEdit=true for ALL manager tasks in hierarchy', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_MANAGER },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getDepartmentTasksForUser();

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // Manager should be able to edit ALL tasks in their hierarchy
      result.forEach((task: any) => {
        expect(task.canEdit).toBe(true);
      });

      // Should include tasks from Engineering, Developers, and Support departments
      const taskDepts = result.map((t: any) => t.departmentId);
      expect(taskDepts).toEqual(
        expect.arrayContaining([
          TEST_IDS.DEPT_DEVELOPERS,
          TEST_IDS.DEPT_SUPPORT,
        ])
      );
    }, 25000);

    it('should include tasks from subordinate departments for managers', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_MANAGER },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getDepartmentTasksForUser();

      // Manager of Engineering should see tasks from:
      // - dept-engineering-test
      // - dept-developers-test (child)
      // - dept-support-test (child)
      const taskIds = result.map((t: any) => t.id);
      expect(taskIds).toContain(TEST_IDS.TASK_DEV1_ASSIGNED);
      expect(taskIds).toContain(TEST_IDS.TASK_SUPPORT1_ASSIGNED);
      expect(taskIds).toContain(TEST_IDS.TASK_UNASSIGNED);
    }, 25000);

    it('should only show departmental tasks for staff, not all company tasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_STAFF_DEV1 },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getDepartmentTasksForUser();

      // Staff should only see tasks from their department and parent/sibling depts
      const taskDepts = result.map((t: any) => t.departmentId);

      // Should include tasks from dept-developers-test
      expect(taskDepts).toContain(TEST_IDS.DEPT_DEVELOPERS);

      // All tasks should be within the Engineering hierarchy
      taskDepts.forEach((deptId: string) => {
        expect([
          TEST_IDS.DEPT_ENGINEERING,
          TEST_IDS.DEPT_DEVELOPERS,
          TEST_IDS.DEPT_SUPPORT,
        ]).toContain(deptId);
      });
    }, 25000);
  });

  describe('getDashboardTasks (Manager)', () => {
    it('should return canEdit=true for all tasks (backward compatibility)', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_MANAGER },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getDashboardTasks();

      expect(result).toBeDefined();
      expect(result.tasks).toBeDefined();
      expect(result.tasks.length).toBeGreaterThan(0);

      // All tasks should have canEdit=true for managers
      result.tasks.forEach((task: any) => {
        expect(task.canEdit).toBe(true);
      });
    }, 25000);
  });

  describe('Edge Cases', () => {
    it('should handle archived tasks correctly', async () => {
      const archivedTaskId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

      // Create an archived task
      await prisma.task.create({
        data: {
          id: archivedTaskId,
          title: 'Archived Task',
          description: 'Archived',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'COMPLETED',
          ownerId: TEST_IDS.USER_MANAGER,
          departmentId: TEST_IDS.DEPT_DEVELOPERS,
          isArchived: true,
        },
      });

      await prisma.taskAssignment.create({
        data: {
          taskId: archivedTaskId,
          userId: TEST_IDS.USER_STAFF_DEV1,
          assignedById: TEST_IDS.USER_MANAGER,
        },
      });

      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_STAFF_DEV1 },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getUserTasks({
        userId: TEST_IDS.USER_STAFF_DEV1,
        includeArchived: false,
      });

      // Archived task should not be included
      const taskIds = result.map((t: any) => t.id);
      expect(taskIds).not.toContain(archivedTaskId);

      // Cleanup
      await prisma.taskAssignment.deleteMany({
        where: { taskId: archivedTaskId },
      });
      await prisma.task.delete({
        where: { id: archivedTaskId },
      });
    }, 25000);

    it('should handle user with no assigned tasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.USER_STAFF_DEV2 },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getUserTasks({
        userId: TEST_IDS.USER_STAFF_DEV2,
        includeArchived: false,
      });

      expect(result).toBeDefined();
      expect(result.length).toBe(0);
    }, 25000);
  });
});
