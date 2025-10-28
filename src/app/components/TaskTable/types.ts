export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  priorityBucket: number;
  dueDate: string;
  assignments: Array<{
    userId: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }>;
  departmentId: string;
  department: {
    id: string;
    name: string;
  };
  ownerId: string;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
  };
  projectId: string | null;
  project?: {
    id: string;
    name: string;
  } | null;
  parentTaskId: string | null;
  isRecurring: boolean;
  recurringInterval: number | null;
  isArchived: boolean;
  createdAt: string;
  startDate: string | null; // When work first began (set when status → IN_PROGRESS first time)
  updatedAt: string;
  tags: string[];
  comments: Array<{
    id: string;
    content: string;
    authorId: string;
    createdAt: string;
    updatedAt: string;
  }>;
  subtasks?: Task[]; // Subtasks for parent tasks
  hasSubtasks?: boolean; // Flag to indicate if task has subtasks
  involvedDepartments?: Array<{ id: string; name: string; isActive?: boolean }>; // Departments from assignees
  canEdit?: boolean; // Permission field from backend - optional for backward compatibility
}

export interface Filters {
  title: string;
  status: string[];
  assignee: string[];
  department: string[];
  project: string[];
  tags: string[];
}

export type SortableColumn =
  | 'title'
  | 'status'
  | 'priority'
  | 'dueDate'
  | 'assignees'
  | 'department'
  | 'project'
  | 'tags';

export interface SortCriterion {
  key: SortableColumn;
  direction: 'asc' | 'desc';
}

export interface TaskTableProps {
  tasks: Task[];
  title?: string;
  showCreateButton?: boolean;
  onCreateTask?: () => void;
  onTaskCreated?: () => void;
  onTaskUpdated?: () => void;
  userRole?: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
  emptyStateConfig?: {
    icon: string;
    title: string;
    description: string;
  };
  isLoading?: boolean;
  error?: Error | null;
}
