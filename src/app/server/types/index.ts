/**
 * Shared TypeScript types for the server layer
 */

// Department Types
export interface DepartmentWithLevel {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
}

export interface CreateDepartmentInput {
  name: string;
  parentId?: string;
  managerId?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  parentId?: string | null;
  managerId?: string | null;
  isActive?: boolean;
}

// UserProfile Types
export interface CreateUserProfileInput {
  email: string;
  name: string;
  role?: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
  departmentId: string;
  isHrAdmin?: boolean;
}

export interface UpdateUserProfileInput {
  email?: string;
  name?: string;
  role?: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
  departmentId?: string;
  isActive?: boolean;
  isHrAdmin?: boolean;
}

// Team Types
export interface CreateTeamInput {
  name: string;
  description?: string;
  departmentId: string;
  leaderId?: string;
}

export interface UpdateTeamInput {
  name?: string;
  description?: string;
  departmentId?: string;
  leaderId?: string;
  isActive?: boolean;
}

// Project Types
export interface CreateProjectInput {
  name: string;
  description?: string;
  priority?: number; // 1-10 scale
  dueDate?: Date;
  departmentId: string;
  creatorId: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  priority?: number; // 1-10 scale
  dueDate?: Date;
  status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
  isArchived?: boolean;
}

export interface ProjectFilters {
  departmentId?: string;
  creatorId?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
  isArchived?: boolean;
}

// Task Types
export interface CreateTaskInput {
  title: string;
  description: string;
  priority?: number; // 1-10 scale
  dueDate: Date;
  ownerId: string;
  departmentId: string;
  projectId?: string;
  parentTaskId?: string;
  assigneeIds?: string[]; // Up to 5 assignees during creation
  tags?: string[]; // Optional tag names during creation
  recurringInterval?: number; // Interval in days for recurring tasks
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: number; // 1-10 scale
  dueDate?: Date;
  status?: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  isArchived?: boolean;
}

export interface TaskFilters {
  ownerId?: string;
  projectId?: string;
  departmentId?: string;
  status?: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  isArchived?: boolean;
  parentTaskId?: string;
}

// Comment Types
export interface CreateCommentInput {
  content: string;
  taskId: string;
  userId: string;
}

export interface UpdateCommentInput {
  content: string;
}

// Notification Types
export interface CreateNotificationInput {
  userId: string;
  type:
    | 'TASK_ASSIGNED'
    | 'TASK_UPDATED'
    | 'COMMENT_ADDED'
    | 'DEADLINE_REMINDER'
    | 'TASK_OVERDUE'
    | 'TASK_DELETED'
    | 'TASK_REASSIGNED';
  title: string;
  message: string;
  taskId?: string;
}

// Dashboard Types
export interface DashboardMetrics {
  toDo: number;
  inProgress: number;
  completed: number;
  blocked: number;
}

export interface DashboardData {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: number;
    dueDate: Date;
    status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
    ownerId: string;
    departmentId: string;
    assignments: Array<{
      user: {
        id: string;
        name: string;
        email: string;
      };
    }>;
    department: {
      id: string;
      name: string;
    };
  }>;
  metrics: DashboardMetrics;
}
