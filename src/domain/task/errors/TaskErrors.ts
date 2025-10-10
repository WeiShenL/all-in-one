/**
 * Task Domain Errors
 *
 * Custom error classes for task-related business rule violations
 */

export class UnauthorizedError extends Error {
  constructor(
    message: string = 'User is not authorized to perform this action'
  ) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class InvalidTitleError extends Error {
  constructor() {
    super('Task title must be between 1 and 255 characters');
    this.name = 'InvalidTitleError';
  }
}

export class InvalidPriorityError extends Error {
  constructor() {
    super('Priority must be between 1 and 10');
    this.name = 'InvalidPriorityError';
  }
}

export class MaxAssigneesReachedError extends Error {
  constructor() {
    super('Maximum of 5 assignees allowed per task');
    this.name = 'MaxAssigneesReachedError';
  }
}

export class InvalidRecurrenceError extends Error {
  constructor() {
    super('Recurrence days must be greater than 0 when recurring is enabled');
    this.name = 'InvalidRecurrenceError';
  }
}

export class InvalidSubtaskDeadlineError extends Error {
  constructor() {
    super('Subtask deadline cannot be after parent task deadline');
    this.name = 'InvalidSubtaskDeadlineError';
  }
}

export class FileSizeLimitExceededError extends Error {
  constructor() {
    super('Total file size cannot exceed 50MB per task');
    this.name = 'FileSizeLimitExceededError';
  }
}

export class InvalidFileTypeError extends Error {
  constructor() {
    super(
      'File type not allowed. Only images, PDFs, docs, and spreadsheets are supported'
    );
    this.name = 'InvalidFileTypeError';
  }
}
