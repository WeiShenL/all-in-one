/**
 * Integration Tests for Project Report Export
 *
 * Tests tRPC endpoint project.getProjectReport
 * Focus: Export capability, ensuring data is fetched
 *
 * Test Coverage:
 * - Authorization (HR/Admin access control)
 * - Data structure validation
 * - Export capability (PDF/XLSX can be generated)
 * - Edge cases (missing data, null values)
 *
 */

import { appRouter } from '@/app/server/routers/_app';
import { prisma } from '@/app/lib/prisma';
import { createInnerTRPCContext } from '@/app/server/trpc';

// Generate unique test IDs based on namespace to avoid conflicts in parallel test runs
function generateTestIds(testNamespace: string) {
  // Create a hash from the namespace to generate consistent but unique IDs
  const hash = testNamespace.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  // Generate valid UUID v4 format
  const baseId = Math.abs(hash).toString(16).padStart(8, '0');

  // Create valid UUID v4 segments
  const createUuid = (prefix: string, suffix: string) => {
    const segment1 = prefix.padStart(8, '0');
    const segment2 = baseId.substring(0, 4);
    const segment3 = '4' + baseId.substring(4, 7); // 4xxx (version 4)
    const segment4 = '8' + suffix.substring(0, 3); // 8xxx (variant)
    const segment5 = (
      suffix.substring(3, 7) +
      baseId.substring(7, 8) +
      '0000'
    ).padStart(12, '0');
    return `${segment1}-${segment2}-${segment3}-${segment4}-${segment5}`;
  };

  return {
    // Department
    DEPT_ID: createUuid('dept0000', '0001'),

    // Users
    HR_ADMIN_USER: createUuid('user0000', '0001'),
    STAFF_WITH_HR_FLAG: createUuid('user0000', '0002'),
    REGULAR_STAFF: createUuid('user0000', '0003'),
    MANAGER_USER: createUuid('user0000', '0004'),

    // Project
    PROJECT_ID: createUuid('proj0000', '0001'),
    EMPTY_PROJECT_ID: createUuid('proj0000', '0002'),

    // Tasks
    TASK_1: createUuid('task0000', '0001'),
    TASK_2: createUuid('task0000', '0002'),
    TASK_3: createUuid('task0000', '0003'),
  };
}

describe('Project Report Export - Parallel Integration Tests', () => {
  // Unique namespace for this test run (parallel isolation)
  const testNamespace = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const TEST_IDS = generateTestIds(testNamespace);

  beforeAll(async () => {
    // Create test department
    await prisma.department.create({
      data: {
        id: TEST_IDS.DEPT_ID,
        name: `Report Test Dept-${testNamespace}`,
        isActive: true,
      },
    });

    // Create HR/Admin user
    await prisma.userProfile.create({
      data: {
        id: TEST_IDS.HR_ADMIN_USER,
        email: `hr-report@${testNamespace}.com`,
        name: `HR Admin User-${testNamespace}`,
        role: 'HR_ADMIN',
        departmentId: TEST_IDS.DEPT_ID,
        isHrAdmin: false,
      },
    });

    // Create STAFF user with isHrAdmin flag
    await prisma.userProfile.create({
      data: {
        id: TEST_IDS.STAFF_WITH_HR_FLAG,
        email: `staff-hr@${testNamespace}.com`,
        name: `Staff with HR Flag-${testNamespace}`,
        role: 'STAFF',
        departmentId: TEST_IDS.DEPT_ID,
        isHrAdmin: true, // Has HR permissions
      },
    });

    // Create regular STAFF user (no HR permissions)
    await prisma.userProfile.create({
      data: {
        id: TEST_IDS.REGULAR_STAFF,
        email: `staff-regular@${testNamespace}.com`,
        name: `Regular Staff-${testNamespace}`,
        role: 'STAFF',
        departmentId: TEST_IDS.DEPT_ID,
        isHrAdmin: false,
      },
    });

    // Create MANAGER user (no HR permissions)
    await prisma.userProfile.create({
      data: {
        id: TEST_IDS.MANAGER_USER,
        email: `manager@${testNamespace}.com`,
        name: `Manager User-${testNamespace}`,
        role: 'MANAGER',
        departmentId: TEST_IDS.DEPT_ID,
        isHrAdmin: false,
      },
    });

    // Create test project
    await prisma.project.create({
      data: {
        id: TEST_IDS.PROJECT_ID,
        name: `Report Test Project-${testNamespace}`,
        description: 'Project for testing report export',
        priority: 7,
        status: 'ACTIVE',
        departmentId: TEST_IDS.DEPT_ID,
        creatorId: TEST_IDS.HR_ADMIN_USER,
        isArchived: false,
      },
    });

    // Create empty project (for edge case testing)
    await prisma.project.create({
      data: {
        id: TEST_IDS.EMPTY_PROJECT_ID,
        name: `Empty Project-${testNamespace}`,
        description: null,
        priority: 5,
        status: 'ACTIVE',
        departmentId: TEST_IDS.DEPT_ID,
        creatorId: TEST_IDS.HR_ADMIN_USER,
        isArchived: false,
      },
    });

    // Create test tasks
    await prisma.task.createMany({
      data: [
        {
          id: TEST_IDS.TASK_1,
          title: 'Completed Task',
          description: 'Task 1',
          priority: 8,
          status: 'COMPLETED',
          dueDate: new Date('2025-10-15'),
          ownerId: TEST_IDS.HR_ADMIN_USER,
          projectId: TEST_IDS.PROJECT_ID,
          departmentId: TEST_IDS.DEPT_ID,
        },
        {
          id: TEST_IDS.TASK_2,
          title: 'In Progress Task',
          description: 'Task 2',
          priority: 6,
          status: 'IN_PROGRESS',
          dueDate: new Date('2025-10-25'),
          ownerId: TEST_IDS.HR_ADMIN_USER,
          projectId: TEST_IDS.PROJECT_ID,
          departmentId: TEST_IDS.DEPT_ID,
        },
        {
          id: TEST_IDS.TASK_3,
          title: 'Todo Task',
          description: 'Task 3',
          priority: 5,
          status: 'TO_DO',
          dueDate: new Date('2025-10-30'),
          ownerId: TEST_IDS.HR_ADMIN_USER,
          projectId: TEST_IDS.PROJECT_ID,
          departmentId: TEST_IDS.DEPT_ID,
        },
      ],
    });

    // Create task assignments
    await prisma.taskAssignment.createMany({
      data: [
        {
          taskId: TEST_IDS.TASK_1,
          userId: TEST_IDS.REGULAR_STAFF,
          assignedById: TEST_IDS.HR_ADMIN_USER,
        },
        {
          taskId: TEST_IDS.TASK_2,
          userId: TEST_IDS.REGULAR_STAFF,
          assignedById: TEST_IDS.HR_ADMIN_USER,
        },
        {
          taskId: TEST_IDS.TASK_2,
          userId: TEST_IDS.MANAGER_USER,
          assignedById: TEST_IDS.HR_ADMIN_USER,
        },
      ],
    });

    // Create project collaborators
    await prisma.projectCollaborator.createMany({
      data: [
        {
          projectId: TEST_IDS.PROJECT_ID,
          userId: TEST_IDS.REGULAR_STAFF,
          departmentId: TEST_IDS.DEPT_ID,
        },
        {
          projectId: TEST_IDS.PROJECT_ID,
          userId: TEST_IDS.MANAGER_USER,
          departmentId: TEST_IDS.DEPT_ID,
        },
      ],
    });
  }, 60000);

  afterAll(async () => {
    // Cleanup in reverse order of dependencies
    await prisma.taskAssignment.deleteMany({
      where: {
        taskId: { in: [TEST_IDS.TASK_1, TEST_IDS.TASK_2, TEST_IDS.TASK_3] },
      },
    });
    await prisma.projectCollaborator.deleteMany({
      where: {
        projectId: { in: [TEST_IDS.PROJECT_ID, TEST_IDS.EMPTY_PROJECT_ID] },
      },
    });
    await prisma.task.deleteMany({
      where: {
        id: { in: [TEST_IDS.TASK_1, TEST_IDS.TASK_2, TEST_IDS.TASK_3] },
      },
    });
    await prisma.project.deleteMany({
      where: { id: { in: [TEST_IDS.PROJECT_ID, TEST_IDS.EMPTY_PROJECT_ID] } },
    });
    await prisma.userProfile.deleteMany({
      where: {
        id: {
          in: [
            TEST_IDS.HR_ADMIN_USER,
            TEST_IDS.STAFF_WITH_HR_FLAG,
            TEST_IDS.REGULAR_STAFF,
            TEST_IDS.MANAGER_USER,
          ],
        },
      },
    });
    await prisma.department.deleteMany({
      where: { id: TEST_IDS.DEPT_ID },
    });
  }, 60000);

  describe('Authorization Tests', () => {
    it('should allow HR_ADMIN role to access report', async () => {
      const ctx = await createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.HR_ADMIN_USER },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.project.getProjectReport({
        id: TEST_IDS.PROJECT_ID,
      });

      expect(result).toBeDefined();
      expect(result.project.id).toBe(TEST_IDS.PROJECT_ID);
    }, 30000);

    it('should allow STAFF with isHrAdmin flag to access report', async () => {
      const ctx = await createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.STAFF_WITH_HR_FLAG },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.project.getProjectReport({
        id: TEST_IDS.PROJECT_ID,
      });

      expect(result).toBeDefined();
      expect(result.project.id).toBe(TEST_IDS.PROJECT_ID);
    }, 30000);

    it('should deny regular STAFF without isHrAdmin flag', async () => {
      const ctx = await createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.REGULAR_STAFF },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.project.getProjectReport({ id: TEST_IDS.PROJECT_ID })
      ).rejects.toThrow('Unauthorized: Only HR/Admin users can export reports');
    }, 30000);

    it('should deny MANAGER without isHrAdmin flag', async () => {
      const ctx = await createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.MANAGER_USER },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.project.getProjectReport({ id: TEST_IDS.PROJECT_ID })
      ).rejects.toThrow('Unauthorized: Only HR/Admin users can export reports');
    }, 30000);

    it('should deny unauthenticated requests', async () => {
      const ctx = await createInnerTRPCContext({
        session: null,
      });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.project.getProjectReport({ id: TEST_IDS.PROJECT_ID })
      ).rejects.toThrow();
    }, 30000);
  });

  describe('Data Structure Tests (DDD Pattern)', () => {
    let caller: any;

    beforeEach(async () => {
      const ctx = await createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.HR_ADMIN_USER },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      caller = appRouter.createCaller(ctx);
    });

    it('should return valid report data structure', async () => {
      const result = await caller.project.getProjectReport({
        id: TEST_IDS.PROJECT_ID,
      });

      // Verify structure (not exact values - focus on export capability)
      expect(result).toMatchObject({
        project: {
          id: expect.any(String),
          name: expect.any(String),
          priority: expect.any(Number),
          status: expect.any(String),
          departmentName: expect.any(String),
          creatorName: expect.any(String),
          creatorEmail: expect.any(String),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        tasks: expect.any(Array),
        collaborators: expect.any(Array),
      });

      // Verify no statistics field (removed in DDD refactor)
      expect(result).not.toHaveProperty('statistics');
    }, 30000);

    it('should include project overview data', async () => {
      const result = await caller.project.getProjectReport({
        id: TEST_IDS.PROJECT_ID,
      });

      // Just verify project data is present, not exact values
      expect(result.project.id).toBe(TEST_IDS.PROJECT_ID);
      expect(result.project.name).toBeTruthy();
      expect(result.project.departmentName).toBeTruthy();
      expect(result.project.creatorName).toBeTruthy();
      expect(result.project.creatorEmail).toBeTruthy();
    }, 30000);

    it('should include tasks array (export capability)', async () => {
      const result = await caller.project.getProjectReport({
        id: TEST_IDS.PROJECT_ID,
      });

      // Verify tasks array exists and has content
      expect(result.tasks).toBeInstanceOf(Array);
      expect(result.tasks.length).toBeGreaterThan(0);

      // Verify tasks have required fields for export
      const task = result.tasks[0];
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('status');
      expect(task).toHaveProperty('priority');
      expect(task).toHaveProperty('ownerName');
      expect(task).toHaveProperty('assignees');
    }, 30000);

    it('should include collaborators array (export capability)', async () => {
      const result = await caller.project.getProjectReport({
        id: TEST_IDS.PROJECT_ID,
      });

      // Verify collaborators array exists and has content
      expect(result.collaborators).toBeInstanceOf(Array);
      expect(result.collaborators.length).toBeGreaterThan(0);

      // Verify collaborators have required fields for export
      const collaborator = result.collaborators[0];
      expect(collaborator).toHaveProperty('name');
      expect(collaborator).toHaveProperty('email');
      expect(collaborator).toHaveProperty('departmentName');
      expect(collaborator).toHaveProperty('addedAt');
    }, 30000);
  });

  describe('Export Capability Tests', () => {
    let caller: any;

    beforeEach(async () => {
      const ctx = await createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.HR_ADMIN_USER },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      caller = appRouter.createCaller(ctx);
    });

    it('should return data that can be exported to PDF', async () => {
      const result = await caller.project.getProjectReport({
        id: TEST_IDS.PROJECT_ID,
      });

      // Verify all required fields for PDF export are present
      expect(result.project.name).toBeTruthy();
      expect(result.project.status).toBeTruthy();
      expect(result.project.priority).toBeGreaterThanOrEqual(1);
      expect(result.project.priority).toBeLessThanOrEqual(10);
      expect(result.project.createdAt).toBeInstanceOf(Date);
      expect(result.project.updatedAt).toBeInstanceOf(Date);

      // Description can be null - verify it's defined
      expect(result.project).toHaveProperty('description');
    }, 30000);

    it('should return data that can be exported to XLSX', async () => {
      const result = await caller.project.getProjectReport({
        id: TEST_IDS.PROJECT_ID,
      });

      // Verify data structure is suitable for XLSX export
      expect(result.project).toBeDefined();
      expect(result.tasks).toBeInstanceOf(Array);
      expect(result.collaborators).toBeInstanceOf(Array);

      // Verify project overview fields (used in XLSX Overview sheet)
      expect(result.project.name).toBeTruthy();
      expect(result.project.departmentName).toBeTruthy();
      expect(result.project.creatorName).toBeTruthy();
      expect(result.project.creatorEmail).toContain('@');
    }, 30000);

    it('should handle empty tasks array for export', async () => {
      const result = await caller.project.getProjectReport({
        id: TEST_IDS.EMPTY_PROJECT_ID,
      });

      // Empty project should still return valid structure
      expect(result.project).toBeDefined();
      expect(result.tasks).toEqual([]);
      expect(result.collaborators).toEqual([]);

      // Can still be exported (PDF/XLSX handle empty arrays)
      expect(result.project.name).toBeTruthy();
    }, 30000);

    it('should handle empty collaborators array for export', async () => {
      const result = await caller.project.getProjectReport({
        id: TEST_IDS.EMPTY_PROJECT_ID,
      });

      // Verify empty collaborators don't break export
      expect(result.collaborators).toBeInstanceOf(Array);
      expect(result.collaborators).toHaveLength(0);

      // Data is still exportable
      expect(result.project).toBeDefined();
    }, 30000);
  });

  describe('Edge Cases', () => {
    let caller: any;

    beforeEach(async () => {
      const ctx = await createInnerTRPCContext({
        session: {
          user: { id: TEST_IDS.HR_ADMIN_USER },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      caller = appRouter.createCaller(ctx);
    });

    it('should throw error for non-existent project', async () => {
      await expect(
        caller.project.getProjectReport({ id: 'non-existent-project' })
      ).rejects.toThrow('Project not found');
    }, 30000);

    it('should handle project with null description', async () => {
      const result = await caller.project.getProjectReport({
        id: TEST_IDS.EMPTY_PROJECT_ID,
      });

      // Null description should be handled gracefully
      expect(result.project.description).toBeNull();

      // Data is still exportable
      expect(result.project.name).toBeTruthy();
      expect(result.project.id).toBe(TEST_IDS.EMPTY_PROJECT_ID);
    }, 30000);
  });
});
