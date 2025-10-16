/**
 * AuthorizationService
 *
 * Determines if a user can edit a task based on:
 * - Role (MANAGER/HR_ADMIN can edit all in their hierarchy)
 * - Assignment (STAFF can edit if assigned)
 */
export class AuthorizationService {
  /**
   * Determine if a user can edit a task
   * @param task - Task with assignments and departmentId
   * @param user - User with userId, role, and departmentId
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

    // STAFF: Can only edit tasks assigned to them
    if (user.role === 'STAFF') {
      return task.assignments.some(
        assignment => assignment.userId === user.userId
      );
    }

    // MANAGER or HR_ADMIN: Can edit all tasks in their hierarchy
    if (user.role === 'MANAGER' || user.role === 'HR_ADMIN') {
      return taskInHierarchy;
    }

    return false;
  }
}
