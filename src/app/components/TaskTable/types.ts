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
  ownerId: string;
  projectId: string | null;
  parentTaskId: string | null;
  isRecurring: boolean;
  recurringInterval: number | null;
  isArchived: boolean;
  createdAt: string;
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
  canEdit?: boolean; // Permission field from backend - optional for backward compatibility
}

export interface Filters {
  title: string;
  status: string;
  assignee: string;
  department: string;
}

export type SortableColumn =
  | 'title'
  | 'status'
  | 'priority'
  | 'dueDate'
  | 'assignees'
  | 'department';

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
  emptyStateConfig?: {
    icon: string;
    title: string;
    description: string;
  };
  isLoading?: boolean;
  error?: Error | null;
}
