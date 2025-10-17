/**
 * Domain Errors for Project Entity
 * These errors represent business rule violations at the domain level
 */

/**
 * Thrown when project name validation fails (AC3)
 */
export class InvalidProjectNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProjectNameError';
  }
}

/**
 * Thrown when priority is outside valid range (1-10)
 */
export class InvalidPriorityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPriorityError';
  }
}

/**
 * Thrown when required fields are missing
 */
export class InvalidProjectDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProjectDataError';
  }
}
