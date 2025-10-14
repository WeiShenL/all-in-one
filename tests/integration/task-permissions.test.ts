import { PrismaClient } from '@prisma/client';
import { appRouter } from '../../src/app/server/routers/_app';
import { createInnerTRPCContext } from '../../src/app/server/trpc';

const prisma = new PrismaClient();

describe('Task API Permissions', () => {
  let testDepartments: any[];
  let testUsers: any[];
  let testTasks: any[];

  beforeAll(async () => {
    // Cleanup any existing test data first
    await prisma.taskAssignment.deleteMany({
      where: {
        OR: [
          { taskId: { startsWith: 'task-' } },
          { userId: { startsWith: 'user-' } },
        ],
      },
    });

    await prisma.task.deleteMany({
      where: {
        id: { startsWith: 'task-' },
      },
    });

    await prisma.userProfile.deleteMany({
      where: {
        id: { startsWith: 'user-' },
      },
    });

    await prisma.department.deleteMany({
      where: {
        id: { startsWith: 'dept-' },
      },
    });

    // Setup test data
    // Create departments hierarchy: Engineering > Developers > Support Team
    // Must be sequential due to foreign key constraints
    const deptEngineering = await prisma.department.create({
      data: {
        id: 'dept-engineering-test',
        name: 'Engineering Test',
        parentId: null,
        isActive: true,
      },
    });

    const deptDevelopers = await prisma.department.create({
      data: {
        id: 'dept-developers-test',
        name: 'Developers Test',
        parentId: 'dept-engineering-test',
        isActive: true,
      },
    });

    const deptSupport = await prisma.department.create({
      data: {
        id: 'dept-support-test',
        name: 'Support Test',
        parentId: 'dept-engineering-test',
        isActive: true,
      },
    });

    testDepartments = [deptEngineering, deptDevelopers, deptSupport];

    // Create test users
    testUsers = await Promise.all([
      // Manager of Engineering
      prisma.userProfile.create({
        data: {
          id: 'user-manager-eng',
          email: 'manager.eng@test.com',
          name: 'Engineering Manager',
          role: 'MANAGER',
          departmentId: 'dept-engineering-test',
          isActive: true,
        },
      }),
      // Staff in Developers
      prisma.userProfile.create({
        data: {
          id: 'user-staff-dev1',
          email: 'dev1@test.com',
          name: 'Developer 1',
          role: 'STAFF',
          departmentId: 'dept-developers-test',
          isActive: true,
        },
      }),
      // Staff in Support
      prisma.userProfile.create({
        data: {
          id: 'user-staff-support1',
          email: 'support1@test.com',
          name: 'Support Staff 1',
          role: 'STAFF',
          departmentId: 'dept-support-test',
          isActive: true,
        },
      }),
      // Another staff in Developers (not assigned to tasks)
      prisma.userProfile.create({
        data: {
          id: 'user-staff-dev2',
          email: 'dev2@test.com',
          name: 'Developer 2',
          role: 'STAFF',
          departmentId: 'dept-developers-test',
          isActive: true,
        },
      }),
    ]);

    // Create test tasks
    const task1 = await prisma.task.create({
      data: {
        id: 'task-dev1-assigned',
        title: 'Task assigned to Dev1',
        description: 'Test task 1',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        ownerId: 'user-manager-eng',
        departmentId: 'dept-developers-test',
        isArchived: false,
      },
    });

    const task2 = await prisma.task.create({
      data: {
        id: 'task-support1-assigned',
        title: 'Task assigned to Support1',
        description: 'Test task 2',
        priority: 3,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        ownerId: 'user-manager-eng',
        departmentId: 'dept-support-test',
        isArchived: false,
      },
    });

    const task3 = await prisma.task.create({
      data: {
        id: 'task-unassigned',
        title: 'Unassigned task in Developers',
        description: 'Test task 3',
        priority: 7,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        ownerId: 'user-manager-eng',
        departmentId: 'dept-developers-test',
        isArchived: false,
      },
    });

    // Create task assignments
    await Promise.all([
      prisma.taskAssignment.create({
        data: {
          taskId: 'task-dev1-assigned',
          userId: 'user-staff-dev1',
          assignedById: 'user-manager-eng',
        },
      }),
      prisma.taskAssignment.create({
        data: {
          taskId: 'task-support1-assigned',
          userId: 'user-staff-support1',
          assignedById: 'user-manager-eng',
        },
      }),
    ]);

    testTasks = [task1, task2, task3];
  });

  afterAll(async () => {
    // Cleanup test data
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

    await prisma.userProfile.deleteMany({
      where: {
        id: {
          in: testUsers.map(u => u.id),
        },
      },
    });

    await prisma.department.deleteMany({
      where: {
        id: {
          in: testDepartments.map(d => d.id),
        },
      },
    });

    await prisma.$disconnect();
  });

  describe('getUserTasks', () => {
    it('should return canEdit=true for all personal tasks (STAFF user)', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-staff-dev1' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getUserTasks({
        userId: 'user-staff-dev1',
        includeArchived: false,
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // All tasks should have canEdit=true since they're assigned to the user
      result.forEach((task: any) => {
        expect(task.canEdit).toBe(true);
      });
    });

    it('should return canEdit=true for all personal tasks (MANAGER user)', async () => {
      // Create a task assigned to the manager
      await prisma.task.create({
        data: {
          id: 'task-manager-assigned',
          title: 'Task assigned to Manager',
          description: 'Manager task',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'TO_DO',
          ownerId: 'user-manager-eng',
          departmentId: 'dept-engineering-test',
          isArchived: false,
        },
      });

      await prisma.taskAssignment.create({
        data: {
          taskId: 'task-manager-assigned',
          userId: 'user-manager-eng',
          assignedById: 'user-manager-eng',
        },
      });

      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-manager-eng' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getUserTasks({
        userId: 'user-manager-eng',
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
        where: { taskId: 'task-manager-assigned' },
      });
      await prisma.task.delete({
        where: { id: 'task-manager-assigned' },
      });
    });

    it('should only return tasks assigned to the user', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-staff-dev1' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getUserTasks({
        userId: 'user-staff-dev1',
        includeArchived: false,
      });

      // Should only have task-dev1-assigned
      const taskIds = result.map((t: any) => t.id);
      expect(taskIds).toContain('task-dev1-assigned');
      expect(taskIds).not.toContain('task-support1-assigned');
      expect(taskIds).not.toContain('task-unassigned');
    });
  });

  describe('getDepartmentTasksForUser', () => {
    it('should return canEdit=true for staff assigned tasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-staff-dev1' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getDepartmentTasksForUser();

      expect(result).toBeDefined();
      expect(result.tasks.length).toBeGreaterThan(0);

      // Find the task assigned to this staff member
      const assignedTask = result.tasks.find(
        (t: any) => t.id === 'task-dev1-assigned'
      );
      expect(assignedTask).toBeDefined();
      expect(assignedTask.canEdit).toBe(true);
    });

    it('should return canEdit=false for staff non-assigned tasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-staff-dev2' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getDepartmentTasksForUser();

      expect(result).toBeDefined();

      // Dev2 is not assigned to any tasks in their department
      result.tasks.forEach((task: any) => {
        expect(task.canEdit).toBe(false);
      });
    });

    it('should return canEdit=true for ALL manager tasks in hierarchy', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-manager-eng' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getDepartmentTasksForUser();

      expect(result).toBeDefined();
      expect(result.tasks.length).toBeGreaterThan(0);

      // Manager should be able to edit ALL tasks in their hierarchy
      result.tasks.forEach((task: any) => {
        expect(task.canEdit).toBe(true);
      });

      // Should include tasks from Engineering, Developers, and Support departments
      const taskDepts = result.tasks.map((t: any) => t.departmentId);
      expect(taskDepts).toEqual(
        expect.arrayContaining(['dept-developers-test', 'dept-support-test'])
      );
    });

    it('should include tasks from subordinate departments for managers', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-manager-eng' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getDepartmentTasksForUser();

      // Manager of Engineering should see tasks from:
      // - dept-engineering-test
      // - dept-developers-test (child)
      // - dept-support-test (child)
      const taskIds = result.tasks.map((t: any) => t.id);
      expect(taskIds).toContain('task-dev1-assigned');
      expect(taskIds).toContain('task-support1-assigned');
      expect(taskIds).toContain('task-unassigned');
    });

    it('should only show departmental tasks for staff, not all company tasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-staff-dev1' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getDepartmentTasksForUser();

      // Staff should only see tasks from their department and parent/sibling depts
      const taskDepts = result.tasks.map((t: any) => t.departmentId);

      // Should include tasks from dept-developers-test
      expect(taskDepts).toContain('dept-developers-test');

      // All tasks should be within the Engineering hierarchy
      taskDepts.forEach((deptId: string) => {
        expect([
          'dept-engineering-test',
          'dept-developers-test',
          'dept-support-test',
        ]).toContain(deptId);
      });
    });
  });

  describe('getDashboardTasks (Manager)', () => {
    it('should return canEdit=true for all tasks (backward compatibility)', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-manager-eng' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getDashboardTasks();

      expect(result).toBeDefined();
      expect(result.tasks.length).toBeGreaterThan(0);

      // All tasks should have canEdit=true for managers
      result.tasks.forEach((task: any) => {
        expect(task.canEdit).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle archived tasks correctly', async () => {
      // Create an archived task
      await prisma.task.create({
        data: {
          id: 'task-archived',
          title: 'Archived Task',
          description: 'Archived',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          status: 'COMPLETED',
          ownerId: 'user-manager-eng',
          departmentId: 'dept-developers-test',
          isArchived: true,
        },
      });

      await prisma.taskAssignment.create({
        data: {
          taskId: 'task-archived',
          userId: 'user-staff-dev1',
          assignedById: 'user-manager-eng',
        },
      });

      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-staff-dev1' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getUserTasks({
        userId: 'user-staff-dev1',
        includeArchived: false,
      });

      // Archived task should not be included
      const taskIds = result.map((t: any) => t.id);
      expect(taskIds).not.toContain('task-archived');

      // Cleanup
      await prisma.taskAssignment.deleteMany({
        where: { taskId: 'task-archived' },
      });
      await prisma.task.delete({
        where: { id: 'task-archived' },
      });
    });

    it('should handle user with no assigned tasks', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-staff-dev2' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.task.getUserTasks({
        userId: 'user-staff-dev2',
        includeArchived: false,
      });

      expect(result).toBeDefined();
      expect(result.length).toBe(0);
    });
  });
});
