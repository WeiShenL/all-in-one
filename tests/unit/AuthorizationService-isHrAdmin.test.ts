/**
 * Unit tests for AuthorizationService with isHrAdmin field
 *
 * Tests the canEdit logic for users with combined HR/Admin + Staff/Manager roles
 */

import { AuthorizationService } from '../../src/app/server/services/AuthorizationService';

describe('AuthorizationService - isHrAdmin Field', () => {
  let authService: AuthorizationService;

  beforeEach(() => {
    authService = new AuthorizationService();
  });

  describe('STAFF with isHrAdmin flag', () => {
    it('should only allow STAFF with isHrAdmin=true to edit tasks they are assigned to', () => {
      const task = {
        id: 'task-123',
        departmentId: 'dept-hr',
        assignments: [{ userId: 'hr-admin-staff' }], // Assigned to them
      };

      const user = {
        userId: 'hr-admin-staff',
        role: 'STAFF' as const,
        departmentId: 'dept-hr',
        isHrAdmin: true,
      };
      const hierarchy = ['dept-hr', 'dept-hr-team'];

      const result = authService.canEditTask(task, user, hierarchy);

      expect(result).toBe(true); // Can edit because assigned
    });

    it('should deny STAFF with isHrAdmin=true editing tasks in their department if not assigned', () => {
      const task = {
        id: 'task-456',
        departmentId: 'dept-hr', // Same department
        assignments: [{ userId: 'user-bob' }], // Not assigned to them
      };

      const user = {
        userId: 'hr-admin-staff',
        role: 'STAFF' as const,
        departmentId: 'dept-hr',
        isHrAdmin: true,
      };
      const hierarchy = ['dept-hr', 'dept-hr-team'];

      const result = authService.canEditTask(task, user, hierarchy);

      expect(result).toBe(false); // Cannot edit - not assigned even though in hierarchy
    });

    it('should allow STAFF with isHrAdmin=false to only edit their assigned tasks', () => {
      const task = {
        id: 'task-789',
        departmentId: 'dept-engineering',
        assignments: [{ userId: 'regular-staff' }],
      };

      const user = {
        userId: 'regular-staff',
        role: 'STAFF' as const,
        departmentId: 'dept-engineering',
        isHrAdmin: false,
      };
      const hierarchy = ['dept-engineering'];

      const result = authService.canEditTask(task, user, hierarchy);

      expect(result).toBe(true); // Assigned to them
    });

    it('should deny STAFF with isHrAdmin=false editing unassigned tasks', () => {
      const task = {
        id: 'task-abc',
        departmentId: 'dept-engineering',
        assignments: [{ userId: 'other-user' }],
      };

      const user = {
        userId: 'regular-staff',
        role: 'STAFF' as const,
        departmentId: 'dept-engineering',
        isHrAdmin: false,
      };
      const hierarchy = ['dept-engineering'];

      const result = authService.canEditTask(task, user, hierarchy);

      expect(result).toBe(false); // Not assigned to them
    });
  });

  describe('MANAGER with isHrAdmin flag', () => {
    it('should allow MANAGER with isHrAdmin=true to edit tasks in their managed hierarchy', () => {
      const task = {
        id: 'task-mgr-1',
        departmentId: 'dept-engineering-dev',
        assignments: [{ userId: 'user-alice' }],
      };

      const user = {
        userId: 'hr-admin-manager',
        role: 'MANAGER' as const,
        departmentId: 'dept-engineering',
        isHrAdmin: true,
      };
      const hierarchy = ['dept-engineering', 'dept-engineering-dev'];

      const result = authService.canEditTask(task, user, hierarchy);

      expect(result).toBe(true);
    });

    it('should deny MANAGER with isHrAdmin=true editing tasks outside their hierarchy', () => {
      const task = {
        id: 'task-mgr-2',
        departmentId: 'dept-sales',
        assignments: [{ userId: 'user-bob' }],
      };

      const user = {
        userId: 'hr-admin-manager',
        role: 'MANAGER' as const,
        departmentId: 'dept-engineering',
        isHrAdmin: true,
      };
      const hierarchy = ['dept-engineering', 'dept-engineering-dev'];

      const result = authService.canEditTask(task, user, hierarchy);

      expect(result).toBe(false);
    });

    it('should allow MANAGER with isHrAdmin=false to edit tasks in their hierarchy', () => {
      const task = {
        id: 'task-mgr-3',
        departmentId: 'dept-sales-regional',
        assignments: [{ userId: 'user-charlie' }],
      };

      const user = {
        userId: 'regular-manager',
        role: 'MANAGER' as const,
        departmentId: 'dept-sales',
        isHrAdmin: false,
      };
      const hierarchy = ['dept-sales', 'dept-sales-regional'];

      const result = authService.canEditTask(task, user, hierarchy);

      expect(result).toBe(true);
    });
  });

  describe('HR_ADMIN legacy role (backward compatibility)', () => {
    it('should still allow HR_ADMIN role to edit tasks in hierarchy', () => {
      const task = {
        id: 'task-legacy',
        departmentId: 'dept-hr',
        assignments: [{ userId: 'user-dave' }],
      };

      const user = {
        userId: 'legacy-hr-admin',
        role: 'HR_ADMIN' as const,
        departmentId: 'dept-hr',
      };
      const hierarchy = ['dept-hr'];

      const result = authService.canEditTask(task, user, hierarchy);

      expect(result).toBe(true);
    });

    it('should deny HR_ADMIN legacy role editing tasks outside hierarchy', () => {
      const task = {
        id: 'task-legacy-2',
        departmentId: 'dept-sales',
        assignments: [{ userId: 'user-eve' }],
      };

      const user = {
        userId: 'legacy-hr-admin',
        role: 'HR_ADMIN' as const,
        departmentId: 'dept-hr',
      };
      const hierarchy = ['dept-hr'];

      const result = authService.canEditTask(task, user, hierarchy);

      expect(result).toBe(false);
    });
  });

  describe('Edge cases with isHrAdmin', () => {
    it('should handle undefined isHrAdmin as false', () => {
      const task = {
        id: 'task-edge-1',
        departmentId: 'dept-engineering',
        assignments: [{ userId: 'other-user' }],
      };

      const user = {
        userId: 'staff-no-flag',
        role: 'STAFF' as const,
        departmentId: 'dept-engineering',
        // isHrAdmin is undefined
      };
      const hierarchy = ['dept-engineering'];

      const result = authService.canEditTask(task, user, hierarchy);

      expect(result).toBe(false); // Should behave as regular staff (not assigned)
    });

    it('should handle isHrAdmin=false explicitly', () => {
      const task = {
        id: 'task-edge-2',
        departmentId: 'dept-engineering',
        assignments: [{ userId: 'other-user' }],
      };

      const user = {
        userId: 'staff-false-flag',
        role: 'STAFF' as const,
        departmentId: 'dept-engineering',
        isHrAdmin: false,
      };
      const hierarchy = ['dept-engineering'];

      const result = authService.canEditTask(task, user, hierarchy);

      expect(result).toBe(false);
    });

    it('should deny STAFF with isHrAdmin=true editing unassigned tasks', () => {
      const taskWithNoAssignments = {
        id: 'task-unassigned',
        departmentId: 'dept-hr',
        assignments: [],
      };

      const user = {
        userId: 'hr-admin-staff',
        role: 'STAFF' as const,
        departmentId: 'dept-hr',
        isHrAdmin: true,
      };
      const hierarchy = ['dept-hr'];

      const result = authService.canEditTask(
        taskWithNoAssignments,
        user,
        hierarchy
      );

      expect(result).toBe(false); // STAFF cannot edit unassigned tasks even with isHrAdmin
    });

    it('should deny STAFF with isHrAdmin editing tasks in multi-level hierarchy if not assigned', () => {
      const task = {
        id: 'task-deep',
        departmentId: 'dept-hr-team-recruiting',
        assignments: [{ userId: 'recruiter' }], // Not assigned to them
      };

      const user = {
        userId: 'hr-admin-staff',
        role: 'STAFF' as const,
        departmentId: 'dept-hr',
        isHrAdmin: true,
      };
      const hierarchy = ['dept-hr', 'dept-hr-team', 'dept-hr-team-recruiting'];

      const result = authService.canEditTask(task, user, hierarchy);

      expect(result).toBe(false); // STAFF cannot edit - not assigned
    });

    it('should handle empty hierarchy even with isHrAdmin=true', () => {
      const task = {
        id: 'task-empty-hierarchy',
        departmentId: 'dept-hr',
        assignments: [{ userId: 'user-alice' }],
      };

      const user = {
        userId: 'hr-admin-staff',
        role: 'STAFF' as const,
        departmentId: 'dept-hr',
        isHrAdmin: true,
      };
      const emptyHierarchy: string[] = [];

      const result = authService.canEditTask(task, user, emptyHierarchy);

      expect(result).toBe(false); // Should deny when hierarchy is empty
    });
  });

  describe('Complex scenarios', () => {
    it('should correctly handle STAFF + isHrAdmin viewing task outside their dept that they are assigned to', () => {
      // This is an edge case: HR/Admin staff assigned to a task in Engineering dept
      const task = {
        id: 'task-cross-dept',
        departmentId: 'dept-engineering',
        assignments: [{ userId: 'hr-admin-staff' }],
      };

      const user = {
        userId: 'hr-admin-staff',
        role: 'STAFF' as const,
        departmentId: 'dept-hr',
        isHrAdmin: true,
      };
      // HR hierarchy doesn't include Engineering
      const hierarchy = ['dept-hr', 'dept-hr-team'];

      const result = authService.canEditTask(task, user, hierarchy);

      // Task is not in their hierarchy, so should be false
      expect(result).toBe(false);
    });

    it('should handle MANAGER + isHrAdmin with wide hierarchy access', () => {
      const task = {
        id: 'task-wide',
        departmentId: 'dept-engineering-qa',
        assignments: [{ userId: 'qa-engineer' }],
      };

      const user = {
        userId: 'cto-hr-admin',
        role: 'MANAGER' as const,
        departmentId: 'dept-engineering',
        isHrAdmin: true,
      };
      const hierarchy = [
        'dept-engineering',
        'dept-engineering-dev',
        'dept-engineering-qa',
        'dept-engineering-ops',
      ];

      const result = authService.canEditTask(task, user, hierarchy);

      expect(result).toBe(true);
    });
  });
});
