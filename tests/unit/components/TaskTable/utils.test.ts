/**
 * Unit Tests for TaskTable/utils
 * Tests sorting, filtering, and hierarchical organization of tasks
 */

import {
  defaultSortOrder,
  statusSortOrder,
  getSortableValue,
  sortTasks,
  organizeTasksHierarchically,
} from '../../../../src/app/components/TaskTable/utils';
import {
  Task,
  SortCriterion,
} from '../../../../src/app/components/TaskTable/types';

describe('TaskTable utils', () => {
  describe('defaultSortOrder', () => {
    it('should have correct default sort criteria', () => {
      expect(defaultSortOrder).toEqual([
        { key: 'dueDate', direction: 'asc' },
        { key: 'priority', direction: 'desc' },
        { key: 'status', direction: 'asc' },
        { key: 'title', direction: 'asc' },
      ]);
    });
  });

  describe('statusSortOrder', () => {
    it('should define correct status order', () => {
      expect(statusSortOrder.TO_DO).toBe(1);
      expect(statusSortOrder.IN_PROGRESS).toBe(2);
      expect(statusSortOrder.COMPLETED).toBe(3);
      expect(statusSortOrder.BLOCKED).toBe(4);
    });
  });

  describe('getSortableValue', () => {
    const baseTask: Task = {
      id: 'task-1',
      title: 'Test Task',
      description: 'Description',
      status: 'TO_DO',
      priorityBucket: 5,
      dueDate: '2025-12-31',
      departmentId: 'dept-1',
      department: { id: 'dept-1', name: 'Department 1' },
      ownerId: 'owner-1',
      owner: { id: 'owner-1', name: 'Owner', email: 'owner@example.com' },
      projectId: null,
      parentTaskId: null,
      isRecurring: false,
      recurringInterval: null,
      isArchived: false,
      assignments: [],
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startDate: null,
      comments: [],
    };

    it('should get sortable value for title', () => {
      const result = getSortableValue(baseTask, 'title');
      expect(result).toBe('test task');
    });

    it('should get sortable value for status', () => {
      const result = getSortableValue(baseTask, 'status');
      expect(result).toBe(1); // TO_DO = 1
    });

    it('should get sortable value for priority', () => {
      const result = getSortableValue(baseTask, 'priority');
      expect(result).toBe(5);
    });

    it('should get sortable value for dueDate', () => {
      const result = getSortableValue(baseTask, 'dueDate');
      expect(result).toEqual('2025-12-31');
    });

    it('should get sortable value for department', () => {
      const result = getSortableValue(baseTask, 'department');
      expect(typeof result).toBe('string');
    });

    it('should get sortable value for assignees with assignment', () => {
      const taskWithAssignee = {
        ...baseTask,
        assignments: [
          {
            userId: 'user-1',
            user: { name: 'John Doe' },
          },
        ],
      } as Task;

      const result = getSortableValue(taskWithAssignee, 'assignees');
      expect(result).toBe('john doe');
    });

    it('should get sortable value for assignees without assignment', () => {
      const result = getSortableValue(baseTask, 'assignees');
      expect(result).toBe('');
    });

    it('should get sortable value for project with project', () => {
      const taskWithProject = {
        ...baseTask,
        project: { name: 'My Project' },
      } as Task;

      const result = getSortableValue(taskWithProject, 'project');
      expect(result).toBe('my project');
    });

    it('should get sortable value for project without project', () => {
      const result = getSortableValue(baseTask, 'project');
      expect(result).toBe('zzz_no_project');
    });

    it('should get sortable value for tags with tags', () => {
      const taskWithTags = {
        ...baseTask,
        tags: ['urgent', 'backend'],
      } as Task;

      const result = getSortableValue(taskWithTags, 'tags');
      expect(result).toBe('urgent');
    });

    it('should get sortable value for tags without tags', () => {
      const taskWithEmptyTags = {
        ...baseTask,
        tags: [],
      } as Task;

      const result = getSortableValue(taskWithEmptyTags, 'tags');
      expect(result).toBe('zzz_no_tags');
    });

    it('should handle undefined tags', () => {
      const taskWithUndefinedTags = {
        ...baseTask,
        tags: undefined,
      } as unknown as Task;

      const result = getSortableValue(taskWithUndefinedTags, 'tags');
      expect(result).toBe('zzz_no_tags');
    });

    it('should return empty string for unknown column', () => {
      const result = getSortableValue(baseTask, 'unknown' as any);
      expect(result).toBe('');
    });
  });

  describe('sortTasks', () => {
    const createTask = (overrides: Partial<Task>): Task =>
      ({
        id: 'task-1',
        title: 'Task',
        description: '',
        status: 'TO_DO',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        departmentId: 'dept-1',
        assignments: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      }) as Task;

    it('should sort by title ascending', () => {
      const tasks = [
        createTask({ id: '1', title: 'Zebra' }),
        createTask({ id: '2', title: 'Apple' }),
        createTask({ id: '3', title: 'Mango' }),
      ];

      const criteria: SortCriterion[] = [{ key: 'title', direction: 'asc' }];
      sortTasks(tasks, criteria);

      expect(tasks[0].title).toBe('Apple');
      expect(tasks[1].title).toBe('Mango');
      expect(tasks[2].title).toBe('Zebra');
    });

    it('should sort by title descending', () => {
      const tasks = [
        createTask({ id: '1', title: 'Apple' }),
        createTask({ id: '2', title: 'Zebra' }),
        createTask({ id: '3', title: 'Mango' }),
      ];

      const criteria: SortCriterion[] = [{ key: 'title', direction: 'desc' }];
      sortTasks(tasks, criteria);

      expect(tasks[0].title).toBe('Zebra');
      expect(tasks[1].title).toBe('Mango');
      expect(tasks[2].title).toBe('Apple');
    });

    it('should sort by priority descending', () => {
      const tasks = [
        createTask({ id: '1', priorityBucket: 3 }),
        createTask({ id: '2', priorityBucket: 8 }),
        createTask({ id: '3', priorityBucket: 5 }),
      ];

      const criteria: SortCriterion[] = [
        { key: 'priority', direction: 'desc' },
      ];
      sortTasks(tasks, criteria);

      expect(tasks[0].priorityBucket).toBe(8);
      expect(tasks[1].priorityBucket).toBe(5);
      expect(tasks[2].priorityBucket).toBe(3);
    });

    it('should sort by status ascending', () => {
      const tasks = [
        createTask({ id: '1', status: 'COMPLETED' }),
        createTask({ id: '2', status: 'TO_DO' }),
        createTask({ id: '3', status: 'IN_PROGRESS' }),
      ];

      const criteria: SortCriterion[] = [{ key: 'status', direction: 'asc' }];
      sortTasks(tasks, criteria);

      expect(tasks[0].status).toBe('TO_DO');
      expect(tasks[1].status).toBe('IN_PROGRESS');
      expect(tasks[2].status).toBe('COMPLETED');
    });

    it('should sort by due date ascending', () => {
      const tasks = [
        createTask({ id: '1', dueDate: '2025-12-31' }),
        createTask({ id: '2', dueDate: '2025-01-01' }),
        createTask({ id: '3', dueDate: '2025-06-15' }),
      ];

      const criteria: SortCriterion[] = [{ key: 'dueDate', direction: 'asc' }];
      sortTasks(tasks, criteria);

      expect(tasks[0].id).toBe('2');
      expect(tasks[1].id).toBe('3');
      expect(tasks[2].id).toBe('1');
    });

    it('should sort by multiple criteria', () => {
      const tasks = [
        createTask({ id: '1', status: 'TO_DO', priorityBucket: 3 }),
        createTask({ id: '2', status: 'TO_DO', priorityBucket: 8 }),
        createTask({ id: '3', status: 'IN_PROGRESS', priorityBucket: 5 }),
      ];

      const criteria: SortCriterion[] = [
        { key: 'status', direction: 'asc' },
        { key: 'priority', direction: 'desc' },
      ];
      sortTasks(tasks, criteria);

      // First by status (TO_DO comes first), then by priority (8 > 3)
      expect(tasks[0].id).toBe('2'); // TO_DO, priority 8
      expect(tasks[1].id).toBe('1'); // TO_DO, priority 3
      expect(tasks[2].id).toBe('3'); // IN_PROGRESS
    });

    it('should handle empty task array', () => {
      const tasks: Task[] = [];
      const criteria: SortCriterion[] = [{ key: 'title', direction: 'asc' }];

      expect(() => sortTasks(tasks, criteria)).not.toThrow();
      expect(tasks).toHaveLength(0);
    });

    it('should handle single task', () => {
      const tasks = [createTask({ id: '1', title: 'Only Task' })];
      const criteria: SortCriterion[] = [{ key: 'title', direction: 'asc' }];

      sortTasks(tasks, criteria);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Only Task');
    });
  });

  describe('organizeTasksHierarchically', () => {
    const createTask = (overrides: Partial<Task>): Task =>
      ({
        id: 'task-1',
        title: 'Task',
        description: '',
        status: 'TO_DO',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        departmentId: 'dept-1',
        assignments: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        parentTaskId: null,
        ...overrides,
      }) as Task;

    it('should organize tasks with parent and subtasks', () => {
      const tasks = [
        createTask({ id: 'parent-1', title: 'Parent Task' }),
        createTask({
          id: 'subtask-1',
          title: 'Subtask 1',
          parentTaskId: 'parent-1',
        }),
        createTask({
          id: 'subtask-2',
          title: 'Subtask 2',
          parentTaskId: 'parent-1',
        }),
      ];

      const result = organizeTasksHierarchically(tasks);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('parent-1');
      expect(result[0].subtasks).toHaveLength(2);
      expect(result[0].hasSubtasks).toBe(true);
    });

    it('should handle tasks without subtasks', () => {
      const tasks = [
        createTask({ id: 'task-1', title: 'Task 1' }),
        createTask({ id: 'task-2', title: 'Task 2' }),
      ];

      const result = organizeTasksHierarchically(tasks);

      expect(result).toHaveLength(2);
      expect(result[0].subtasks).toHaveLength(0);
      expect(result[0].hasSubtasks).toBe(false);
      expect(result[1].subtasks).toHaveLength(0);
      expect(result[1].hasSubtasks).toBe(false);
    });

    it('should handle multiple parents with subtasks', () => {
      const tasks = [
        createTask({ id: 'parent-1', title: 'Parent 1' }),
        createTask({ id: 'parent-2', title: 'Parent 2' }),
        createTask({
          id: 'subtask-1',
          title: 'Subtask 1',
          parentTaskId: 'parent-1',
        }),
        createTask({
          id: 'subtask-2',
          title: 'Subtask 2',
          parentTaskId: 'parent-2',
        }),
      ];

      const result = organizeTasksHierarchically(tasks);

      expect(result).toHaveLength(2);
      expect(result[0].subtasks).toHaveLength(1);
      expect(result[0].subtasks[0].id).toBe('subtask-1');
      expect(result[1].subtasks).toHaveLength(1);
      expect(result[1].subtasks[0].id).toBe('subtask-2');
    });

    it('should handle empty task array', () => {
      const tasks: Task[] = [];

      const result = organizeTasksHierarchically(tasks);

      expect(result).toHaveLength(0);
    });

    it('should handle only subtasks (orphaned)', () => {
      const tasks = [
        createTask({
          id: 'subtask-1',
          title: 'Orphan Subtask',
          parentTaskId: 'missing-parent',
        }),
      ];

      const result = organizeTasksHierarchically(tasks);

      expect(result).toHaveLength(0);
    });

    it('should handle multiple subtasks per parent', () => {
      const tasks = [
        createTask({ id: 'parent-1', title: 'Parent' }),
        createTask({ id: 'sub-1', title: 'Sub 1', parentTaskId: 'parent-1' }),
        createTask({ id: 'sub-2', title: 'Sub 2', parentTaskId: 'parent-1' }),
        createTask({ id: 'sub-3', title: 'Sub 3', parentTaskId: 'parent-1' }),
      ];

      const result = organizeTasksHierarchically(tasks);

      expect(result).toHaveLength(1);
      expect(result[0].subtasks).toHaveLength(3);
      expect(result[0].hasSubtasks).toBe(true);
    });
  });
});
