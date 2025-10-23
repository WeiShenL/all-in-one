/**
 * @jest-environment node
 * Integration Tests for Project Collaborator Management (SCRUM-33)
 *
 * Tests the following acceptance criteria:
 * - Staff can view all current collaborators of corresponding project
 * - Manager can remove any of the current collaborators
 * - A user is removed as a collaborator from a project if there are no tasks assigned
 * - Collaborators can no longer view the project they are no longer part of
 * - Collaborators can no longer view tasks under the project they are no longer part of
 */

import { Client } from 'pg';
import { ProjectService } from '@/services/project/ProjectService';
import { PrismaProjectRepository } from '@/repositories/PrismaProjectRepository';
import { PrismaClient } from '@prisma/client';

describe('SCRUM-33: Project Collaborator Management', () => {
  let pgClient: Client;
  let prisma: PrismaClient;
  let projectService: ProjectService;
  let projectRepo: PrismaProjectRepository;

  // Test data with unique timestamp-based IDs
  const testRunId = Date.now();
  const testProjectId = `project-${testRunId}`;
  const testManagerId = `manager-${testRunId}`;
  const testStaff1Id = `staff1-${testRunId}`;
  const testStaff2Id = `staff2-${testRunId}`;
  const testDeptId = `dept-${testRunId}`;

  // Track created resources for cleanup
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    prisma = new PrismaClient();
    projectRepo = new PrismaProjectRepository(prisma);
    projectService = new ProjectService(projectRepo);

    // Create test department
    await pgClient.query(
      `INSERT INTO public.department (id, name, "parentId", "managerId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, NULL, NULL, true, NOW(), NOW())`,
      [testDeptId, `Test Dept ${testRunId}`]
    );

    // Create test users
    await pgClient.query(
      `INSERT INTO public.user_profile (id, email, name, role, "departmentId", "isHrAdmin", "isActive", "createdAt", "updatedAt")
       VALUES
         ($1, $2, $3, 'MANAGER', $4, false, true, NOW(), NOW()),
         ($5, $6, $7, 'STAFF', $4, false, true, NOW(), NOW()),
         ($8, $9, $10, 'STAFF', $4, false, true, NOW(), NOW())`,
      [
        testManagerId,
        `manager-${testRunId}@test.com`,
        `Test Manager ${testRunId}`,
        testDeptId,
        testStaff1Id,
        `staff1-${testRunId}@test.com`,
        `Test Staff 1 ${testRunId}`,
        testStaff2Id,
        `staff2-${testRunId}@test.com`,
        `Test Staff 2 ${testRunId}`,
      ]
    );

    // Create test project
    await pgClient.query(
      `INSERT INTO public.project (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 5, 'ACTIVE', $4, $5, false, NOW(), NOW())`,
      [
        testProjectId,
        `Test Project ${testRunId}`,
        'Project for testing collaborator management',
        testDeptId,
        testManagerId,
      ]
    );

    // Create test task with two assignees
    const taskId = `task-${testRunId}`;
    createdTaskIds.push(taskId);
    await pgClient.query(
      `INSERT INTO public.task (id, title, description, priority, "dueDate", status, "departmentId", "projectId", "ownerId", "isArchived", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 5, $4, 'TO_DO', $5, $6, $7, false, NOW(), NOW())`,
      [
        taskId,
        'Test Task',
        'A task for testing',
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        testDeptId,
        testProjectId,
        testManagerId,
      ]
    );

    // Create assignments
    await pgClient.query(
      `INSERT INTO public.task_assignment ("taskId", "userId", "assignedById", "createdAt")
       VALUES ($1, $2, $3, NOW()), ($1, $4, $3, NOW())`,
      [taskId, testStaff1Id, testManagerId, testStaff2Id]
    );
  });

  afterAll(async () => {
    // Clean up test data in reverse order of foreign keys
    for (const taskId of createdTaskIds) {
      await pgClient.query(
        'DELETE FROM public.task_assignment WHERE "taskId" = $1',
        [taskId]
      );
    }
    await pgClient.query('DELETE FROM public.task WHERE "projectId" = $1', [
      testProjectId,
    ]);
    await pgClient.query('DELETE FROM public.project WHERE id = $1', [
      testProjectId,
    ]);
    await pgClient.query('DELETE FROM public.user_profile WHERE id = ANY($1)', [
      [testManagerId, testStaff1Id, testStaff2Id],
    ]);
    await pgClient.query('DELETE FROM public.department WHERE id = $1', [
      testDeptId,
    ]);

    await prisma.$disconnect();
    await pgClient.end();
  });

  describe('View Collaborators', () => {
    it('should return all users assigned to tasks in the project', async () => {
      const collaborators = await projectService.getProjectCollaborators(
        testProjectId,
        {
          userId: testStaff1Id,
          departmentId: testDeptId,
          role: 'STAFF',
        }
      );

      expect(collaborators).toHaveLength(2);
      expect(collaborators.map(c => c.id)).toContain(testStaff1Id);
      expect(collaborators.map(c => c.id)).toContain(testStaff2Id);
    });

    it('should return unique users even if assigned to multiple tasks', async () => {
      // Create another task with the same assignee
      const task2Id = `task2-${testRunId}`;
      createdTaskIds.push(task2Id);
      await pgClient.query(
        `INSERT INTO public.task (id, title, description, priority, "dueDate", status, "departmentId", "projectId", "ownerId", "isArchived", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 3, $4, 'TO_DO', $5, $6, $7, false, NOW(), NOW())`,
        [
          task2Id,
          'Another Task',
          'Another task',
          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          testDeptId,
          testProjectId,
          testManagerId,
        ]
      );

      await pgClient.query(
        `INSERT INTO public.task_assignment ("taskId", "userId", "assignedById", "createdAt")
         VALUES ($1, $2, $3, NOW())`,
        [task2Id, testStaff1Id, testManagerId]
      );

      const collaborators = await projectService.getProjectCollaborators(
        testProjectId,
        {
          userId: testManagerId,
          departmentId: testDeptId,
          role: 'MANAGER',
        }
      );

      // Should still be 2 unique users
      expect(collaborators).toHaveLength(2);
      const uniqueIds = new Set(collaborators.map(c => c.id));
      expect(uniqueIds.size).toBe(2);
    });
  });

  describe('Remove Collaborators', () => {
    it('should allow managers to remove collaborators', async () => {
      await projectService.removeProjectCollaborator(
        testProjectId,
        testStaff1Id,
        {
          userId: testManagerId,
          departmentId: testDeptId,
          role: 'MANAGER',
        }
      );

      const collaborators = await projectService.getProjectCollaborators(
        testProjectId,
        {
          userId: testManagerId,
          departmentId: testDeptId,
          role: 'MANAGER',
        }
      );

      expect(collaborators).toHaveLength(1);
      expect(collaborators[0].id).toBe(testStaff2Id);

      // Restore the assignment for other tests
      const taskId = createdTaskIds[0];
      await pgClient.query(
        `INSERT INTO public.task_assignment ("taskId", "userId", "assignedById", "createdAt")
         VALUES ($1, $2, $3, NOW())`,
        [taskId, testStaff1Id, testManagerId]
      );
    });

    it('should not allow staff to remove collaborators', async () => {
      await expect(
        projectService.removeProjectCollaborator(testProjectId, testStaff2Id, {
          userId: testStaff1Id,
          departmentId: testDeptId,
          role: 'STAFF',
        })
      ).rejects.toThrow('Only managers can remove collaborators from projects');
    });

    it('should prevent removal if it would leave task with no assignees', async () => {
      // Create a task with only one assignee
      const singleTaskId = `task-single-${testRunId}`;
      createdTaskIds.push(singleTaskId);
      await pgClient.query(
        `INSERT INTO public.task (id, title, description, priority, "dueDate", status, "departmentId", "projectId", "ownerId", "isArchived", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 5, $4, 'TO_DO', $5, $6, $7, false, NOW(), NOW())`,
        [
          singleTaskId,
          'Single Assignee Task',
          'Task with one assignee',
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          testDeptId,
          testProjectId,
          testManagerId,
        ]
      );

      await pgClient.query(
        `INSERT INTO public.task_assignment ("taskId", "userId", "assignedById", "createdAt")
         VALUES ($1, $2, $3, NOW())`,
        [singleTaskId, testManagerId, testManagerId]
      );

      // Try to remove the only assignee from this task
      await expect(
        projectService.removeProjectCollaborator(testProjectId, testManagerId, {
          userId: testManagerId,
          departmentId: testDeptId,
          role: 'MANAGER',
        })
      ).rejects.toThrow(/must have at least one assignee/);
    });

    it('should remove user from all project tasks', async () => {
      // Create multiple tasks with staff1 assigned
      const multiTask1Id = `task-multi1-${testRunId}`;
      const multiTask2Id = `task-multi2-${testRunId}`;
      createdTaskIds.push(multiTask1Id, multiTask2Id);

      for (const taskId of [multiTask1Id, multiTask2Id]) {
        await pgClient.query(
          `INSERT INTO public.task (id, title, description, priority, "dueDate", status, "departmentId", "projectId", "ownerId", "isArchived", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 3, $4, 'TO_DO', $5, $6, $7, false, NOW(), NOW())`,
          [
            taskId,
            `Task ${taskId}`,
            'Multi-task test',
            new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            testDeptId,
            testProjectId,
            testManagerId,
          ]
        );

        await pgClient.query(
          `INSERT INTO public.task_assignment ("taskId", "userId", "assignedById", "createdAt")
           VALUES ($1, $2, $3, NOW()), ($1, $4, $3, NOW())`,
          [taskId, testStaff1Id, testManagerId, testStaff2Id]
        );
      }

      // Remove staff1 from the project
      await projectService.removeProjectCollaborator(
        testProjectId,
        testStaff1Id,
        {
          userId: testManagerId,
          departmentId: testDeptId,
          role: 'MANAGER',
        }
      );

      // Check that staff1 is removed from all tasks
      const result = await pgClient.query(
        `SELECT "taskId" FROM public.task_assignment
         WHERE "userId" = $1 AND "taskId" = ANY($2)`,
        [testStaff1Id, [multiTask1Id, multiTask2Id]]
      );

      expect(result.rows).toHaveLength(0);
    });
  });

  describe('Access Control After Removal', () => {
    it('should not include removed user in collaborators list', async () => {
      // Remove a collaborator
      await projectService.removeProjectCollaborator(
        testProjectId,
        testStaff1Id,
        {
          userId: testManagerId,
          departmentId: testDeptId,
          role: 'MANAGER',
        }
      );

      // Check collaborators list
      const collaborators = await projectService.getProjectCollaborators(
        testProjectId,
        {
          userId: testManagerId,
          departmentId: testDeptId,
          role: 'MANAGER',
        }
      );

      expect(collaborators.map(c => c.id)).not.toContain(testStaff1Id);

      // Restore for other tests
      const taskId = createdTaskIds[0];
      await pgClient.query(
        `INSERT INTO public.task_assignment ("taskId", "userId", "assignedById", "createdAt")
         VALUES ($1, $2, $3, NOW())`,
        [taskId, testStaff1Id, testManagerId]
      );
    });

    it('should handle querying when user has no tasks in project', async () => {
      // User with no tasks should not appear in collaborators
      const collaborators = await projectService.getProjectCollaborators(
        testProjectId,
        {
          userId: testManagerId,
          departmentId: testDeptId,
          role: 'MANAGER',
        }
      );

      // testManager is not in the collaborators list initially (only assigned users)
      expect(collaborators.map(c => c.id)).not.toContain(testManagerId);
    });
  });
});
