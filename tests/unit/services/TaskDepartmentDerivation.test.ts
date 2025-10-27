/**
 * Unit Tests for Task Department Derivation Logic
 *
 * Tests the business logic that derives unique departments from task assignees
 *
 * Acceptance Criteria:
 * - AC1: Task with assignee from Dept A → shows Dept A tag
 * - AC2: Task with assignees from Dept A and B → shows both tags
 * - AC3: Task with assignees from multiple departments → shows all department tags
 * - AC4: Task with one assignee removed → removes that department tag (if no other assignees from that dept)
 *
 * Pattern: Pure logic tests with mocked dependencies
 */

// Helper function to derive unique departments from task assignees
export function deriveInvolvedDepartments(
  assignments: Array<{
    user: {
      departmentId: string;
      department?: { id: string; name: string };
    };
  }>,
  parentDepartmentId?: string | null
): Array<{ id: string; name: string }> {
  const departmentMap = new Map<string, { id: string; name: string }>();

  // Always include parent department first if it exists
  if (parentDepartmentId) {
    // If we have department info from assignments, use it
    const parentDeptFromAssignments = assignments.find(
      a => a.user.departmentId === parentDepartmentId && a.user.department
    )?.user.department;

    if (parentDeptFromAssignments) {
      departmentMap.set(parentDepartmentId, parentDeptFromAssignments);
    } else {
      // Fallback: we need to query the department separately
      // This is a placeholder - will be handled in the service layer
      departmentMap.set(parentDepartmentId, {
        id: parentDepartmentId,
        name: 'Unknown Department',
      });
    }
  }

  // Add all unique departments from assignees
  for (const assignment of assignments) {
    const dept = assignment.user.department;
    if (dept && !departmentMap.has(dept.id)) {
      departmentMap.set(dept.id, { id: dept.id, name: dept.name });
    }
  }

  return Array.from(departmentMap.values());
}

describe('Task Department Derivation - Unit Tests', () => {
  describe('deriveInvolvedDepartments', () => {
    // AC1: GIVEN a task is created and assigned to a user from Department A,
    // WHEN the task is saved, THEN Department A should show up as a department tag.
    test('AC1: should return Department A when task has one assignee from Dept A', () => {
      const assignments = [
        {
          user: {
            departmentId: 'dept-a-id',
            department: { id: 'dept-a-id', name: 'Department A' },
          },
        },
      ];

      const result = deriveInvolvedDepartments(assignments);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 'dept-a-id', name: 'Department A' });
    });

    // AC2: GIVEN a task currently linked to Department A, WHEN a user from Department B is assigned to the task,
    // THEN a new department tag is created for Department B AND the task now shows both the department tags for Department A and Department B.
    test('AC2: should return both Department A and B when assignees from both departments', () => {
      const assignments = [
        {
          user: {
            departmentId: 'dept-a-id',
            department: { id: 'dept-a-id', name: 'Department A' },
          },
        },
        {
          user: {
            departmentId: 'dept-b-id',
            department: { id: 'dept-b-id', name: 'Department B' },
          },
        },
      ];

      const result = deriveInvolvedDepartments(assignments);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ id: 'dept-a-id', name: 'Department A' });
      expect(result).toContainEqual({ id: 'dept-b-id', name: 'Department B' });
    });

    // AC3: GIVEN a task linked to multiple departments (Dept A, Dept B, Dept C),
    // WHEN a user opens the task details/modal, THEN all linked departments are displayed in department tags.
    test('AC3: should return all unique departments (A, B, C) when task has assignees from three departments', () => {
      const assignments = [
        {
          user: {
            departmentId: 'dept-a-id',
            department: { id: 'dept-a-id', name: 'Department A' },
          },
        },
        {
          user: {
            departmentId: 'dept-b-id',
            department: { id: 'dept-b-id', name: 'Department B' },
          },
        },
        {
          user: {
            departmentId: 'dept-c-id',
            department: { id: 'dept-c-id', name: 'Department C' },
          },
        },
      ];

      const result = deriveInvolvedDepartments(assignments);

      expect(result).toHaveLength(3);
      expect(result).toContainEqual({ id: 'dept-a-id', name: 'Department A' });
      expect(result).toContainEqual({ id: 'dept-b-id', name: 'Department B' });
      expect(result).toContainEqual({ id: 'dept-c-id', name: 'Department C' });
    });

    // AC4: GIVEN a task has only one assignee from Department A, WHEN that assignee is removed from the task,
    // THEN the department tag for Department A is removed (while others are unchanged).
    test('AC4: should remove Department A tag when last assignee from Dept A is removed', () => {
      // Scenario: Initially had assignees from Dept A and B, now only Dept B remains
      const assignments = [
        {
          user: {
            departmentId: 'dept-b-id',
            department: { id: 'dept-b-id', name: 'Department B' },
          },
        },
      ];

      const result = deriveInvolvedDepartments(assignments);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 'dept-b-id', name: 'Department B' });
      expect(result).not.toContainEqual(
        expect.objectContaining({ id: 'dept-a-id' })
      );
    });

    test('should handle multiple assignees from same department (no duplicates)', () => {
      const assignments = [
        {
          user: {
            departmentId: 'dept-a-id',
            department: { id: 'dept-a-id', name: 'Department A' },
          },
        },
        {
          user: {
            departmentId: 'dept-a-id',
            department: { id: 'dept-a-id', name: 'Department A' },
          },
        },
        {
          user: {
            departmentId: 'dept-b-id',
            department: { id: 'dept-b-id', name: 'Department B' },
          },
        },
      ];

      const result = deriveInvolvedDepartments(assignments);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ id: 'dept-a-id', name: 'Department A' });
      expect(result).toContainEqual({ id: 'dept-b-id', name: 'Department B' });
    });

    test('should return empty array when task has no assignees', () => {
      const assignments: Array<{
        user: {
          departmentId: string;
          department: { id: string; name: string };
        };
      }> = [];

      const result = deriveInvolvedDepartments(assignments);

      expect(result).toHaveLength(0);
    });

    // Test for parent department ID prioritization
    test('should include parent department at the top when parentDepartmentId is provided', () => {
      const assignments = [
        {
          user: {
            departmentId: 'dept-a-id',
            department: { id: 'dept-a-id', name: 'Department A' },
          },
        },
        {
          user: {
            departmentId: 'dept-b-id',
            department: { id: 'dept-b-id', name: 'Department B' },
          },
        },
      ];

      const result = deriveInvolvedDepartments(assignments, 'dept-a-id');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'dept-a-id', name: 'Department A' }); // Parent department first
      expect(result[1]).toEqual({ id: 'dept-b-id', name: 'Department B' });
    });

    test('should handle parent department not present in assignments', () => {
      const assignments = [
        {
          user: {
            departmentId: 'dept-b-id',
            department: { id: 'dept-b-id', name: 'Department B' },
          },
        },
      ];

      // Parent department is 'dept-a-id' but no assignees from that department
      const result = deriveInvolvedDepartments(assignments, 'dept-a-id');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'dept-a-id',
        name: 'Unknown Department',
      }); // Placeholder
      expect(result[1]).toEqual({ id: 'dept-b-id', name: 'Department B' });
    });
  });
});
