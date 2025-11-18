/**
 * Centralized Logging Service
 *
 * Provides structured, consistent logging across the application.
 * Replaces direct console.log/console.error calls for better:
 * - Production monitoring
 * - Log aggregation
 * - Debugging and troubleshooting
 * - Integration with external services (Sentry, DataDog, etc.)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private serviceName: string;
  private isDevelopment: boolean;

  constructor(serviceName = 'app') {
    this.serviceName = serviceName;
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Creates a child logger with a specific service name
   */
  child(serviceName: string): Logger {
    return new Logger(serviceName);
  }

  /**
   * Formats log message with timestamp and context
   */
  private format(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.serviceName}]`;

    if (context && Object.keys(context).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(context)}`;
    }

    return `${prefix} ${message}`;
  }

  /**
   * Logs debug information (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.debug(this.format('debug', message, context));
    }
  }

  /**
   * Logs general information
   */
  info(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.log(this.format('info', message, context));
  }

  /**
   * Logs warnings that need attention
   */
  warn(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.warn(this.format('warn', message, context));
  }

  /**
   * Logs errors that need immediate attention
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      ...(error instanceof Error && {
        errorMessage: error.message,
        errorStack: error.stack,
        errorName: error.name,
      }),
    };

    console.error(this.format('error', message, errorContext));

    // In production, send to error tracking service (e.g., Sentry)
    if (!this.isDevelopment && error instanceof Error) {
      // TODO: Integrate with error tracking service
      // Sentry.captureException(error, { extra: context });
    }
  }

  /**
   * Logs performance metrics
   */
  perf(operation: string, durationMs: number, context?: LogContext): void {
    this.info(`Performance: ${operation}`, {
      durationMs,
      ...context,
    });
  }

  /**
   * Logs security events
   */
  security(message: string, context?: LogContext): void {
    this.warn(`SECURITY: ${message}`, context);
  }
}

// Default logger instance
export const logger = new Logger();

/**
 * Create a logger for a specific service/module
 *
 * @example
 * import { createLogger } from '@/lib/logger';
 * const logger = createLogger('TaskService');
 * logger.info('Task created successfully', { taskId: '123' });
 */
export function createLogger(serviceName: string): Logger {
  return new Logger(serviceName);
}

/**
 * Usage examples:
 *
 * // Basic logging
 * logger.info('Server started successfully');
 * logger.warn('Database connection slow', { latencyMs: 500 });
 * logger.error('Failed to process request', error, { userId: '123' });
 *
 * // Service-specific logger
 * const taskLogger = createLogger('TaskService');
 * taskLogger.info('Task created', { taskId: '123', userId: 'abc' });
 *
 * // Performance tracking
 * const start = Date.now();
 * // ... operation ...
 * logger.perf('database-query', Date.now() - start, { query: 'getTasks' });
 *
 * // Security events
 * logger.security('Unauthorized access attempt', { ip: '1.2.3.4' });
 */
