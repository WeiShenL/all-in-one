/**
 * Database Setup/Teardown Helper for Integration Tests
 *
 * Industry-standard approach:
 * - Each test file gets its own Prisma instance for isolation
 * - Seed ONLY base infrastructure (departments, users, projects)
 * - Each test creates its own task-specific data
 * - Full reset between tests for complete isolation
 */

import { PrismaClient } from '@prisma/client';

/**
 * Clear all tables in correct order (respecting FK constraints)
 */
export async function clearDatabase(prisma: PrismaClient) {
  // Handle circular dependency between Department and UserProfile
  // Department.managerId -> UserProfile.id
  // UserProfile.departmentId -> Department.id

  // First, break the circular dependency by nullifying Department.managerId
  await prisma.department.updateMany({
    data: { managerId: null },
  });

  // Now delete in correct order respecting remaining FK constraints
  await prisma.$transaction([
    prisma.taskLog.deleteMany({}),
    prisma.taskFile.deleteMany({}),
    prisma.comment.deleteMany({}),
    prisma.taskTag.deleteMany({}),
    prisma.tag.deleteMany({}),
    prisma.taskAssignment.deleteMany({}),
    prisma.task.deleteMany({}),
    prisma.project.deleteMany({}),
    prisma.teamMember.deleteMany({}),
    prisma.team.deleteMany({}),
    prisma.userProfile.deleteMany({}),
    prisma.department.deleteMany({}),
  ]);
}

/**
 * Seed ONLY base infrastructure data (departments, users, projects)
 * Tests will create their own task-specific data
 *
 * This is the industry-standard approach:
 * - Base fixtures are READ-ONLY shared data
 * - Test-specific data is created in each test
 */
export async function seedTestData(prisma: PrismaClient) {
  // 1. Create Departments (shared infrastructure)
  await prisma.department.createMany({
    data: [
      {
        id: 'dept-engineering',
        name: 'Engineering',
        parentId: null,
      },
      {
        id: 'dept-hr',
        name: 'HR',
        parentId: null,
      },
    ],
  });

  // 2. Create Users (shared infrastructure)
  await prisma.userProfile.createMany({
    data: [
      {
        id: '10000000-0000-4000-8000-000000000001',
        email: 'staff@test.com',
        name: 'Test Staff (Owner)',
        role: 'STAFF',
        departmentId: 'dept-engineering',
      },
      {
        id: '10000000-0000-4000-8000-000000000002',
        email: 'staff2@test.com',
        name: 'Test Staff 2 (Assignee)',
        role: 'STAFF',
        departmentId: 'dept-engineering',
      },
      {
        id: '10000000-0000-4000-8000-000000000003',
        email: 'manager@test.com',
        name: 'Test Manager',
        role: 'MANAGER',
        departmentId: 'dept-engineering',
      },
      {
        id: '10000000-0000-4000-8000-000000000004',
        email: 'other@test.com',
        name: 'Other Dept Staff',
        role: 'STAFF',
        departmentId: 'dept-hr',
      },
      {
        id: '10000000-0000-4000-8000-000000000005',
        email: 'staff3@test.com',
        name: 'Test Staff 3',
        role: 'STAFF',
        departmentId: 'dept-engineering',
      },
    ],
  });

  // 3. Create Project (shared infrastructure)
  await prisma.project.create({
    data: {
      id: 'proj-001',
      name: 'Test Project',
      description: 'Test project for integration testing',
      departmentId: 'dept-engineering',
      creatorId: '10000000-0000-4000-8000-000000000001',
      status: 'ACTIVE',
    },
  });

  // NOTE: Tasks are NOT created here!
  // Each test will create its own task with specific data for that scenario
  // This provides:
  // - Complete test isolation
  // - Flexibility for different scenarios
  // - Self-documenting tests (you see exactly what data exists)
}

/**
 * Full database reset: Clear + Seed
 * Use this in beforeEach for complete test isolation
 */
export async function resetAndSeedDatabase(prisma: PrismaClient) {
  await clearDatabase(prisma);
  await seedTestData(prisma);
}
