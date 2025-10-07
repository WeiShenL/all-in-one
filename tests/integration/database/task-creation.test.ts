/**
 * @jest-environment node
 *
 * Integration Tests for Task Creation - SCRUM-12
 *
 * Tests the complete task creation flow with real database operations
 *
 * Test Coverage:
 * - Test 1: Mandatory field validation and assignment limits (1-5 assignees)
 * - Test 2: Task creation and immediate dashboard display
 * - Subtask depth validation (TGO026 - max 2 levels)
 * - Priority validation (1-10 scale)
 * - Tag creation during task creation
 * - Recurring task creation
 * - Project association
 * - Automatic department association
 */

import { PrismaClient } from '@prisma/client';
import { TaskService } from '@/app/server/services/TaskService';
import { CreateTaskInput } from '@/app/server/types';

const prisma = new PrismaClient();
const taskService = new TaskService(prisma);

describe('Integration Tests - Task Creation (SCRUM-12)', () => {
  // Test data IDs
  let testDepartmentId: string;
  let testUserId: string;
  let testAssignee1Id: string;
  let testAssignee2Id: string;
  let testAssignee3Id: string;
  let testAssignee4Id: string;
  let testAssignee5Id: string;
  let testProjectId: string;

  // Track created tasks for cleanup
  const createdTaskIds: string[] = [];
  const createdTagIds: string[] = [];

  beforeAll(async () => {
    // Create test department
    const department = await prisma.department.create({
      data: {
        name: 'Test Engineering Dept',
        isActive: true,
      },
    });
    testDepartmentId = department.id;

    // Create test users
    const owner = await prisma.userProfile.create({
      data: {
        email: 'task-owner@test.com',
        name: 'Task Owner',
        role: 'STAFF',
        departmentId: testDepartmentId,
        isActive: true,
      },
    });
    testUserId = owner.id;

    // Create 5 assignees for testing max assignee limit
    const assignee1 = await prisma.userProfile.create({
      data: {
        email: 'assignee1@test.com',
        name: 'Assignee 1',
        role: 'STAFF',
        departmentId: testDepartmentId,
        isActive: true,
      },
    });
    testAssignee1Id = assignee1.id;

    const assignee2 = await prisma.userProfile.create({
      data: {
        email: 'assignee2@test.com',
        name: 'Assignee 2',
        role: 'STAFF',
        departmentId: testDepartmentId,
        isActive: true,
      },
    });
    testAssignee2Id = assignee2.id;

    const assignee3 = await prisma.userProfile.create({
      data: {
        email: 'assignee3@test.com',
        name: 'Assignee 3',
        role: 'STAFF',
        departmentId: testDepartmentId,
        isActive: true,
      },
    });
    testAssignee3Id = assignee3.id;

    const assignee4 = await prisma.userProfile.create({
      data: {
        email: 'assignee4@test.com',
        name: 'Assignee 4',
        role: 'STAFF',
        departmentId: testDepartmentId,
        isActive: true,
      },
    });
    testAssignee4Id = assignee4.id;

    const assignee5 = await prisma.userProfile.create({
      data: {
        email: 'assignee5@test.com',
        name: 'Assignee 5',
        role: 'STAFF',
        departmentId: testDepartmentId,
        isActive: true,
      },
    });
    testAssignee5Id = assignee5.id;

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        description: 'Integration test project',
        priority: 5,
        departmentId: testDepartmentId,
        creatorId: testUserId,
        status: 'ACTIVE',
      },
    });
    testProjectId = project.id;
  });

  afterAll(async () => {
    // Clean up in reverse order of dependencies
    // Delete task assignments
    await prisma.taskAssignment.deleteMany({
      where: {
        taskId: { in: createdTaskIds },
      },
    });

    // Delete task tags
    await prisma.taskTag.deleteMany({
      where: {
        taskId: { in: createdTaskIds },
      },
    });

    // Delete tasks
    await prisma.task.deleteMany({
      where: {
        id: { in: createdTaskIds },
      },
    });

    // Delete tags
    await prisma.tag.deleteMany({
      where: {
        id: { in: createdTagIds },
      },
    });

    // Delete test data
    await prisma.project.delete({ where: { id: testProjectId } });
    await prisma.userProfile.delete({ where: { id: testAssignee1Id } });
    await prisma.userProfile.delete({ where: { id: testAssignee2Id } });
    await prisma.userProfile.delete({ where: { id: testAssignee3Id } });
    await prisma.userProfile.delete({ where: { id: testAssignee4Id } });
    await prisma.userProfile.delete({ where: { id: testAssignee5Id } });
    await prisma.userProfile.delete({ where: { id: testUserId } });
    await prisma.department.delete({ where: { id: testDepartmentId } });

    await prisma.$disconnect();
  });

  describe('Test 1: Mandatory Fields and Assignment Limits', () => {
    it('should create task with all mandatory fields', async () => {
      const input: CreateTaskInput = {
        title: 'Implement Login Feature',
        description: 'Create login functionality with email and password',
        priority: 8,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
      };

      const task = await taskService.create(input);
      createdTaskIds.push(task!.id);

      expect(task).toBeDefined();
      expect(task!.title).toBe('Implement Login Feature');
      expect(task!.description).toBe(
        'Create login functionality with email and password'
      );
      expect(task!.priority).toBe(8);
      expect(task!.status).toBe('TO_DO'); // Default status
      expect(task!.ownerId).toBe(testUserId);
      expect(task!.departmentId).toBe(testDepartmentId);

      // Verify assignment created
      const assignments = await prisma.taskAssignment.findMany({
        where: { taskId: task!.id },
      });
      expect(assignments).toHaveLength(1);
      expect(assignments[0].userId).toBe(testAssignee1Id);
      expect(assignments[0].assignedById).toBe(testUserId);
    });

    it('should accept minimum 1 assignee', async () => {
      const input: CreateTaskInput = {
        title: 'Task with 1 assignee',
        description: 'Testing minimum assignees',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
      };

      const task = await taskService.create(input);
      createdTaskIds.push(task!.id);

      const assignments = await prisma.taskAssignment.findMany({
        where: { taskId: task!.id },
      });
      expect(assignments).toHaveLength(1);
    });

    it('should accept maximum 5 assignees', async () => {
      const input: CreateTaskInput = {
        title: 'Task with 5 assignees',
        description: 'Testing maximum assignees',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [
          testAssignee1Id,
          testAssignee2Id,
          testAssignee3Id,
          testAssignee4Id,
          testAssignee5Id,
        ],
      };

      const task = await taskService.create(input);
      createdTaskIds.push(task!.id);

      const assignments = await prisma.taskAssignment.findMany({
        where: { taskId: task!.id },
      });
      expect(assignments).toHaveLength(5);

      const assignedUserIds = assignments.map(a => a.userId).sort();
      expect(assignedUserIds).toEqual(
        [
          testAssignee1Id,
          testAssignee2Id,
          testAssignee3Id,
          testAssignee4Id,
          testAssignee5Id,
        ].sort()
      );
    });

    it('should validate priority range (1-10)', async () => {
      // Test priority 1 (minimum)
      const input1: CreateTaskInput = {
        title: 'Low priority task',
        description: 'Testing priority 1',
        priority: 1,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
      };

      const task1 = await taskService.create(input1);
      createdTaskIds.push(task1!.id);
      expect(task1!.priority).toBe(1);

      // Test priority 10 (maximum)
      const input2: CreateTaskInput = {
        title: 'High priority task',
        description: 'Testing priority 10',
        priority: 10,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
      };

      const task2 = await taskService.create(input2);
      createdTaskIds.push(task2!.id);
      expect(task2!.priority).toBe(10);
    });

    it('should default priority to 5 when not provided', async () => {
      const input: CreateTaskInput = {
        title: 'Task without priority',
        description: 'Testing default priority',
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
      };

      const task = await taskService.create(input);
      createdTaskIds.push(task!.id);
      expect(task!.priority).toBe(5);
    });
  });

  describe('Test 2: Task Creation and Dashboard Display', () => {
    it("should create task and immediately appear in owner's tasks", async () => {
      const input: CreateTaskInput = {
        title: 'Dashboard Test Task',
        description: 'This should appear immediately',
        priority: 7,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
      };

      const createdTask = await taskService.create(input);
      createdTaskIds.push(createdTask!.id);

      // Fetch tasks for owner (simulating dashboard display)
      const ownerTasks = await taskService.getByOwner(testUserId);

      expect(ownerTasks).toBeDefined();
      expect(Array.isArray(ownerTasks)).toBe(true);

      const task = ownerTasks!.find(t => t.id === createdTask!.id);
      expect(task).toBeDefined();
      expect(task!.title).toBe('Dashboard Test Task');
    });

    it("should appear in assignee's tasks immediately", async () => {
      const input: CreateTaskInput = {
        title: 'Assignee Dashboard Task',
        description: 'This should appear in assignee dashboard',
        priority: 6,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id, testAssignee2Id],
      };

      const createdTask = await taskService.create(input);
      createdTaskIds.push(createdTask!.id);

      // Fetch tasks for assignee1 (simulating their dashboard)
      const assigneeTasks = await taskService.getByAssignee(testAssignee1Id);

      expect(assigneeTasks).toBeDefined();
      const task = assigneeTasks!.find(t => t.id === createdTask!.id);
      expect(task).toBeDefined();
      expect(task!.title).toBe('Assignee Dashboard Task');
    });

    it('should appear in department tasks immediately', async () => {
      const input: CreateTaskInput = {
        title: 'Department Task',
        description: 'This should appear in department view',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
      };

      const createdTask = await taskService.create(input);
      createdTaskIds.push(createdTask!.id);

      // Fetch department tasks
      const deptTasks = await taskService.getByDepartment(testDepartmentId);

      expect(deptTasks).toBeDefined();
      const task = deptTasks!.find(t => t.id === createdTask!.id);
      expect(task).toBeDefined();
    });
  });

  describe('Subtask Depth Validation (TGO026)', () => {
    it('should create subtask (level 1)', async () => {
      // Create parent task (level 0)
      const parentInput: CreateTaskInput = {
        title: 'Parent Task',
        description: 'Root level task',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
      };

      const parentTask = await taskService.create(parentInput);
      createdTaskIds.push(parentTask!.id);

      // Create subtask (level 1)
      const subtaskInput: CreateTaskInput = {
        title: 'Subtask Level 1',
        description: 'First level subtask',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
        parentTaskId: parentTask!.id,
      };

      const subtask = await taskService.create(subtaskInput);
      createdTaskIds.push(subtask!.id);

      expect(subtask).toBeDefined();
      expect(subtask!.parentTaskId).toBe(parentTask!.id);
    });

    it('should NOT allow creating level 3 subtask (exceeds maximum)', async () => {
      // Create level 0 task
      const level0Input: CreateTaskInput = {
        title: 'Level 0 Task',
        description: 'Root task',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
      };

      const level0Task = await taskService.create(level0Input);
      createdTaskIds.push(level0Task!.id);

      // Create level 1 subtask
      const level1Input: CreateTaskInput = {
        title: 'Level 1 Subtask',
        description: 'First level',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
        parentTaskId: level0Task!.id,
      };

      const level1Task = await taskService.create(level1Input);
      createdTaskIds.push(level1Task!.id);

      // Attempt to create level 2 subtask (should fail - TGO026)
      const level2Input: CreateTaskInput = {
        title: 'Level 2 Subtask',
        description: 'Third level - should fail',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
        parentTaskId: level1Task!.id,
      };

      await expect(taskService.create(level2Input)).rejects.toThrow(
        'Maximum subtask depth is 2 levels (TGO026)'
      );
    });
  });

  describe('Tag Creation During Task Creation', () => {
    it('should create new tags and link to task', async () => {
      const input: CreateTaskInput = {
        title: 'Task with Tags',
        description: 'Testing tag creation',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
        tags: ['urgent', 'frontend', 'bug-fix'],
      };

      const task = await taskService.create(input);
      createdTaskIds.push(task!.id);

      // Verify tags were created
      const taskWithTags = await prisma.task.findUnique({
        where: { id: task!.id },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });

      expect(taskWithTags!.tags).toHaveLength(3);
      const tagNames = taskWithTags!.tags.map(t => t.tag.name).sort();
      expect(tagNames).toEqual(['bug-fix', 'frontend', 'urgent']);

      // Store tag IDs for cleanup
      taskWithTags!.tags.forEach(t => createdTagIds.push(t.tag.id));
    });

    it('should reuse existing tags', async () => {
      // Create a tag first
      const existingTag = await prisma.tag.create({
        data: { name: 'existing-tag' },
      });
      createdTagIds.push(existingTag.id);

      const input: CreateTaskInput = {
        title: 'Task with Existing Tag',
        description: 'Testing tag reuse',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
        tags: ['existing-tag'],
      };

      const task = await taskService.create(input);
      createdTaskIds.push(task!.id);

      // Verify the existing tag was reused (not duplicated)
      const allTags = await prisma.tag.findMany({
        where: { name: 'existing-tag' },
      });
      expect(allTags).toHaveLength(1);
      expect(allTags[0].id).toBe(existingTag.id);
    });
  });

  describe('Recurring Tasks', () => {
    it('should create recurring task with interval', async () => {
      const input: CreateTaskInput = {
        title: 'Weekly Report',
        description: 'Submit weekly status report',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
        recurringInterval: 7, // Every 7 days
      };

      const task = await taskService.create(input);
      createdTaskIds.push(task!.id);

      expect(task!.recurringInterval).toBe(7);
    });

    it('should create non-recurring task when interval not provided', async () => {
      const input: CreateTaskInput = {
        title: 'One-time Task',
        description: 'Non-recurring task',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
      };

      const task = await taskService.create(input);
      createdTaskIds.push(task!.id);

      expect(task!.recurringInterval).toBeNull();
    });
  });

  describe('Project Association', () => {
    it('should create task within a project', async () => {
      const input: CreateTaskInput = {
        title: 'Project Task',
        description: 'Task within a project',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
        projectId: testProjectId,
      };

      const task = await taskService.create(input);
      createdTaskIds.push(task!.id);

      expect(task!.projectId).toBe(testProjectId);

      // Verify task appears in project tasks
      const projectTasks = await taskService.getByProject(testProjectId);
      const foundTask = projectTasks!.find(t => t.id === task!.id);
      expect(foundTask).toBeDefined();
    });

    it('should create standalone task without project', async () => {
      const input: CreateTaskInput = {
        title: 'Standalone Task',
        description: 'Task not associated with any project',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
      };

      const task = await taskService.create(input);
      createdTaskIds.push(task!.id);

      expect(task!.projectId).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when owner not found', async () => {
      const input: CreateTaskInput = {
        title: 'Task',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: '00000000-0000-0000-0000-000000000000',
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
      };

      await expect(taskService.create(input)).rejects.toThrow(
        'Owner not found or inactive'
      );
    });

    it('should throw error when department not found', async () => {
      const input: CreateTaskInput = {
        title: 'Task',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: '00000000-0000-0000-0000-000000000000',
        assigneeIds: [testAssignee1Id],
      };

      await expect(taskService.create(input)).rejects.toThrow(
        'Department not found'
      );
    });

    it('should throw error when assignee not found', async () => {
      const input: CreateTaskInput = {
        title: 'Task',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: ['00000000-0000-0000-0000-000000000000'],
      };

      await expect(taskService.create(input)).rejects.toThrow(
        'One or more assignees not found'
      );
    });

    it('should throw error when project not found', async () => {
      const input: CreateTaskInput = {
        title: 'Task',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testAssignee1Id],
        projectId: '00000000-0000-0000-0000-000000000000',
      };

      await expect(taskService.create(input)).rejects.toThrow(
        'Project not found'
      );
    });
  });
});
