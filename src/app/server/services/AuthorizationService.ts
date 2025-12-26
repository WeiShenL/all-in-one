/**
 * AuthorizationService
 *
 * Determines if a user can edit a task based on:
 * - Role (MANAGER can edit all in their hierarchy)
 * - Role (HR_ADMIN legacy role can edit all in their hierarchy)
 * - Assignment (STAFF can edit if assigned, even if they have isHrAdmin flag)
 * - Note: isHrAdmin flag grants VIEW access to company-wide tasks but NOT edit access
 *   unless the STAFF member is also assigned to the task
 */
export class AuthorizationService {
  /**
   * Determine if a user can edit a task
   * @param task - Task with assignments and departmentId
   * @param user - User with userId, role, departmentId, and isHrAdmin flag
   * @param userDepartmentHierarchy - All department IDs the user manages or belongs to
   * @param assigneeDepartmentIds - Optional array of department IDs of all assignees (for more accurate checks)
   * @returns true if user can edit the task
   */
  canEditTask(
    task: {
      assignments: Array<{ userId: string }>;
      departmentId: string;
    },
    user: {
      userId: string;
      role: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
      departmentId: string;
      isHrAdmin?: boolean;
    },
    userDepartmentHierarchy: string[],
    assigneeDepartmentIds?: string[]
  ): boolean {
    // If the hierarchy is empty, deny access
    if (!userDepartmentHierarchy || userDepartmentHierarchy.length === 0) {
      return false;
    }

    // Check if task is in the user's department hierarchy
    const taskInHierarchy = userDepartmentHierarchy.includes(task.departmentId);

    // Check if any assignee is from the user's department hierarchy
    const hasAssigneeInHierarchy = assigneeDepartmentIds
      ? assigneeDepartmentIds.some(deptId =>
          userDepartmentHierarchy.includes(deptId)
        )
      : false;

    // Legacy HR_ADMIN role: Can edit tasks where:
    // - Task's parent department is in hierarchy AND has assignees from hierarchy
    if (user.role === 'HR_ADMIN') {
      // If assignee departments are provided, require at least one assignee from hierarchy
      if (assigneeDepartmentIds) {
        return taskInHierarchy && hasAssigneeInHierarchy;
      }
      // Fallback to old behavior if assignee departments not provided
      return taskInHierarchy;
    }

    // MANAGER: Can edit tasks where:
    // - Task's department is in hierarchy, OR
    // - At least one assignee is from their hierarchy
    if (user.role === 'MANAGER') {
      // If assignee departments are provided, check both conditions
      if (assigneeDepartmentIds) {
        return taskInHierarchy || hasAssigneeInHierarchy;
      }
      // Fallback to old behavior if assignee departments not provided
      return taskInHierarchy;
    }

    // STAFF: Can edit ONLY if explicitly assigned to the task
    // This allows staff assigned to tasks in other departments to edit them
    // but DENIES edit access to all other tasks, even in their own department
    if (user.role === 'STAFF') {
      // Defensive check: ensure assignments is a valid array
      if (!Array.isArray(task.assignments)) {
        console.warn('[AuthService] Invalid assignments array for STAFF check');
        return false;
      }

      // Check if user ID exists in task assignments
      const canEdit = task.assignments.some(assignment => {
        // Strict equality check with type validation
        return (
          assignment && assignment.userId && assignment.userId === user.userId
        );
      });

      return canEdit;
    }

    return false;
  }
}
