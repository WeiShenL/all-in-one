import { PrismaClient } from '@prisma/client';

/**
 * Abstract Base Service Class
 *
 * Provides common functionality for all service classes including:
 * - Prisma client access
 * - Common error handling patterns
 * - Reusable database operations
 *
 * All entity-specific services should extend this class.
 */
export abstract class BaseService {
  protected prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Handles errors consistently across all services
   * @param error - The error to handle
   * @param context - Additional context about where the error occurred
   */
  protected handleError(
    error: unknown,
    context: string,
    shouldThrow: boolean = true
  ): void {
    console.error(`[${this.constructor.name}] Error in ${context}:`, error);

    if (shouldThrow) {
      if (error instanceof Error) {
        throw new Error(`${context}: ${error.message}`);
      }

      throw new Error(`${context}: An unknown error occurred`);
    }
  }

  /**
   * Validates that a required ID is provided
   * @param id - The ID to validate
   * @param fieldName - Name of the field for error messages
   */
  protected validateId(
    id: string | undefined | null,
    fieldName = 'id'
  ): asserts id is string {
    if (!id || id.trim() === '') {
      throw new Error(`${fieldName} is required`);
    }
  }
}
