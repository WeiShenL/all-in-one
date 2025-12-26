/**
 * @jest-environment node
 */
import { GET } from '@/app/api/cron/route';
import { NextRequest } from 'next/server';
import { TaskNotificationService } from '@/app/server/services/TaskNotificationService';
import { NotificationService } from '@/app/server/services/NotificationService';
import { RealtimeService } from '@/app/server/services/RealtimeService';
import { EmailService } from '@/app/server/services/EmailService';

// Mock all the services
jest.mock('@/app/server/services/TaskNotificationService');
jest.mock('@/app/server/services/NotificationService');
jest.mock('@/app/server/services/RealtimeService');
jest.mock('@/app/server/services/EmailService');
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    task: {},
    notification: {},
    userProfile: {},
  },
}));

describe('Cron Route Handler', () => {
  let mockTaskNotificationService: jest.Mocked<TaskNotificationService>;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment to original state
    process.env = { ...originalEnv };

    // Setup mock services
    mockTaskNotificationService = {
      sendDeadlineReminders: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TaskNotificationService>;

    // Mock the constructors to return our mocked instances
    (
      TaskNotificationService as jest.MockedClass<
        typeof TaskNotificationService
      >
    ).mockImplementation(() => mockTaskNotificationService);
    (
      NotificationService as jest.MockedClass<typeof NotificationService>
    ).mockImplementation(() => ({}) as NotificationService);
    (
      RealtimeService as jest.MockedClass<typeof RealtimeService>
    ).mockImplementation(() => ({}) as RealtimeService);
    (EmailService as jest.MockedClass<typeof EmailService>).mockImplementation(
      () => ({}) as EmailService
    );

    // Clear all mocks
    jest.clearAllMocks();

    // Clear console mocks
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Authorization', () => {
    describe('Production environment', () => {
      beforeEach(() => {
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: 'production',
          configurable: true,
        });
        Object.defineProperty(process.env, 'CRON_SECRET', {
          value: 'test-secret-token',
          configurable: true,
        });
      });

      it('should return 401 when authorization header is missing', async () => {
        const request = new NextRequest('http://localhost:3000/api/cron', {
          method: 'GET',
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized' });
        expect(
          mockTaskNotificationService.sendDeadlineReminders
        ).not.toHaveBeenCalled();
        // Logger outputs structured log messages with timestamp and context
        expect(console.warn).toHaveBeenCalled();
      });

      it('should return 401 when authorization token is incorrect', async () => {
        const request = new NextRequest('http://localhost:3000/api/cron', {
          method: 'GET',
          headers: {
            authorization: 'Bearer wrong-token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized' });
        expect(
          mockTaskNotificationService.sendDeadlineReminders
        ).not.toHaveBeenCalled();
        // Logger outputs structured log messages with timestamp and context
        expect(console.warn).toHaveBeenCalled();
      });

      it('should succeed when authorization token is correct', async () => {
        const request = new NextRequest('http://localhost:3000/api/cron', {
          method: 'GET',
          headers: {
            authorization: 'Bearer test-secret-token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
          message: 'Cron job completed successfully.',
          timestamp: expect.any(String),
        });
        expect(
          mockTaskNotificationService.sendDeadlineReminders
        ).toHaveBeenCalledTimes(1);
      });

      it('should log warning with user-agent when unauthorized', async () => {
        const request = new NextRequest('http://localhost:3000/api/cron', {
          method: 'GET',
          headers: {
            authorization: 'Bearer wrong-token',
            'user-agent': 'Test Bot/1.0',
          },
        });

        await GET(request);

        // Logger outputs structured log messages with user-agent in context
        expect(console.warn).toHaveBeenCalled();
        const warnCall = (console.warn as jest.Mock).mock.calls[0][0];
        expect(warnCall).toContain('SECURITY');
        expect(warnCall).toContain('Test Bot/1.0');
      });
    });

    describe('Development environment', () => {
      beforeEach(() => {
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: 'development',
          configurable: true,
        });
        process.env.CRON_SECRET = 'test-secret-token';
      });

      it('should fail without CRON_SECRET set', async () => {
        delete process.env.CRON_SECRET;

        const request = new NextRequest('http://localhost:3000/api/cron', {
          method: 'GET',
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({ error: 'Server misconfiguration' });
        expect(
          mockTaskNotificationService.sendDeadlineReminders
        ).not.toHaveBeenCalled();
      });

      it('should succeed with correct authorization token', async () => {
        const request = new NextRequest('http://localhost:3000/api/cron', {
          method: 'GET',
          headers: {
            authorization: 'Bearer test-secret-token',
          },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
          message: 'Cron job completed successfully.',
          timestamp: expect.any(String),
        });
        expect(
          mockTaskNotificationService.sendDeadlineReminders
        ).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Service Initialization', () => {
    beforeEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        configurable: true,
      });
      process.env.CRON_SECRET = 'test-secret-token';
    });

    it('should initialize all required services', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-secret-token',
        },
      });

      await GET(request);

      // Verify that all service constructors were called
      expect(EmailService).toHaveBeenCalledTimes(1);
      expect(RealtimeService).toHaveBeenCalledTimes(1);
      expect(NotificationService).toHaveBeenCalledTimes(1);
      expect(TaskNotificationService).toHaveBeenCalledTimes(1);
    });

    it('should pass correct dependencies to TaskNotificationService', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-secret-token',
        },
      });

      await GET(request);

      // Verify TaskNotificationService was instantiated with correct arguments
      expect(TaskNotificationService).toHaveBeenCalledWith(
        expect.anything(), // prisma
        expect.any(Object), // notificationService
        expect.any(Object), // realtimeService
        expect.any(Object) // emailService
      );
    });
  });

  describe('Cron Job Execution', () => {
    beforeEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        configurable: true,
      });
      process.env.CRON_SECRET = 'test-secret-token';
    });

    it('should call sendDeadlineReminders successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-secret-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        message: 'Cron job completed successfully.',
        timestamp: expect.any(String),
      });
      expect(
        mockTaskNotificationService.sendDeadlineReminders
      ).toHaveBeenCalledTimes(1);
      // Logger outputs structured messages with INFO level
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalled();
    });

    it('should include timestamp in success response', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-secret-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('string');
      // Verify it's a valid ISO timestamp
      expect(() => new Date(data.timestamp)).not.toThrow();
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it('should log start and completion timestamps', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-secret-token',
        },
      });

      await GET(request);

      // Logger outputs structured messages
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        configurable: true,
      });
      process.env.CRON_SECRET = 'test-secret-token';
    });

    it('should return 500 when sendDeadlineReminders throws an error', async () => {
      const testError = new Error('Database connection failed');
      mockTaskNotificationService.sendDeadlineReminders.mockRejectedValueOnce(
        testError
      );

      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-secret-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        message: 'Cron job failed.',
        error: 'Database connection failed',
      });
    });

    it('should log error details when job fails', async () => {
      const testError = new Error('Service unavailable');
      testError.stack = 'Error: Service unavailable\n  at test.ts:123';
      mockTaskNotificationService.sendDeadlineReminders.mockRejectedValueOnce(
        testError
      );

      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-secret-token',
        },
      });

      await GET(request);

      // Logger outputs structured error messages
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockTaskNotificationService.sendDeadlineReminders.mockRejectedValueOnce(
        'String error'
      );

      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-secret-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        message: 'Cron job failed.',
        error: 'Unknown error',
      });
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle null error gracefully', async () => {
      mockTaskNotificationService.sendDeadlineReminders.mockRejectedValueOnce(
        null
      );

      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-secret-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        message: 'Cron job failed.',
        error: 'Unknown error',
      });
    });

    it('should include error timestamp in logs', async () => {
      const testError = new Error('Test error');
      mockTaskNotificationService.sendDeadlineReminders.mockRejectedValueOnce(
        testError
      );

      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-secret-token',
        },
      });

      await GET(request);

      // Logger outputs structured messages with timestamps
      expect(console.error).toHaveBeenCalled();
      const errorCall = (console.error as jest.Mock).mock.calls[0][0];
      expect(errorCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        configurable: true,
      });
      Object.defineProperty(process.env, 'CRON_SECRET', {
        value: 'test-secret',
        configurable: true,
      });
    });

    it('should fail with token that has no Bearer prefix', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'test-secret',
        },
      });

      const response = await GET(request);

      // Should fail because there's no 'Bearer ' prefix
      expect(response.status).toBe(401);
    });

    it('should handle case-sensitive bearer token', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'bearer test-secret', // lowercase 'bearer'
        },
      });

      const response = await GET(request);

      // Should fail because 'bearer' !== 'Bearer'
      expect(response.status).toBe(401);
    });

    it('should handle missing CRON_SECRET environment variable', async () => {
      Object.defineProperty(process.env, 'CRON_SECRET', {
        value: undefined,
        configurable: true,
      });

      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer some-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      // Should fail with 500 because CRON_SECRET is required (not 401)
      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Server misconfiguration' });
    });

    it('should also fail when CRON_SECRET is undefined even with matching auth', async () => {
      Object.defineProperty(process.env, 'CRON_SECRET', {
        value: undefined,
        configurable: true,
      });

      const request = new NextRequest('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer undefined',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      // Should fail with 500 because CRON_SECRET must be configured
      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Server misconfiguration' });
    });
  });
});
