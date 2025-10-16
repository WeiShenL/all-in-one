import { AuthorizationService } from '../../src/app/server/services/AuthorizationService';

describe('AuthorizationService', () => {
  let authService: AuthorizationService;

  beforeEach(() => {
    authService = new AuthorizationService();
  });

  describe('canEditTask', () => {
    const mockTask = {
      id: 'task-123',
      departmentId: 'dept-sales',
      assignments: [{ userId: 'user-alice' }, { userId: 'user-bob' }],
    };

    describe('STAFF role', () => {
      it('should allow STAFF to edit tasks assigned to them', () => {
        const user = {
          userId: 'user-alice',
          role: 'STAFF' as const,
          departmentId: 'dept-sales',
        };
        const hierarchy = ['dept-sales'];

        const result = authService.canEditTask(mockTask, user, hierarchy);

        expect(result).toBe(true);
      });

      it('should deny STAFF editing tasks NOT assigned to them', () => {
        const user = {
          userId: 'user-charlie',
          role: 'STAFF' as const,
          departmentId: 'dept-sales',
        };
        const hierarchy = ['dept-sales'];

        const result = authService.canEditTask(mockTask, user, hierarchy);

        expect(result).toBe(false);
      });

      it('should deny STAFF editing tasks in same department but not assigned', () => {
        const user = {
          userId: 'user-dave',
          role: 'STAFF' as const,
          departmentId: 'dept-sales',
        };
        const hierarchy = ['dept-sales'];

        const result = authService.canEditTask(mockTask, user, hierarchy);

        expect(result).toBe(false);
      });

      it('should deny STAFF editing tasks outside their department', () => {
        const user = {
          userId: 'user-eve',
          role: 'STAFF' as const,
          departmentId: 'dept-hr',
        };
        const hierarchy = ['dept-hr'];

        const result = authService.canEditTask(mockTask, user, hierarchy);

        expect(result).toBe(false);
      });
    });

    describe('MANAGER role', () => {
      it('should allow MANAGER to edit ALL tasks in their department', () => {
        const user = {
          userId: 'manager-john',
          role: 'MANAGER' as const,
          departmentId: 'dept-sales',
        };
        const hierarchy = ['dept-sales'];

        const result = authService.canEditTask(mockTask, user, hierarchy);

        expect(result).toBe(true);
      });

      it('should allow MANAGER to edit tasks in subordinate departments', () => {
        const taskInSubDept = {
          id: 'task-456',
          departmentId: 'dept-sales-regional',
          assignments: [{ userId: 'user-alice' }],
        };

        const user = {
          userId: 'manager-john',
          role: 'MANAGER' as const,
          departmentId: 'dept-sales',
        };
        // Hierarchy includes parent and all subordinate departments
        const hierarchy = [
          'dept-sales',
          'dept-sales-regional',
          'dept-sales-local',
        ];

        const result = authService.canEditTask(taskInSubDept, user, hierarchy);

        expect(result).toBe(true);
      });

      it('should deny MANAGER editing tasks outside their hierarchy', () => {
        const taskInOtherDept = {
          id: 'task-789',
          departmentId: 'dept-engineering',
          assignments: [{ userId: 'user-frank' }],
        };

        const user = {
          userId: 'manager-john',
          role: 'MANAGER' as const,
          departmentId: 'dept-sales',
        };
        const hierarchy = ['dept-sales', 'dept-sales-regional'];

        const result = authService.canEditTask(
          taskInOtherDept,
          user,
          hierarchy
        );

        expect(result).toBe(false);
      });

      it('should allow MANAGER to edit tasks even if not assigned to them', () => {
        const user = {
          userId: 'manager-john',
          role: 'MANAGER' as const,
          departmentId: 'dept-sales',
        };
        const hierarchy = ['dept-sales'];

        // Manager is NOT in assignments list
        expect(mockTask.assignments.some(a => a.userId === user.userId)).toBe(
          false
        );

        const result = authService.canEditTask(mockTask, user, hierarchy);

        expect(result).toBe(true);
      });

      it('should handle multi-level department hierarchies', () => {
        const taskInDeepDept = {
          id: 'task-deep',
          departmentId: 'dept-sales-local-store1',
          assignments: [{ userId: 'user-zoe' }],
        };

        const user = {
          userId: 'manager-top',
          role: 'MANAGER' as const,
          departmentId: 'dept-sales',
        };
        // Full hierarchy: Sales > Regional > Local > Store1
        const hierarchy = [
          'dept-sales',
          'dept-sales-regional',
          'dept-sales-local',
          'dept-sales-local-store1',
        ];

        const result = authService.canEditTask(taskInDeepDept, user, hierarchy);

        expect(result).toBe(true);
      });
    });

    describe('HR_ADMIN role', () => {
      it('should allow HR_ADMIN to edit ALL tasks in their department', () => {
        const user = {
          userId: 'hr-admin-jane',
          role: 'HR_ADMIN' as const,
          departmentId: 'dept-sales',
        };
        const hierarchy = ['dept-sales'];

        const result = authService.canEditTask(mockTask, user, hierarchy);

        expect(result).toBe(true);
      });

      it('should allow HR_ADMIN to edit tasks in subordinate departments', () => {
        const taskInSubDept = {
          id: 'task-hr',
          departmentId: 'dept-sales-regional',
          assignments: [{ userId: 'user-alice' }],
        };

        const user = {
          userId: 'hr-admin-jane',
          role: 'HR_ADMIN' as const,
          departmentId: 'dept-sales',
        };
        const hierarchy = ['dept-sales', 'dept-sales-regional'];

        const result = authService.canEditTask(taskInSubDept, user, hierarchy);

        expect(result).toBe(true);
      });

      it('should deny HR_ADMIN editing tasks outside their hierarchy', () => {
        const taskInOtherDept = {
          id: 'task-other',
          departmentId: 'dept-engineering',
          assignments: [{ userId: 'user-frank' }],
        };

        const user = {
          userId: 'hr-admin-jane',
          role: 'HR_ADMIN' as const,
          departmentId: 'dept-hr',
        };
        const hierarchy = ['dept-hr'];

        const result = authService.canEditTask(
          taskInOtherDept,
          user,
          hierarchy
        );

        expect(result).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should handle tasks with no assignments', () => {
        const taskWithNoAssignments = {
          id: 'task-empty',
          departmentId: 'dept-sales',
          assignments: [],
        };

        const staffUser = {
          userId: 'user-alice',
          role: 'STAFF' as const,
          departmentId: 'dept-sales',
        };
        const hierarchy = ['dept-sales'];

        const result = authService.canEditTask(
          taskWithNoAssignments,
          staffUser,
          hierarchy
        );

        expect(result).toBe(false); // Staff can't edit unassigned tasks
      });

      it('should allow MANAGER to edit tasks with no assignments in their department', () => {
        const taskWithNoAssignments = {
          id: 'task-empty',
          departmentId: 'dept-sales',
          assignments: [],
        };

        const managerUser = {
          userId: 'manager-john',
          role: 'MANAGER' as const,
          departmentId: 'dept-sales',
        };
        const hierarchy = ['dept-sales'];

        const result = authService.canEditTask(
          taskWithNoAssignments,
          managerUser,
          hierarchy
        );

        expect(result).toBe(true);
      });

      it('should handle empty hierarchy gracefully', () => {
        const user = {
          userId: 'manager-john',
          role: 'MANAGER' as const,
          departmentId: 'dept-sales',
        };
        const emptyHierarchy: string[] = [];

        const result = authService.canEditTask(mockTask, user, emptyHierarchy);

        expect(result).toBe(false);
      });
    });
  });
});
