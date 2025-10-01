/**
 * Tests for PriorityBucket Value Object
 * Priority 2 - OOP.ts compliance (lines 266-285)
 */

import { PriorityBucket } from '../../../../src/domain/task/PriorityBucket';

describe('PriorityBucket', () => {
  describe('create()', () => {
    it('should create priority bucket with level 1', () => {
      const priority = PriorityBucket.create(1);

      expect(priority.getLevel()).toBe(1);
      expect(priority.getLabel()).toBe('Low');
    });

    it('should create priority bucket with level 10', () => {
      const priority = PriorityBucket.create(10);

      expect(priority.getLevel()).toBe(10);
      expect(priority.getLabel()).toBe('Critical');
    });

    it('should create all levels 1-10', () => {
      for (let level = 1; level <= 10; level++) {
        const priority = PriorityBucket.create(level);
        expect(priority.getLevel()).toBe(level);
      }
    });

    it('should throw error for level 0', () => {
      expect(() => PriorityBucket.create(0)).toThrow();
    });

    it('should throw error for level 11', () => {
      expect(() => PriorityBucket.create(11)).toThrow();
    });

    it('should throw error for negative level', () => {
      expect(() => PriorityBucket.create(-5)).toThrow();
    });

    it('should throw error for non-integer level', () => {
      expect(() => PriorityBucket.create(5.5)).toThrow();
    });
  });

  describe('Labels', () => {
    it('should label 1-3 as Low', () => {
      expect(PriorityBucket.create(1).getLabel()).toBe('Low');
      expect(PriorityBucket.create(2).getLabel()).toBe('Low');
      expect(PriorityBucket.create(3).getLabel()).toBe('Low');
    });

    it('should label 4-6 as Medium', () => {
      expect(PriorityBucket.create(4).getLabel()).toBe('Medium');
      expect(PriorityBucket.create(5).getLabel()).toBe('Medium');
      expect(PriorityBucket.create(6).getLabel()).toBe('Medium');
    });

    it('should label 7-8 as High', () => {
      expect(PriorityBucket.create(7).getLabel()).toBe('High');
      expect(PriorityBucket.create(8).getLabel()).toBe('High');
    });

    it('should label 9-10 as Critical', () => {
      expect(PriorityBucket.create(9).getLabel()).toBe('Critical');
      expect(PriorityBucket.create(10).getLabel()).toBe('Critical');
    });
  });

  describe('Colors', () => {
    it('should have color for each level', () => {
      for (let level = 1; level <= 10; level++) {
        const priority = PriorityBucket.create(level);
        expect(priority.getColor()).toMatch(/^#[0-9A-F]{6}$/i);
      }
    });

    it('should have red color for critical (9-10)', () => {
      const p9 = PriorityBucket.create(9);
      const p10 = PriorityBucket.create(10);
      expect(p9.getColor()).toBe('#DC2626');
      expect(p10.getColor()).toBe('#DC2626');
    });

    it('should have orange color for high (7-8)', () => {
      const p7 = PriorityBucket.create(7);
      const p8 = PriorityBucket.create(8);
      expect(p7.getColor()).toBe('#EA580C');
      expect(p8.getColor()).toBe('#EA580C');
    });
  });

  describe('Description', () => {
    it('should have description for each level', () => {
      for (let level = 1; level <= 10; level++) {
        const priority = PriorityBucket.create(level);
        expect(priority.getDescription()).toBeTruthy();
        expect(priority.getDescription().length).toBeGreaterThan(0);
      }
    });
  });

  describe('isValid()', () => {
    it('should validate levels 1-10 as true', () => {
      for (let level = 1; level <= 10; level++) {
        expect(PriorityBucket.isValid(level)).toBe(true);
      }
    });

    it('should validate level 0 as false', () => {
      expect(PriorityBucket.isValid(0)).toBe(false);
    });

    it('should validate level 11 as false', () => {
      expect(PriorityBucket.isValid(11)).toBe(false);
    });

    it('should validate negative numbers as false', () => {
      expect(PriorityBucket.isValid(-1)).toBe(false);
    });

    it('should validate non-integers as false', () => {
      expect(PriorityBucket.isValid(5.5)).toBe(false);
    });
  });

  describe('compareTo()', () => {
    it('should return -1 when this < other', () => {
      const p5 = PriorityBucket.create(5);
      const p8 = PriorityBucket.create(8);

      expect(p5.compareTo(p8)).toBe(-1);
    });

    it('should return 1 when this > other', () => {
      const p8 = PriorityBucket.create(8);
      const p5 = PriorityBucket.create(5);

      expect(p8.compareTo(p5)).toBe(1);
    });

    it('should return 0 when this == other', () => {
      const p5a = PriorityBucket.create(5);
      const p5b = PriorityBucket.create(5);

      expect(p5a.compareTo(p5b)).toBe(0);
    });
  });

  describe('isHigherThan()', () => {
    it('should return true when this > other', () => {
      const p8 = PriorityBucket.create(8);
      const p5 = PriorityBucket.create(5);

      expect(p8.isHigherThan(p5)).toBe(true);
    });

    it('should return false when this < other', () => {
      const p5 = PriorityBucket.create(5);
      const p8 = PriorityBucket.create(8);

      expect(p5.isHigherThan(p8)).toBe(false);
    });

    it('should return false when this == other', () => {
      const p5a = PriorityBucket.create(5);
      const p5b = PriorityBucket.create(5);

      expect(p5a.isHigherThan(p5b)).toBe(false);
    });
  });

  describe('equals()', () => {
    it('should return true when levels are equal', () => {
      const p5a = PriorityBucket.create(5);
      const p5b = PriorityBucket.create(5);

      expect(p5a.equals(p5b)).toBe(true);
    });

    it('should return false when levels are different', () => {
      const p5 = PriorityBucket.create(5);
      const p8 = PriorityBucket.create(8);

      expect(p5.equals(p8)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should return string representation', () => {
      const p5 = PriorityBucket.create(5);

      const str = p5.toString();
      expect(str).toContain('5');
      expect(str).toContain('Medium');
    });
  });

  describe('getAllPriorities()', () => {
    it('should return all 10 priority buckets', () => {
      const all = PriorityBucket.getAllPriorities();

      expect(all).toHaveLength(10);
      expect(all[0].getLevel()).toBe(1);
      expect(all[9].getLevel()).toBe(10);
    });
  });

  describe('Value Object Properties', () => {
    it('should maintain same level throughout lifetime', () => {
      const priority = PriorityBucket.create(5);

      // Verify level is consistent
      expect(priority.getLevel()).toBe(5);
      expect(priority.getLevel()).toBe(5); // Multiple calls return same value
      expect(priority.getLabel()).toBe('Medium');
      expect(priority.getLabel()).toBe('Medium'); // Immutable
    });

    it('should create independent instances', () => {
      const p5a = PriorityBucket.create(5);
      const p5b = PriorityBucket.create(5);

      // Same level but different instances
      expect(p5a).not.toBe(p5b); // Different object references
      expect(p5a.equals(p5b)).toBe(true); // But equal values
    });
  });
});
