/**
 * @jest-environment node
 *
 * Integration Tests for Project Router - Visibility Features
 *
 * Tests the complete project router integration with real database operations:
 * - getVisible endpoint functionality
 * - Role-based access control through tRPC
 * - Integration with TaskService for department hierarchy
 * - Error handling and validation
 */

import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { projectRouter } from '@/app/server/routers/project';
import { createInnerTRPCContext } from '@/app/server/trpc';

describe('Integration Tests - Project Router Visibility', () => {
  let pgClient: Client;
  let prisma: PrismaClient;

  // Test data IDs
  let rootDeptId: string;
  let childDeptId: string;
  let rootManagerId: string;
  let childStaffId: string;
  let adminId: string;

  // Track created projects for cleanup
  const createdProjectIds: string[] = [];

  beforeAll(async () => {
    // Connect to database
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Initialize Prisma client
    prisma = new PrismaClient();

    // Clean up any leftover test data
    await pgClient.query(
      `DELETE FROM "project" WHERE "creatorId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@router-visibility-test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@router-visibility-test.com'`
    );
    await pgClient.query(
      `DELETE FROM "department" WHERE name LIKE '%Router-Visibility-Test%'`
    );

    // Create department hierarchy
    const rootDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      ['Root-Router-Visibility-Test']
    );
    rootDeptId = rootDeptResult.rows[0].id;

    const childDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
       RETURNING id`,
      ['Child-Router-Visibility-Test', rootDeptId]
    );
    childDeptId = childDeptResult.rows[0].id;

    // Create users
    const rootManagerResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'root-manager@router-visibility-test.com',
        'Root Manager',
        'MANAGER',
        rootDeptId,
      ]
    );
    rootManagerId = rootManagerResult.rows[0].id;

    const childStaffResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'child-staff@router-visibility-test.com',
        'Child Staff',
        'STAFF',
        childDeptId,
      ]
    );
    childStaffId = childStaffResult.rows[0].id;

    const adminResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['admin@router-visibility-test.com', 'Admin User', 'HR_ADMIN', rootDeptId]
    );
    adminId = adminResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup projects
    for (const projectId of createdProjectIds) {
      await pgClient.query(`DELETE FROM "project" WHERE id = $1`, [projectId]);
    }

    // Cleanup test data
    await pgClient.query(
      `DELETE FROM "project" WHERE "creatorId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@router-visibility-test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@router-visibility-test.com'`
    );
    await pgClient.query(
      `DELETE FROM "department" WHERE name LIKE '%Router-Visibility-Test%'`
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

  // Helper function to create tRPC context
  const createContext = (userId: string) =>
    createInnerTRPCContext({
      session: {
        user: { id: userId },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      },
    });

  describe('getVisible endpoint', () => {
    it('should return visible projects for STAFF user', async () => {
      // Create project in child department
      const project = await pgClient.query(
        `INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW(), NOW())
         RETURNING id`,
        [
          'Child Project',
          'Project in child department',
          5,
          'ACTIVE',
          childDeptId,
          childStaffId,
        ]
      );
      const projectId = project.rows[0].id;
      createdProjectIds.push(projectId);

      // Create project in root department
      const rootProject = await pgClient.query(
        `INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW(), NOW())
         RETURNING id`,
        [
          'Root Project',
          'Project in root department',
          5,
          'ACTIVE',
          rootDeptId,
          rootManagerId,
        ]
      );
      const rootProjectId = rootProject.rows[0].id;
      createdProjectIds.push(rootProjectId);

      // Call getVisible endpoint
      const caller = projectRouter.createCaller(createContext(childStaffId));
      const result = await caller.getVisible({ isArchived: false });

      // Should only see project from own department
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Child Project');
      expect(result[0].departmentId).toBe(childDeptId);
    }, 300000);

    it('should return visible projects for MANAGER user', async () => {
      // Create projects in different departments
      const rootProject = await pgClient.query(
        `INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW(), NOW())
         RETURNING id`,
        [
          'Manager Root Project',
          'Project in root department',
          5,
          'ACTIVE',
          rootDeptId,
          rootManagerId,
        ]
      );
      const rootProjectId = rootProject.rows[0].id;
      createdProjectIds.push(rootProjectId);

      const childProject = await pgClient.query(
        `INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW(), NOW())
         RETURNING id`,
        [
          'Manager Child Project',
          'Project in child department',
          5,
          'ACTIVE',
          childDeptId,
          childStaffId,
        ]
      );
      const childProjectId = childProject.rows[0].id;
      createdProjectIds.push(childProjectId);

      // Call getVisible endpoint
      const caller = projectRouter.createCaller(createContext(rootManagerId));
      const result = await caller.getVisible({ isArchived: false });

      // Should see projects from root and child departments
      expect(result.length).toBeGreaterThanOrEqual(2);
      const projectNames = result.map(p => p.name);
      expect(projectNames).toContain('Manager Root Project');
      expect(projectNames).toContain('Manager Child Project');
    }, 300000);

    it('should return all projects for HR_ADMIN user', async () => {
      // Create projects in different departments
      const rootProject = await pgClient.query(
        `INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW(), NOW())
         RETURNING id`,
        [
          'Admin Root Project',
          'Project in root department',
          5,
          'ACTIVE',
          rootDeptId,
          rootManagerId,
        ]
      );
      const rootProjectId = rootProject.rows[0].id;
      createdProjectIds.push(rootProjectId);

      const childProject = await pgClient.query(
        `INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW(), NOW())
         RETURNING id`,
        [
          'Admin Child Project',
          'Project in child department',
          5,
          'ACTIVE',
          childDeptId,
          childStaffId,
        ]
      );
      const childProjectId = childProject.rows[0].id;
      createdProjectIds.push(childProjectId);

      // Call getVisible endpoint
      const caller = projectRouter.createCaller(createContext(adminId));
      const result = await caller.getVisible({ isArchived: false });

      // Should see all projects
      expect(result.length).toBeGreaterThanOrEqual(2);
      const projectNames = result.map(p => p.name);
      expect(projectNames).toContain('Admin Root Project');
      expect(projectNames).toContain('Admin Child Project');
    }, 300000);

    it('should handle archived projects option', async () => {
      // Create and archive a project
      const archivedProject = await pgClient.query(
        `INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, NOW(), NOW())
         RETURNING id`,
        [
          'Archived Project',
          'Archived project',
          5,
          'ACTIVE',
          childDeptId,
          childStaffId,
        ]
      );
      const archivedProjectId = archivedProject.rows[0].id;
      createdProjectIds.push(archivedProjectId);

      // Call getVisible endpoint without archived
      const caller = projectRouter.createCaller(createContext(childStaffId));
      const resultWithoutArchived = await caller.getVisible({
        isArchived: false,
      });

      // Should not see archived project
      const projectNames = resultWithoutArchived.map(p => p.name);
      expect(projectNames).not.toContain('Archived Project');

      // Call getVisible endpoint with archived
      const resultWithArchived = await caller.getVisible({ isArchived: true });

      // Should see archived project
      const archivedProjectNames = resultWithArchived.map(p => p.name);
      expect(archivedProjectNames).toContain('Archived Project');
    }, 300000);

    it('should handle default options when no input provided', async () => {
      // Create a project
      const project = await pgClient.query(
        `INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW(), NOW())
         RETURNING id`,
        [
          'Default Options Project',
          'Project for default options test',
          5,
          'ACTIVE',
          childDeptId,
          childStaffId,
        ]
      );
      const projectId = project.rows[0].id;
      createdProjectIds.push(projectId);

      // Call getVisible endpoint without input
      const caller = projectRouter.createCaller(createContext(childStaffId));
      const result = await caller.getVisible();

      // Should work with default options (isArchived: false)
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Default Options Project');
    }, 300000);

    it('should throw error when user not authenticated', async () => {
      const caller = projectRouter.createCaller(createContext(''));

      await expect(caller.getVisible()).rejects.toThrow(
        'User not authenticated'
      );
    }, 300000);

    it('should throw error when user profile not found', async () => {
      const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
      const caller = projectRouter.createCaller(
        createContext(nonExistentUserId)
      );

      await expect(caller.getVisible()).rejects.toThrow(
        'User profile not found'
      );
    }, 300000);
  });

  describe('Integration with TaskService', () => {
    it('should use TaskService for department hierarchy', async () => {
      // Create a project in child department
      const project = await pgClient.query(
        `INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW(), NOW())
         RETURNING id`,
        [
          'TaskService Integration Project',
          'Project for TaskService integration test',
          5,
          'ACTIVE',
          childDeptId,
          childStaffId,
        ]
      );
      const projectId = project.rows[0].id;
      createdProjectIds.push(projectId);

      // Call getVisible endpoint
      const caller = projectRouter.createCaller(createContext(rootManagerId));
      const result = await caller.getVisible({ isArchived: false });

      // Verify that manager can see projects from child departments
      expect(result.length).toBeGreaterThanOrEqual(1);
      const projectNames = result.map(p => p.name);
      expect(projectNames).toContain('TaskService Integration Project');
    }, 300000);
  });
});
