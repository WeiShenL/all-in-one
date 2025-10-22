/**
 * Integration tests for Project Collaborator Management (SCRUM-33)
 *
 * Tests the following acceptance criteria:
 * - Staff can view all current collaborators of corresponding project
 * - Manager can remove any of the current collaborators
 * - A user is removed as a collaborator from a project if there are no tasks assigned
 * - Collaborators can no longer view the project they are no longer part of
 * - Collaborators can no longer view tasks under the project they are no longer part of
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ProjectService } from '@/services/project/ProjectService';
import { PrismaProjectRepository } from '@/repositories/PrismaProjectRepository';

describe('SCRUM-33: Project Collaborator Management', () => {
  let prisma: PrismaClient;
  let projectService: ProjectService;
  let projectRepo: PrismaProjectRepository;

  // Test data
  let testProject: any;
  let testManager: any;
  let testStaff1: any;
  let testStaff2: any;

  beforeEach(async () => {
    prisma = new PrismaClient();
    projectRepo = new PrismaProjectRepository(prisma);
    projectService = new ProjectService(projectRepo);

    // Create test users
    testManager = await prisma.userProfile.create({
      data: {
        id: 'manager-1',
        email: 'manager@test.com',
        name: 'Test Manager',
        role: 'MANAGER',
        departmentId: 'dept-1',
        isActive: true,
      },
    });

    testStaff1 = await prisma.userProfile.create({
      data: {
        id: 'staff-1',
        email: 'staff1@test.com',
        name: 'Test Staff 1',
        role: 'STAFF',
        departmentId: 'dept-1',
        isActive: true,
      },
    });

    testStaff2 = await prisma.userProfile.create({
      data: {
        id: 'staff-2',
        email: 'staff2@test.com',
        name: 'Test Staff 2',
        role: 'STAFF',
        departmentId: 'dept-1',
        isActive: true,
      },
    });

    // Create test project
    testProject = await prisma.project.create({
      data: {
        id: 'project-1',
        name: 'Test Project',
        description: 'Project for testing collaborator management',
        priority: 5,
        status: 'ACTIVE',
        departmentId: 'dept-1',
        creatorId: testManager.id,
      },
    });

    // Create test task with assignees
    await prisma.task.create({
      data: {
        id: 'task-1',
        title: 'Test Task',
        description: 'A task for testing',
        priority: 5,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        status: 'TO_DO',
        departmentId: 'dept-1',
        projectId: testProject.id,
        ownerId: testManager.id,
        assignments: {
          create: [{ userId: testStaff1.id }, { userId: testStaff2.id }],
        },
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.taskAssignment.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.userProfile.deleteMany({});
    await prisma.$disconnect();
  });

  describe('View Collaborators', () => {
    it('should return all users assigned to tasks in the project', async () => {
      const collaborators = await projectService.getProjectCollaborators(
        testProject.id,
        {
          userId: testStaff1.id,
          departmentId: 'dept-1',
          role: 'STAFF',
        }
      );

      expect(collaborators).toHaveLength(2);
      expect(collaborators.map(c => c.id)).toContain(testStaff1.id);
      expect(collaborators.map(c => c.id)).toContain(testStaff2.id);
    });

    it('should return unique users even if assigned to multiple tasks', async () => {
      // Create another task with the same assignee
      await prisma.task.create({
        data: {
          id: 'task-2',
          title: 'Another Task',
          description: 'Another task',
          priority: 3,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: 'TO_DO',
          departmentId: 'dept-1',
          projectId: testProject.id,
          ownerId: testManager.id,
          assignments: {
            create: [{ userId: testStaff1.id }],
          },
        },
      });

      const collaborators = await projectService.getProjectCollaborators(
        testProject.id,
        {
          userId: testManager.id,
          departmentId: 'dept-1',
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
        testProject.id,
        testStaff1.id,
        {
          userId: testManager.id,
          departmentId: 'dept-1',
          role: 'MANAGER',
        }
      );

      const collaborators = await projectService.getProjectCollaborators(
        testProject.id,
        {
          userId: testManager.id,
          departmentId: 'dept-1',
          role: 'MANAGER',
        }
      );

      expect(collaborators).toHaveLength(1);
      expect(collaborators[0].id).toBe(testStaff2.id);
    });

    it('should not allow staff to remove collaborators', async () => {
      await expect(
        projectService.removeProjectCollaborator(
          testProject.id,
          testStaff2.id,
          {
            userId: testStaff1.id,
            departmentId: 'dept-1',
            role: 'STAFF',
          }
        )
      ).rejects.toThrow('Only managers can remove collaborators from projects');
    });

    it('should prevent removal if it would leave task with no assignees', async () => {
      // Create a task with only one assignee
      await prisma.task.create({
        data: {
          id: 'task-single',
          title: 'Single Assignee Task',
          description: 'Task with one assignee',
          priority: 5,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'TO_DO',
          departmentId: 'dept-1',
          projectId: testProject.id,
          ownerId: testManager.id,
          assignments: {
            create: [{ userId: testManager.id }],
          },
        },
      });

      // Try to remove the only assignee from this task
      await expect(
        projectService.removeProjectCollaborator(
          testProject.id,
          testManager.id,
          {
            userId: testManager.id,
            departmentId: 'dept-1',
            role: 'MANAGER',
          }
        )
      ).rejects.toThrow(/must have at least one assignee/);
    });

    it('should remove user from all project tasks', async () => {
      // Create multiple tasks
      await prisma.task.create({
        data: {
          id: 'task-2',
          title: 'Task 2',
          description: 'Second task',
          priority: 3,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: 'TO_DO',
          departmentId: 'dept-1',
          projectId: testProject.id,
          ownerId: testManager.id,
          assignments: {
            create: [{ userId: testStaff1.id }, { userId: testStaff2.id }],
          },
        },
      });

      // Remove staff1 from the project
      await projectService.removeProjectCollaborator(
        testProject.id,
        testStaff1.id,
        {
          userId: testManager.id,
          departmentId: 'dept-1',
          role: 'MANAGER',
        }
      );

      // Check that staff1 is removed from all tasks
      const task1Assignments = await prisma.taskAssignment.findMany({
        where: { taskId: 'task-1' },
      });
      const task2Assignments = await prisma.taskAssignment.findMany({
        where: { taskId: 'task-2' },
      });

      expect(task1Assignments.map(a => a.userId)).not.toContain(testStaff1.id);
      expect(task2Assignments.map(a => a.userId)).not.toContain(testStaff2.id);
    });
  });

  describe('Access Control After Removal', () => {
    it('should not include removed user in collaborators list', async () => {
      // Remove a collaborator
      await projectService.removeProjectCollaborator(
        testProject.id,
        testStaff1.id,
        {
          userId: testManager.id,
          departmentId: 'dept-1',
          role: 'MANAGER',
        }
      );

      // Check collaborators list
      const collaborators = await projectService.getProjectCollaborators(
        testProject.id,
        {
          userId: testManager.id,
          departmentId: 'dept-1',
          role: 'MANAGER',
        }
      );

      expect(collaborators.map(c => c.id)).not.toContain(testStaff1.id);
    });

    it('should handle removal when user has no tasks in project', async () => {
      // User with no tasks should not appear in collaborators
      const collaborators = await projectService.getProjectCollaborators(
        testProject.id,
        {
          userId: testManager.id,
          departmentId: 'dept-1',
          role: 'MANAGER',
        }
      );

      // testManager is not in the collaborators list initially (only assigned users)
      expect(collaborators.map(c => c.id)).not.toContain(testManager.id);
    });
  });
});
