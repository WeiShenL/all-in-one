/**
 * @jest-environment node
 *
 * Integration Tests for NotificationService
 *
 * Test Pattern: NotificationService -> EmailService -> Real Database
 * Uses pg client for database operations
 *
 * Each test gets a fresh database with complete isolation
 */

import { Client } from 'pg';
import { NotificationService } from '@/app/server/services/NotificationService';
import { EmailService } from '@/app/server/services/EmailService';
import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';

const prisma = new PrismaClient();
let pgClient: Client;
let notificationService: NotificationService;
let emailService: EmailService;

// Mock the Resend SDK
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

let mockResendSend: jest.Mock;

describe('NotificationService Integration Tests', () => {
  beforeAll(async () => {
    pgClient = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
    });
    await pgClient.connect();
    emailService = new EmailService();
    notificationService = new NotificationService(emailService);
    mockResendSend = (Resend as jest.Mock).mock.results[0].value.emails.send;
  });

  afterAll(async () => {
    await pgClient.end();
    await prisma.$disconnect();
  });

  it('should send a deadline reminder for a task due in 23 hours', async () => {
    // Create test department
    const deptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), 'Test Notification Dept', true, NOW(), NOW())
       RETURNING id`
    );
    const testDepartmentId = deptResult.rows[0].id;

    // Create test user
    const userResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), 'notification-user@test.com', 'Notification User', 'STAFF', $1, true, NOW(), NOW())
       RETURNING id`,
      [testDepartmentId]
    );
    const testUserId = userResult.rows[0].id;

    const now = new Date();
    const dueDate = new Date(now.getTime() + 23 * 60 * 60 * 1000);

    const taskResult = await pgClient.query(
      `INSERT INTO "task" (id, title, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt", description)
       VALUES (gen_random_uuid(), 'Due Soon Task', $1, $2, $3, 'TO_DO', NOW(), NOW(), 'Test Description')
       RETURNING id`,
      [dueDate, testUserId, testDepartmentId]
    );
    const testTaskId = taskResult.rows[0].id;

    await pgClient.query(
      `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById")
       VALUES ($1, $2, $2)`,
      [testTaskId, testUserId]
    );

    await notificationService.sendDeadlineReminders(now);

    // Check for email
    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['notification-user@test.com'],
        subject: 'Task Deadline Reminder: Due Soon Task',
      })
    );

    // Check for in-app notification
    const notificationResult = await pgClient.query(
      'SELECT * FROM "notification" WHERE "userId" = $1 AND "taskId" = $2',
      [testUserId, testTaskId]
    );
    expect(notificationResult.rows.length).toBe(1);
    const notification = notificationResult.rows[0];
    expect(notification.type).toBe('DEADLINE_REMINDER');
    expect(notification.title).toBe('Task Deadline Reminder');
    expect(notification.message).toBe('Your task "Due Soon Task" is due in less than 24 hours.');

    // Cleanup
    await pgClient.query('DELETE FROM "task" WHERE id = $1', [testTaskId]);
    await pgClient.query('DELETE FROM "notification" WHERE "userId" = $1', [testUserId]);
    await pgClient.query('DELETE FROM "user_profile" WHERE id = $1', [testUserId]);
    await pgClient.query('DELETE FROM "department" WHERE id = $1', [testDepartmentId]);
  }, 30000);
});