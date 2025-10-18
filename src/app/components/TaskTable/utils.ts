import { Task, SortableColumn, SortCriterion } from './types';
import departmentData from '@/../prisma/data/1_departments.json';

export const defaultSortOrder: SortCriterion[] = [
  { key: 'dueDate', direction: 'asc' },
  { key: 'priority', direction: 'desc' },
  { key: 'status', direction: 'asc' },
  { key: 'title', direction: 'asc' },
];

export const statusSortOrder = {
  TO_DO: 1,
  IN_PROGRESS: 2,
  COMPLETED: 3,
  BLOCKED: 4,
};

export const departmentSortPaths = (() => {
  const deptMap = new Map(departmentData.map(d => [d.id, d]));
  const paths = new Map<string, string>();
  function getPath(deptId: string): string {
    if (paths.has(deptId)) {
      return paths.get(deptId)!;
    }
    const dept = deptMap.get(deptId);
    if (!dept) {
      return '';
    }
    const parentPath = dept.parentId ? getPath(dept.parentId) : '';
    const path = parentPath ? `${parentPath} > ${dept.name}` : dept.name;
    paths.set(deptId, path);
    return path;
  }
  departmentData.forEach(d => getPath(d.id));
  return paths;
})();

export const getSortableValue = (task: Task, key: SortableColumn) => {
  switch (key) {
    case 'title':
      return task.title.toLowerCase();
    case 'status':
      return statusSortOrder[task.status];
    case 'priority':
      return task.priorityBucket;
    case 'dueDate':
      return task.dueDate;
    case 'department':
      return departmentSortPaths.get(task.departmentId) || '';
    case 'assignees':
      const firstAssignment = task.assignments[0];
      return firstAssignment?.user?.name?.toLowerCase() || '';
    case 'project':
      return task.project?.name?.toLowerCase() || 'zzz_no_project'; // Sort empty projects to the end
    case 'tags':
      // Sort by first tag alphabetically, or empty string if no tags
      return task.tags && task.tags.length > 0
        ? task.tags[0].toLowerCase()
        : 'zzz_no_tags'; // Sort empty tags to the end
    default:
      return '';
  }
};

export const sortTasks = (tasks: Task[], criteria: SortCriterion[]) => {
  tasks.sort((a, b) => {
    for (const { key, direction } of criteria) {
      const valA = getSortableValue(a, key);
      const valB = getSortableValue(b, key);
      const comparison =
        typeof valA === 'string' && typeof valB === 'string'
          ? valA.localeCompare(valB)
          : valA < valB
            ? -1
            : valA > valB
              ? 1
              : 0;
      if (comparison !== 0) {
        return direction === 'asc' ? comparison : -comparison;
      }
    }
    return 0;
  });
};

// Organize tasks hierarchically (parent tasks with their subtasks)
export const organizeTasksHierarchically = (tasks: Task[]) => {
  const parentTasks = tasks.filter(task => !task.parentTaskId);
  const subtasks = tasks.filter(task => task.parentTaskId);

  // Group subtasks by parent ID
  const subtasksByParent = subtasks.reduce(
    (acc, subtask) => {
      const parentId = subtask.parentTaskId!;
      if (!acc[parentId]) {
        acc[parentId] = [];
      }
      acc[parentId].push(subtask);
      return acc;
    },
    {} as Record<string, Task[]>
  );

  // Add subtasks to parent tasks and mark which have subtasks
  return parentTasks.map(parent => ({
    ...parent,
    subtasks: subtasksByParent[parent.id] || [],
    hasSubtasks: (subtasksByParent[parent.id] || []).length > 0,
  }));
};
