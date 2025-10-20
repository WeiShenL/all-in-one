/**
 * @jest-environment node
 *
 * Integration Tests for Project Visibility and Department Access
 *
 * Tests the complete project visibility flow with real database operations:
 * - Role-based project visibility (STAFF, MANAGER, ADMIN)
 * - Department hierarchy access
 * - ProjectDepartmentAccess bridge table functionality
 * - Cross-department project sharing
 *
 * Test Coverage:
 * - Database-level department hierarchy queries
 * - Project visibility across department boundaries
 * - Role-based access control integration
 * - Bridge table operations for cross-department access
 */

import { Client } from 'pg';
import { ProjectService } from '@/services/project/ProjectService';
import { PrismaClient } from '@prisma/client';
import { PrismaProjectRepository } from '@/repositories/PrismaProjectRepository';
import { TaskService } from '@/app/server/services/TaskService';

describe('Integration Tests - Project Visibility and Department Access', () => {
  let pgClient: Client;
  let prisma: PrismaClient;
  let projectService: ProjectService;
  let taskService: TaskService;

  // Test data IDs
  let rootDeptId: string;
  let childDept1Id: string;
  let childDept2Id: string;
  let grandchildDeptId: string;
  let unrelatedDeptId: string;

  let rootManagerId: string;
  let childManagerId: string;
  let staffInChild1Id: string;
  let staffInChild2Id: string;
  let staffInGrandchildId: string;
  let staffInUnrelatedId: string;
  let adminId: string;

  // Track created projects for cleanup
  const createdProjectIds: string[] = [];
  const createdAccessRows: Array<{ projectId: string; departmentId: string }> =
    [];

  beforeAll(async () => {
    // Connect to database
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Initialize Prisma client and services
    prisma = new PrismaClient();
    const repository = new PrismaProjectRepository(prisma);
    projectService = new ProjectService(repository);
    taskService = new TaskService(prisma);

    // Clean up any leftover test data
    await pgClient.query(
      `DELETE FROM "project_department_access" WHERE "projectId" IN (
        SELECT id FROM "project" WHERE "creatorId" IN (
          SELECT id FROM "user_profile" WHERE email LIKE '%@visibility-test.com'
        )
      )`
    );
    await pgClient.query(
      `DELETE FROM "project" WHERE "creatorId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@visibility-test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@visibility-test.com'`
    );
    await pgClient.query(
      `DELETE FROM "department" WHERE name LIKE '%Visibility-Test%'`
    );

    // Create department hierarchy
    // Root Department
    const rootDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      ['Root-Visibility-Test']
    );
    rootDeptId = rootDeptResult.rows[0].id;

    // Child Department 1
    const childDept1Result = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
       RETURNING id`,
      ['Child1-Visibility-Test', rootDeptId]
    );
    childDept1Id = childDept1Result.rows[0].id;

    // Child Department 2
    const childDept2Result = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
       RETURNING id`,
      ['Child2-Visibility-Test', rootDeptId]
    );
    childDept2Id = childDept2Result.rows[0].id;

    // Grandchild Department
    const grandchildDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
       RETURNING id`,
      ['Grandchild-Visibility-Test', childDept1Id]
    );
    grandchildDeptId = grandchildDeptResult.rows[0].id;

    // Unrelated Department
    const unrelatedDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      ['Unrelated-Visibility-Test']
    );
    unrelatedDeptId = unrelatedDeptResult.rows[0].id;

    // Create users
    const rootManagerResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'root-manager@visibility-test.com',
        'Root Manager',
        'MANAGER',
        rootDeptId,
      ]
    );
    rootManagerId = rootManagerResult.rows[0].id;

    const childManagerResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'child-manager@visibility-test.com',
        'Child Manager',
        'MANAGER',
        childDept1Id,
      ]
    );
    childManagerId = childManagerResult.rows[0].id;

    const staffInChild1Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'staff-child1@visibility-test.com',
        'Staff Child1',
        'STAFF',
        childDept1Id,
      ]
    );
    staffInChild1Id = staffInChild1Result.rows[0].id;

    const staffInChild2Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'staff-child2@visibility-test.com',
        'Staff Child2',
        'STAFF',
        childDept2Id,
      ]
    );
    staffInChild2Id = staffInChild2Result.rows[0].id;

    const staffInGrandchildResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'staff-grandchild@visibility-test.com',
        'Staff Grandchild',
        'STAFF',
        grandchildDeptId,
      ]
    );
    staffInGrandchildId = staffInGrandchildResult.rows[0].id;

    const staffInUnrelatedResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'staff-unrelated@visibility-test.com',
        'Staff Unrelated',
        'STAFF',
        unrelatedDeptId,
      ]
    );
    staffInUnrelatedId = staffInUnrelatedResult.rows[0].id;

    const adminResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['admin@visibility-test.com', 'Admin User', 'HR_ADMIN', rootDeptId]
    );
    adminId = adminResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup access rows
    for (const accessRow of createdAccessRows) {
      await pgClient.query(
        `DELETE FROM "project_department_access" WHERE "projectId" = $1 AND "departmentId" = $2`,
        [accessRow.projectId, accessRow.departmentId]
      );
    }

    // Cleanup projects
    for (const projectId of createdProjectIds) {
      await pgClient.query(`DELETE FROM "project" WHERE id = $1`, [projectId]);
    }

    // Cleanup test data
    await pgClient.query(
      `DELETE FROM "project_department_access" WHERE "projectId" IN (
        SELECT id FROM "project" WHERE "creatorId" IN (
          SELECT id FROM "user_profile" WHERE email LIKE '%@visibility-test.com'
        )
      )`
    );
    await pgClient.query(
      `DELETE FROM "project" WHERE "creatorId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@visibility-test.com'
      )`
    );
    // Temporarily disable foreign key constraint for cleanup
    await pgClient.query('SET session_replication_role = replica');
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@visibility-test.com'`
    );
    await pgClient.query(
      `DELETE FROM "department" WHERE name LIKE '%Visibility-Test%'`
    );
    // Re-enable foreign key constraint
    await pgClient.query('SET session_replication_role = DEFAULT');

    await pgClient.end();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clear created projects and access rows after each test
    for (const projectId of createdProjectIds) {
      await pgClient.query(`DELETE FROM "project" WHERE id = $1`, [projectId]);
    }
    for (const accessRow of createdAccessRows) {
      await pgClient.query(
        `DELETE FROM "project_department_access" WHERE "projectId" = $1 AND "departmentId" = $2`,
        [accessRow.projectId, accessRow.departmentId]
      );
    }
    createdProjectIds.length = 0;
    createdAccessRows.length = 0;
  });

  // ============================================
  // STAFF Role Visibility Tests
  // ============================================

  describe('STAFF Role Visibility', () => {
    it('should only see projects from own department', async () => {
      // Create project in child1 department
      const project1 = await projectService.createProject(
        {
          name: 'Child1 Project',
          description: 'Project in Child1 department',
        },
        {
          userId: staffInChild1Id,
          departmentId: childDept1Id,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(project1.id);

      // Create project in child2 department
      const project2 = await projectService.createProject(
        {
          name: 'Child2 Project',
          description: 'Project in Child2 department',
        },
        {
          userId: staffInChild2Id,
          departmentId: childDept2Id,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(project2.id);

      // Staff in child1 should only see child1 project
      const visibleProjects = await projectService.getVisibleProjectsForUser(
        {
          userId: staffInChild1Id,
          departmentId: childDept1Id,
          role: 'STAFF',
        },
        {
          getSubordinateDepartments: (id: string) =>
            taskService.getSubordinateDepartments(id),
        }
      );

      expect(visibleProjects).toHaveLength(1);
      expect(visibleProjects[0].name).toBe('Child1 Project');
      expect(visibleProjects[0].departmentId).toBe(childDept1Id);
    }, 300000);

    it('should not see projects from parent departments', async () => {
      // Create project in root department
      const rootProject = await projectService.createProject(
        {
          name: 'Root Project',
          description: 'Project in root department',
        },
        {
          userId: rootManagerId,
          departmentId: rootDeptId,
          role: 'MANAGER',
        }
      );
      createdProjectIds.push(rootProject.id);

      // Staff in child1 should not see root project
      const visibleProjects = await projectService.getVisibleProjectsForUser(
        {
          userId: staffInChild1Id,
          departmentId: childDept1Id,
          role: 'STAFF',
        },
        {
          getSubordinateDepartments: (id: string) =>
            taskService.getSubordinateDepartments(id),
        }
      );

      const projectNames = visibleProjects.map(p => p.name);
      expect(projectNames).not.toContain('Root Project');
    }, 300000);
  });

  // ============================================
  // MANAGER Role Visibility Tests
  // ============================================

  describe('MANAGER Role Visibility', () => {
    it('should see projects from own and subordinate departments', async () => {
      // Create projects in different departments
      const rootProject = await projectService.createProject(
        {
          name: 'Root Manager Project',
          description: 'Project created by root manager',
        },
        {
          userId: rootManagerId,
          departmentId: rootDeptId,
          role: 'MANAGER',
        }
      );
      createdProjectIds.push(rootProject.id);

      const child1Project = await projectService.createProject(
        {
          name: 'Child1 Manager Project',
          description: 'Project created by child1 manager',
        },
        {
          userId: childManagerId,
          departmentId: childDept1Id,
          role: 'MANAGER',
        }
      );
      createdProjectIds.push(child1Project.id);

      const grandchildProject = await projectService.createProject(
        {
          name: 'Grandchild Project',
          description: 'Project in grandchild department',
        },
        {
          userId: staffInGrandchildId,
          departmentId: grandchildDeptId,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(grandchildProject.id);

      // Root manager should see all projects from root, child1, child2, and grandchild
      const visibleProjects = await projectService.getVisibleProjectsForUser(
        {
          userId: rootManagerId,
          departmentId: rootDeptId,
          role: 'MANAGER',
        },
        {
          getSubordinateDepartments: (id: string) =>
            taskService.getSubordinateDepartments(id),
        }
      );

      const projectNames = visibleProjects.map(p => p.name);
      expect(projectNames).toContain('Root Manager Project');
      expect(projectNames).toContain('Child1 Manager Project');
      expect(projectNames).toContain('Grandchild Project');
      expect(visibleProjects.length).toBeGreaterThanOrEqual(3);
    }, 300000);

    it('should not see projects from unrelated departments', async () => {
      // Create project in unrelated department
      const unrelatedProject = await projectService.createProject(
        {
          name: 'Unrelated Project',
          description: 'Project in unrelated department',
        },
        {
          userId: staffInUnrelatedId,
          departmentId: unrelatedDeptId,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(unrelatedProject.id);

      // Root manager should not see unrelated project
      const visibleProjects = await projectService.getVisibleProjectsForUser(
        {
          userId: rootManagerId,
          departmentId: rootDeptId,
          role: 'MANAGER',
        },
        {
          getSubordinateDepartments: (id: string) =>
            taskService.getSubordinateDepartments(id),
        }
      );

      const projectNames = visibleProjects.map(p => p.name);
      expect(projectNames).not.toContain('Unrelated Project');
    }, 300000);
  });

  // ============================================
  // ADMIN Role Visibility Tests
  // ============================================

  describe('ADMIN Role Visibility', () => {
    it('should see all projects across all departments', async () => {
      // Create projects in different departments
      const rootProject = await projectService.createProject(
        {
          name: 'Admin Root Project',
          description: 'Project in root department',
        },
        {
          userId: rootManagerId,
          departmentId: rootDeptId,
          role: 'MANAGER',
        }
      );
      createdProjectIds.push(rootProject.id);

      const unrelatedProject = await projectService.createProject(
        {
          name: 'Admin Unrelated Project',
          description: 'Project in unrelated department',
        },
        {
          userId: staffInUnrelatedId,
          departmentId: unrelatedDeptId,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(unrelatedProject.id);

      // Admin should see all projects
      const visibleProjects = await projectService.getVisibleProjectsForUser(
        {
          userId: adminId,
          departmentId: rootDeptId,
          role: 'HR_ADMIN',
        },
        {
          getSubordinateDepartments: (id: string) =>
            taskService.getSubordinateDepartments(id),
        }
      );

      const projectNames = visibleProjects.map(p => p.name);
      expect(projectNames).toContain('Admin Root Project');
      expect(projectNames).toContain('Admin Unrelated Project');
      expect(visibleProjects.length).toBeGreaterThanOrEqual(2);
    }, 300000);
  });

  // ============================================
  // Cross-Department Access Tests
  // ============================================

  describe('Cross-Department Project Access', () => {
    it('should allow cross-department access via bridge table', async () => {
      // Create project in child1 department
      const sharedProject = await projectService.createProject(
        {
          name: 'Shared Project',
          description: 'Project shared across departments',
        },
        {
          userId: staffInChild1Id,
          departmentId: childDept1Id,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(sharedProject.id);

      // Grant access to child2 department
      await pgClient.query(
        `INSERT INTO "project_department_access" ("projectId", "departmentId", "grantedAt")
         VALUES ($1, $2, NOW())`,
        [sharedProject.id, childDept2Id]
      );
      createdAccessRows.push({
        projectId: sharedProject.id,
        departmentId: childDept2Id,
      });

      // Staff in child2 should now see the shared project
      const visibleProjects = await projectService.getVisibleProjectsForUser(
        {
          userId: staffInChild2Id,
          departmentId: childDept2Id,
          role: 'STAFF',
        },
        {
          getSubordinateDepartments: (id: string) =>
            taskService.getSubordinateDepartments(id),
        }
      );

      const projectNames = visibleProjects.map(p => p.name);
      expect(projectNames).toContain('Shared Project');
    }, 300000);

    it('should handle multiple cross-department accesses', async () => {
      // Create project in root department
      const multiAccessProject = await projectService.createProject(
        {
          name: 'Multi-Access Project',
          description: 'Project with multiple department access',
        },
        {
          userId: rootManagerId,
          departmentId: rootDeptId,
          role: 'MANAGER',
        }
      );
      createdProjectIds.push(multiAccessProject.id);

      // Grant access to multiple departments
      await pgClient.query(
        `INSERT INTO "project_department_access" ("projectId", "departmentId", "grantedAt")
         VALUES ($1, $2, NOW()), ($1, $3, NOW())`,
        [multiAccessProject.id, childDept1Id, unrelatedDeptId]
      );
      createdAccessRows.push(
        { projectId: multiAccessProject.id, departmentId: childDept1Id },
        { projectId: multiAccessProject.id, departmentId: unrelatedDeptId }
      );

      // Staff in child1 should see the project
      const child1Projects = await projectService.getVisibleProjectsForUser(
        {
          userId: staffInChild1Id,
          departmentId: childDept1Id,
          role: 'STAFF',
        },
        {
          getSubordinateDepartments: (id: string) =>
            taskService.getSubordinateDepartments(id),
        }
      );

      // Staff in unrelated should see the project
      const unrelatedProjects = await projectService.getVisibleProjectsForUser(
        {
          userId: staffInUnrelatedId,
          departmentId: unrelatedDeptId,
          role: 'STAFF',
        },
        {
          getSubordinateDepartments: (id: string) =>
            taskService.getSubordinateDepartments(id),
        }
      );

      const child1ProjectNames = child1Projects.map(p => p.name);
      const unrelatedProjectNames = unrelatedProjects.map(p => p.name);

      expect(child1ProjectNames).toContain('Multi-Access Project');
      expect(unrelatedProjectNames).toContain('Multi-Access Project');
    }, 300000);
  });

  // ============================================
  // Archived Projects Tests
  // ============================================

  describe('Archived Projects Visibility', () => {
    it('should exclude archived projects by default', async () => {
      // Create and archive a project
      const archivedProject = await projectService.createProject(
        {
          name: 'To Be Archived',
          description: 'Project that will be archived',
        },
        {
          userId: staffInChild1Id,
          departmentId: childDept1Id,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(archivedProject.id);

      // Archive the project
      await pgClient.query(
        'UPDATE "project" SET "isArchived" = true WHERE id = $1',
        [archivedProject.id]
      );

      // Should not see archived project by default
      const visibleProjects = await projectService.getVisibleProjectsForUser(
        {
          userId: staffInChild1Id,
          departmentId: childDept1Id,
          role: 'STAFF',
        },
        {
          getSubordinateDepartments: (id: string) =>
            taskService.getSubordinateDepartments(id),
        }
      );

      const projectNames = visibleProjects.map(p => p.name);
      expect(projectNames).not.toContain('To Be Archived');
    }, 300000);

    it('should include archived projects when requested', async () => {
      // Create and archive a project
      const archivedProject = await projectService.createProject(
        {
          name: 'Archived Visible',
          description: 'Archived project that should be visible',
        },
        {
          userId: staffInChild1Id,
          departmentId: childDept1Id,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(archivedProject.id);

      // Archive the project
      await pgClient.query(
        'UPDATE "project" SET "isArchived" = true WHERE id = $1',
        [archivedProject.id]
      );

      // Should see archived project when explicitly requested
      const visibleProjects = await projectService.getVisibleProjectsForUser(
        {
          userId: staffInChild1Id,
          departmentId: childDept1Id,
          role: 'STAFF',
        },
        {
          getSubordinateDepartments: (id: string) =>
            taskService.getSubordinateDepartments(id),
        },
        { isArchived: true }
      );

      const projectNames = visibleProjects.map(p => p.name);
      expect(projectNames).toContain('Archived Visible');
    }, 300000);
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty department hierarchy gracefully', async () => {
      // Create a department with no children
      const isolatedDeptResult = await pgClient.query(
        `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
         RETURNING id`,
        ['Isolated-Visibility-Test']
      );
      const isolatedDeptId = isolatedDeptResult.rows[0].id;

      const isolatedStaffResult = await pgClient.query(
        `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
         RETURNING id`,
        [
          'isolated-staff@visibility-test.com',
          'Isolated Staff',
          'STAFF',
          isolatedDeptId,
        ]
      );
      const isolatedStaffId = isolatedStaffResult.rows[0].id;

      try {
        // Manager with no subordinates should only see own department projects
        const visibleProjects = await projectService.getVisibleProjectsForUser(
          {
            userId: isolatedStaffId,
            departmentId: isolatedDeptId,
            role: 'MANAGER',
          },
          {
            getSubordinateDepartments: (id: string) =>
              taskService.getSubordinateDepartments(id),
          }
        );

        expect(visibleProjects).toEqual([]);
      } finally {
        // Cleanup
        await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
          isolatedStaffId,
        ]);
        await pgClient.query(`DELETE FROM "department" WHERE id = $1`, [
          isolatedDeptId,
        ]);
      }
    }, 300000);

    it('should handle non-existent department gracefully', async () => {
      const nonExistentDeptId = '00000000-0000-0000-0000-000000000000';

      const result = await projectService.getVisibleProjectsForUser(
        {
          userId: staffInChild1Id,
          departmentId: nonExistentDeptId,
          role: 'STAFF',
        },
        {
          getSubordinateDepartments: (id: string) =>
            taskService.getSubordinateDepartments(id),
        }
      );

      // Should return empty array for non-existent department
      expect(result).toEqual([]);
    }, 300000);
  });
});
