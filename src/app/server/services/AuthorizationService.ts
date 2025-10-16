/**
 * AuthorizationService
 *
 * Determines if a user can edit a task based on:
 * - Role (MANAGER can edit all in their hierarchy)
 * - Role (HR_ADMIN legacy role can edit all in their hierarchy)
 * - Assignment (STAFF can edit if assigned, even if they have isHrAdmin flag)
 * - Note: isHrAdmin flag grants VIEW access to system-wide tasks but NOT edit access
 *   unless the STAFF member is also assigned to the task
 */
export class AuthorizationService {
  /**
   * Determine if a user can edit a task
   * @param task - Task with assignments and departmentId
   * @param user - User with userId, role, departmentId, and isHrAdmin flag
   * @param userDepartmentHierarchy - All department IDs the user manages or belongs to
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
    userDepartmentHierarchy: string[]
  ): boolean {
    // If the hierarchy is empty, deny access
    if (!userDepartmentHierarchy || userDepartmentHierarchy.length === 0) {
      return false;
    }

    // Check if task is in the user's department hierarchy
    const taskInHierarchy = userDepartmentHierarchy.includes(task.departmentId);

    if (!taskInHierarchy) {
      return false;
    }

    // Legacy HR_ADMIN role: Can edit all tasks in their hierarchy
    if (user.role === 'HR_ADMIN') {
      return taskInHierarchy;
    }

    // MANAGER: Can edit all tasks in their department hierarchy
    if (user.role === 'MANAGER') {
      return taskInHierarchy;
    }

    // STAFF with isHrAdmin: Can view all but can only edit if assigned
    // (HR Admin privilege is for viewing, not editing)
    if (user.role === 'STAFF') {
      return task.assignments.some(
        assignment => assignment.userId === user.userId
      );
    }

    return false;
  }
}
