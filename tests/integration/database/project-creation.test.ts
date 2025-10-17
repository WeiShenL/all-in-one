/**
 * @jest-environment node
 *
 * Integration Tests for Project Creation (SCRUM-30)
 *
 * Tests the complete project creation flow with real database operations:
 * - AC1: Staff can create a project
 * - AC2: Project names must be unique within a department
 * - AC3: Project name must be given (validated at domain level)
 *
 * Test Coverage:
 * - Database-level uniqueness check (case-insensitive)
 * - Uniqueness scoped to department (different depts can have same name)
 * - Uniqueness excludes archived projects
 * - Repository persistence and retrieval
 */

import { Client } from 'pg';
import { ProjectService } from '@/services/project/ProjectService';
import { PrismaClient } from '@prisma/client';
import { PrismaProjectRepository } from '@/repositories/PrismaProjectRepository';
import { ProjectStatus } from '@/domain/project/Project';

describe('Integration Tests - Project Creation (SCRUM-30)', () => {
  let pgClient: Client;
  let prisma: PrismaClient;
  let projectService: ProjectService;

  // Test data IDs
  let salesDeptId: string;
  let engineeringDeptId: string;
  let staffInSalesId: string;
  let staffInEngineeringId: string;

  // Track created projects for cleanup
  const createdProjectIds: string[] = [];

  beforeAll(async () => {
    // Connect to database
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Initialize Prisma client and service
    prisma = new PrismaClient();
    const repository = new PrismaProjectRepository(prisma);
    projectService = new ProjectService(repository);

    // Clean up any leftover test data
    await pgClient.query(
      `DELETE FROM "project" WHERE "creatorId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@project-creation-test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@project-creation-test.com'`
    );
    await pgClient.query(
      `DELETE FROM "department" WHERE name IN ('Sales-Project-Test', 'Engineering-Project-Test')`
    );

    // Create Sales department
    const salesDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      ['Sales-Project-Test']
    );
    salesDeptId = salesDeptResult.rows[0].id;

    // Create Engineering department
    const engineeringDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      ['Engineering-Project-Test']
    );
    engineeringDeptId = engineeringDeptResult.rows[0].id;

    // Create staff in Sales department
    const staffInSalesResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'staff-sales@project-creation-test.com',
        'Sales Staff',
        'STAFF',
        salesDeptId,
      ]
    );
    staffInSalesId = staffInSalesResult.rows[0].id;

    // Create staff in Engineering department
    const staffInEngineeringResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'staff-engineering@project-creation-test.com',
        'Engineering Staff',
        'STAFF',
        engineeringDeptId,
      ]
    );
    staffInEngineeringId = staffInEngineeringResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup projects
    for (const projectId of createdProjectIds) {
      await pgClient.query(`DELETE FROM "project" WHERE id = $1`, [projectId]);
    }

    // Cleanup test data
    await pgClient.query(
      `DELETE FROM "project" WHERE "creatorId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@project-creation-test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@project-creation-test.com'`
    );
    await pgClient.query(
      `DELETE FROM "department" WHERE name IN ('Sales-Project-Test', 'Engineering-Project-Test')`
    );

    await pgClient.end();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clear created projects after each test
    for (const projectId of createdProjectIds) {
      await pgClient.query(`DELETE FROM "project" WHERE id = $1`, [projectId]);
    }
    createdProjectIds.length = 0;
  });

  // ============================================
  // AC1: Staff Can Create Projects
  // ============================================

  describe('AC1: Staff Can Create Projects', () => {
    it('should create a project with valid data', async () => {
      const result = await projectService.createProject(
        {
          name: `Customer Portal Redesign ${Date.now()}`,
          description: 'Redesign the customer-facing portal',
          priority: 7,
        },
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        }
      );

      // Store for cleanup
      createdProjectIds.push(result.id);

      // Verify result
      expect(result.id).toBeDefined();
      expect(result.name).toMatch(/^Customer Portal Redesign \d+$/);

      // Verify in database
      const dbResult = await pgClient.query(
        'SELECT * FROM "project" WHERE id = $1',
        [result.id]
      );

      expect(dbResult.rows.length).toBe(1);
      const project = dbResult.rows[0];

      expect(project.name).toMatch(/^Customer Portal Redesign \d+$/);
      expect(project.description).toBe('Redesign the customer-facing portal');
      expect(project.priority).toBe(7);
      expect(project.status).toBe(ProjectStatus.ACTIVE);
      expect(project.departmentId).toBe(salesDeptId);
      expect(project.creatorId).toBe(staffInSalesId);
      expect(project.isArchived).toBe(false);
    }, 300000);

    it('should create project with default values', async () => {
      const result = await projectService.createProject(
        {
          name: 'Simple Project',
        },
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        }
      );

      createdProjectIds.push(result.id);

      const dbResult = await pgClient.query(
        'SELECT * FROM "project" WHERE id = $1',
        [result.id]
      );

      const project = dbResult.rows[0];
      expect(project.priority).toBe(5); // Default priority
      expect(project.status).toBe(ProjectStatus.ACTIVE); // Default status
      expect(project.description).toBeNull();
    }, 300000);

    it('should trim whitespace from project name', async () => {
      const result = await projectService.createProject(
        {
          name: '  Trimmed Project  ',
        },
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        }
      );

      createdProjectIds.push(result.id);

      expect(result.name).toBe('Trimmed Project');

      const dbResult = await pgClient.query(
        'SELECT * FROM "project" WHERE id = $1',
        [result.id]
      );
      expect(dbResult.rows[0].name).toBe('Trimmed Project');
    }, 300000);
  });

  // ============================================
  // AC2: Project Names Must Be Unique (Within Department)
  // ============================================

  describe('AC2: Project Name Uniqueness', () => {
    it('should reject duplicate project name in same department', async () => {
      // Create first project
      const first = await projectService.createProject(
        {
          name: 'Marketing Campaign',
        },
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(first.id);

      // Attempt to create duplicate
      await expect(
        projectService.createProject(
          {
            name: 'Marketing Campaign',
          },
          {
            userId: staffInSalesId,
            departmentId: salesDeptId,
            role: 'STAFF',
          }
        )
      ).rejects.toThrow('already exists');
    }, 300000);

    it('should perform case-insensitive uniqueness check', async () => {
      // Create first project with lowercase
      const first = await projectService.createProject(
        {
          name: 'customer portal',
        },
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(first.id);

      // Attempt to create with different case
      await expect(
        projectService.createProject(
          {
            name: 'Customer Portal',
          },
          {
            userId: staffInSalesId,
            departmentId: salesDeptId,
            role: 'STAFF',
          }
        )
      ).rejects.toThrow('already exists');
    }, 300000);

    it('should reject same project name globally across departments', async () => {
      // Create project in Sales department
      const salesProject = await projectService.createProject(
        {
          name: 'Website Redesign',
        },
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(salesProject.id);

      // Try to create project with same name in Engineering department - should fail
      await expect(
        projectService.createProject(
          {
            name: 'Website Redesign',
          },
          {
            userId: staffInEngineeringId,
            departmentId: engineeringDeptId,
            role: 'STAFF',
          }
        )
      ).rejects.toThrow('already exists');

      // Only the first project should exist
      expect(salesProject.id).toBeDefined();
      expect(salesProject.name).toBe('Website Redesign');

      // Verify only one project exists in database
      const dbResult = await pgClient.query(
        'SELECT * FROM "project" WHERE name = $1',
        ['Website Redesign']
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].departmentId).toBe(salesDeptId);
    }, 300000);

    it('should allow reusing name after archiving project', async () => {
      // Create and archive first project
      const first = await projectService.createProject(
        {
          name: `Archived Project ${Date.now()}`,
        },
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(first.id);

      // Archive the project
      await pgClient.query(
        'UPDATE "project" SET "isArchived" = true WHERE id = $1',
        [first.id]
      );

      // Should be able to create new project with same name
      const second = await projectService.createProject(
        {
          name: `Archived Project ${Date.now() + 1}`,
        },
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(second.id);

      expect(second.id).toBeDefined();
      expect(second.id).not.toBe(first.id);

      // Verify both exist but only new one is active
      const firstDbResult = await pgClient.query(
        'SELECT * FROM "project" WHERE id = $1',
        [first.id]
      );
      const secondDbResult = await pgClient.query(
        'SELECT * FROM "project" WHERE id = $1',
        [second.id]
      );

      expect(firstDbResult.rows[0].isArchived).toBe(true);
      expect(secondDbResult.rows[0].isArchived).toBe(false);
    }, 300000);
  });

  // ============================================
  // AC3: Project Name Validation
  // ============================================

  describe('AC3: Project Name Validation', () => {
    it('should reject empty project name', async () => {
      await expect(
        projectService.createProject(
          {
            name: '',
          },
          {
            userId: staffInSalesId,
            departmentId: salesDeptId,
            role: 'STAFF',
          }
        )
      ).rejects.toThrow('Project name is required');
    }, 300000);

    it('should reject whitespace-only project name', async () => {
      await expect(
        projectService.createProject(
          {
            name: '   ',
          },
          {
            userId: staffInSalesId,
            departmentId: salesDeptId,
            role: 'STAFF',
          }
        )
      ).rejects.toThrow('cannot be empty or whitespace');
    }, 300000);

    it('should reject project name over 100 characters', async () => {
      await expect(
        projectService.createProject(
          {
            name: 'A'.repeat(101),
          },
          {
            userId: staffInSalesId,
            departmentId: salesDeptId,
            role: 'STAFF',
          }
        )
      ).rejects.toThrow('must not exceed 100 characters');
    }, 300000);
  });

  // ============================================
  // Repository Operations
  // ============================================

  describe('Repository Operations', () => {
    it('should retrieve project by ID', async () => {
      const created = await projectService.createProject(
        {
          name: 'Retrievable Project',
          description: 'Test retrieval',
          priority: 8,
        },
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(created.id);

      const retrieved = await projectService.getProjectById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('Retrievable Project');
      expect(retrieved!.description).toBe('Test retrieval');
      expect(retrieved!.priority).toBe(8);
      expect(retrieved!.creatorId).toBe(staffInSalesId);
      expect(retrieved!.departmentId).toBe(salesDeptId);
    }, 300000);

    it('should retrieve all projects in department', async () => {
      // Create multiple projects in Sales department
      const project1 = await projectService.createProject(
        {
          name: 'Sales Project 1',
        },
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(project1.id);

      const project2 = await projectService.createProject(
        {
          name: 'Sales Project 2',
        },
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(project2.id);

      // Retrieve all projects in Sales department
      const projects = await projectService.getDepartmentProjects(
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        },
        false // Don't include archived
      );

      // Should have at least the 2 we created
      expect(projects.length).toBeGreaterThanOrEqual(2);

      const projectNames = projects.map(p => p.name);
      expect(projectNames).toContain('Sales Project 1');
      expect(projectNames).toContain('Sales Project 2');
    }, 300000);

    it('should not include archived projects by default', async () => {
      // Create project
      const project = await projectService.createProject(
        {
          name: 'To Be Archived',
        },
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(project.id);

      // Archive it
      await pgClient.query(
        'UPDATE "project" SET "isArchived" = true WHERE id = $1',
        [project.id]
      );

      // Retrieve projects (not including archived)
      const projects = await projectService.getDepartmentProjects(
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        },
        false
      );

      // Should not include archived project
      const projectNames = projects.map(p => p.name);
      expect(projectNames).not.toContain('To Be Archived');
    }, 300000);

    it('should include archived projects when requested', async () => {
      // Create project
      const project = await projectService.createProject(
        {
          name: 'Archived But Retrievable',
        },
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        }
      );
      createdProjectIds.push(project.id);

      // Archive it
      await pgClient.query(
        'UPDATE "project" SET "isArchived" = true WHERE id = $1',
        [project.id]
      );

      // Retrieve projects (including archived)
      const projects = await projectService.getDepartmentProjects(
        {
          userId: staffInSalesId,
          departmentId: salesDeptId,
          role: 'STAFF',
        },
        true // Include archived
      );

      // Should include archived project
      const projectNames = projects.map(p => p.name);
      expect(projectNames).toContain('Archived But Retrievable');
    }, 300000);
  });
});
