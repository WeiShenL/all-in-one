/**
 * PriorityBucket Value Object
 *
 * Encapsulates priority level (1-10 scale) with validation
 * Using Value Object pattern for type safety and business rule enforcement
 */

import { InvalidPriorityError } from './errors/TaskErrors';

export class PriorityBucket {
  private readonly level: number;

  private constructor(level: number) {
    this.level = level;
  }

  /**
   * Validate if a priority level is valid (1-10)
   */
  static isValid(level: number): boolean {
    return Number.isInteger(level) && level >= 1 && level <= 10;
  }

  /**
   * Factory method to create a PriorityBucket
   * Validates that priority is between 1-10 and is an integer
   */
  static create(level: number): PriorityBucket {
    if (!PriorityBucket.isValid(level)) {
      throw new InvalidPriorityError();
    }
    return new PriorityBucket(level);
  }

  /**
   * Get all priority buckets (1-10)
   */
  static getAllPriorities(): PriorityBucket[] {
    return Array.from({ length: 10 }, (_, i) => PriorityBucket.create(i + 1));
  }

  /**
   * Get the priority level as a number
   */
  getLevel(): number {
    return this.level;
  }

  /**
   * Get the human-readable label for this priority level
   * 1-3: Low, 4-6: Medium, 7-8: High, 9-10: Critical
   */
  getLabel(): string {
    if (this.level <= 3) {
      return 'Low';
    }
    if (this.level <= 6) {
      return 'Medium';
    }
    if (this.level <= 8) {
      return 'High';
    }
    return 'Critical';
  }

  /**
   * Get the color code for this priority level
   * Low: Gray, Medium: Blue, High: Orange, Critical: Red
   */
  getColor(): string {
    if (this.level <= 3) {
      return '#6B7280';
    } // Gray
    if (this.level <= 6) {
      return '#2563EB';
    } // Blue
    if (this.level <= 8) {
      return '#EA580C';
    } // Orange
    return '#DC2626'; // Red
  }

  /**
   * Get a description of what this priority level means
   */
  getDescription(): string {
    const descriptions: Record<number, string> = {
      1: 'Lowest priority - Can be done when time permits',
      2: 'Low priority - Should be addressed eventually',
      3: 'Below normal priority - Address after higher priority items',
      4: 'Normal priority - Standard work item',
      5: 'Medium priority - Should be done in reasonable timeframe',
      6: 'Above normal priority - Should be prioritized',
      7: 'High priority - Needs attention soon',
      8: 'Very high priority - Important and time-sensitive',
      9: 'Critical priority - Urgent, needs immediate attention',
      10: 'Highest priority - Drop everything else',
    };
    return descriptions[this.level];
  }

  /**
   * Compare priority with another PriorityBucket
   */
  isHigherThan(other: PriorityBucket): boolean {
    return this.level > other.level;
  }

  /**
   * Check if this is a high priority task (8-10)
   */
  isHigh(): boolean {
    return this.level >= 8;
  }

  /**
   * Check if this is a medium priority task (4-7)
   */
  isMedium(): boolean {
    return this.level >= 4 && this.level <= 7;
  }

  /**
   * Check if this is a low priority task (1-3)
   */
  isLow(): boolean {
    return this.level <= 3;
  }

  /**
   * Compare this priority with another
   * Returns -1 if this < other, 0 if equal, 1 if this > other
   */
  compareTo(other: PriorityBucket): number {
    if (this.level < other.level) {
      return -1;
    }
    if (this.level > other.level) {
      return 1;
    }
    return 0;
  }

  /**
   * Check if two priority buckets are equal (same level)
   */
  equals(other: PriorityBucket): boolean {
    return this.level === other.level;
  }

  /**
   * String representation of the priority bucket
   */
  toString(): string {
    return `Priority ${this.level} (${this.getLabel()})`;
  }
}
