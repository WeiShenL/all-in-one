/**
 * SubtaskService
 *
 * Handles subtask creation with specific constraints
 * Extends TaskService functionality with subtask-specific validation
 *
 * Responsibilities:
 * - Validate 2-level hierarchy (Task → Subtask only, no sub-subtasks)
 * - Validate creator is assigned to parent task
 * - Inherit department/project from parent task
 * - Enforce subtasks cannot be recurring
 * - Validate subtask deadline <= parent deadline
 */

import { TaskService, UserContext } from '@/services/task/TaskService';
import { ITaskRepository } from '@/repositories/ITaskRepository';
import { Task, TaskStatus } from '@/domain/task/Task';

export class SubtaskService extends TaskService {
  constructor(taskRepository: ITaskRepository) {
    super(taskRepository);
  }

  /**
   * Create a subtask under an existing task
   *
   * Acceptance Criteria (SCRUM-65):
   * - Staff can create subtasks under tasks they are assigned to
   * - 2 levels maximum: Task → Subtask (no sub-subtasks)
   * - Mandatory fields: title, description, priority, deadline, assignee(s)
   * - Subtasks cannot be recurring
   * - Subtasks inherit department and project from parent
   * - Subtask deadline must be <= parent deadline
   *
   * @param data - Subtask creation data
   * @param creator - User creating the subtask
   * @returns Created subtask ID
   */
  async createSubtask(
    data: {
      title: string;
      description: string;
      priority: number;
      dueDate: Date;
      assigneeIds: string[];
      parentTaskId: string; // REQUIRED for subtasks
      tags?: string[];
      recurringInterval?: number; // Will be rejected if provided
    },
    creator: UserContext
  ): Promise<{ id: string }> {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: SUBTASK-SPECIFIC VALIDATIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // 1. Validate parentTaskId is provided
    if (!data.parentTaskId) {
      throw new Error('Parent task ID is required for subtasks');
    }

    // 2. Reject if recurringInterval is set (subtasks cannot be recurring)
    if (
      data.recurringInterval !== undefined &&
      data.recurringInterval !== null
    ) {
      throw new Error('Subtasks cannot be set as recurring');
    }

    // 3. Fetch parent task (validates it exists)
    const parentTask = await this.taskRepository.getTaskByIdFull(
      data.parentTaskId
    );
    if (!parentTask) {
      throw new Error('Parent task not found');
    }

    // 4. Validate 2-level maximum: parent must NOT have a parent (no sub-subtasks)
    if (parentTask.parentTaskId !== null) {
      throw new Error(
        'Cannot create subtask under another subtask. Maximum depth is 2 levels (Task → Subtask)'
      );
    }

    // 5. Validate creator is assigned to parent task
    const isAssignedToParent = parentTask.assignments.some(
      (assignment: any) => assignment.userId === creator.userId
    );
    if (!isAssignedToParent) {
      throw new Error(
        'You must be assigned to the parent task to create subtasks'
      );
    }

    // 6. Validate subtask deadline <= parent deadline
    if (data.dueDate.getTime() > parentTask.dueDate.getTime()) {
      throw new Error('Subtask deadline cannot be after parent task deadline');
    }

    // 7. Validate assignees exist and are active (via repository)
    if (data.assigneeIds && data.assigneeIds.length > 0) {
      const validAssignees = await this.taskRepository.validateAssignees(
        data.assigneeIds
      );
      if (!validAssignees.allExist) {
        throw new Error('One or more assignees not found');
      }
      if (!validAssignees.allActive) {
        throw new Error('One or more assignees are inactive');
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: INHERIT FROM PARENT & USE DOMAIN
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Use Task domain factory with inherited values
    const task = Task.create({
      title: data.title,
      description: data.description,
      priorityBucket: data.priority,
      dueDate: data.dueDate,
      status: TaskStatus.TO_DO,
      ownerId: creator.userId,
      departmentId: parentTask.departmentId, // INHERITED from parent
      projectId: parentTask.projectId, // INHERITED from parent
      parentTaskId: data.parentTaskId, // REQUIRED for subtasks
      recurringInterval: null, // ENFORCED: subtasks cannot be recurring
      isArchived: false,
      assignments: new Set(data.assigneeIds),
      tags: new Set(data.tags || []),
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: PERSIST VIA REPOSITORY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const result = await this.taskRepository.createTask({
      id: task.getId(),
      title: task.getTitle(),
      description: task.getDescription(),
      priority: task.getPriorityBucket(),
      dueDate: task.getDueDate(),
      ownerId: creator.userId,
      departmentId: task.getDepartmentId(),
      projectId: task.getProjectId() ?? undefined,
      parentTaskId: task.getParentTaskId() ?? undefined,
      assigneeIds: data.assigneeIds,
      tags: data.tags,
      recurringInterval: undefined, // Always null for subtasks
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: LOG ACTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    await this.taskRepository.logTaskAction(
      result.id,
      creator.userId,
      'CREATED',
      {
        title: data.title,
        parentTaskId: data.parentTaskId,
        assigneeCount: data.assigneeIds.length,
      }
    );

    return result;
  }
}

// Re-export UserContext for convenience
export type { UserContext } from '@/services/task/TaskService';
