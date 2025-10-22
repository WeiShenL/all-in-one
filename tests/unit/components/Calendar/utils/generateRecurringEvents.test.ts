/**
 *
 * Recurring Task Event Generation
 *
 * Testing generation of recurring task occurrences for calendar display
 * Based on Task.recurringInterval field (days between recurrences)
 */

import { generateRecurringEvents } from '@/app/components/Calendar/utils/generateRecurringEvents';
import { CalendarEvent } from '@/app/components/Calendar/types';

describe('generateRecurringEvents', () => {
  const baseEvent: CalendarEvent = {
    id: 'task-123',
    title: 'Weekly team standup',
    start: new Date('2025-10-20T10:00:00.000Z'),
    end: new Date('2025-10-27T10:00:00.000Z'), // 7-day duration for duration-based forecast logic
    resource: {
      taskId: 'task-123',
      status: 'TO_DO',
      priority: 5,
      isCompleted: false,
      isStarted: false,
      isOverdue: false,
      description: 'Weekly standup meeting',
      createdAt: new Date('2025-10-15T00:00:00.000Z'),
      departmentName: 'Engineering',
      ownerName: 'John Doe',
      ownerEmail: 'john@example.com',
      assigneeDetails: [{ name: 'User 1', email: 'user1@example.com' }],
      tags: [],
      recurringInterval: null,
      parentTaskId: null,
    },
  };

  describe('Non-recurring tasks', () => {
    it('should return single event when recurringInterval is null', () => {
      const events = generateRecurringEvents(baseEvent, null);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(baseEvent);
    });

    it('should return single event when recurringInterval is undefined', () => {
      const events = generateRecurringEvents(baseEvent, undefined);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(baseEvent);
    });

    it('should return single event when recurringInterval is 0', () => {
      const events = generateRecurringEvents(baseEvent, 0);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(baseEvent);
    });

    it('should return single event when recurringInterval is negative', () => {
      const events = generateRecurringEvents(baseEvent, -7);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(baseEvent);
    });
  });

  describe('Weekly recurring tasks (interval: 7 days)', () => {
    it('should generate occurrences based on task duration', () => {
      const events = generateRecurringEvents(baseEvent, 7);

      // Duration-based: 7-day task with 7-day interval = 2 events
      // Original: Oct 20-27, Forecast: Oct 27-Nov 3, stops when next starts Nov 3 > Oct 27 (end)
      expect(events).toHaveLength(2);
    });

    it('should include base event as first occurrence', () => {
      const events = generateRecurringEvents(baseEvent, 7);

      expect(events[0].id).toBe('task-123');
      expect(events[0].start).toEqual(new Date('2025-10-20T10:00:00.000Z'));
      expect(events[0].end).toEqual(new Date('2025-10-27T10:00:00.000Z'));
    });

    it('should generate subsequent events 7 days apart', () => {
      const events = generateRecurringEvents(baseEvent, 7);

      // Second occurrence: +7 days
      expect(events[1].start).toEqual(new Date('2025-10-27T10:00:00.000Z'));
      expect(events[1].end).toEqual(new Date('2025-11-03T10:00:00.000Z'));
    });

    it('should give recurring events unique IDs', () => {
      const events = generateRecurringEvents(baseEvent, 7);

      expect(events[0].id).toBe('task-123'); // Base event keeps original ID
      expect(events[1].id).toBe('task-123-recur-1');
    });

    it('should preserve all resource metadata in recurring events', () => {
      const events = generateRecurringEvents(baseEvent, 7);

      events.forEach(event => {
        expect(event.title).toBe('Weekly team standup');
        expect(event.resource.taskId).toBe('task-123');
        expect(event.resource.status).toBe('TO_DO');
        expect(event.resource.priority).toBe(5);
        expect(event.resource.isCompleted).toBe(false);
        expect(event.resource.departmentName).toBe('Engineering');
        expect(event.resource.assigneeDetails).toEqual([
          { name: 'User 1', email: 'user1@example.com' },
        ]);
      });
    });
  });

  describe('Bi-weekly recurring tasks (interval: 14 days)', () => {
    it('should generate events based on duration (only original)', () => {
      const events = generateRecurringEvents(baseEvent, 14);

      // 7-day duration, 14-day interval: next starts Nov 3 > Oct 27 (end) → only 1 event
      expect(events).toHaveLength(1);

      // Check original
      expect(events[0].start).toEqual(new Date('2025-10-20T10:00:00.000Z'));
      expect(events[0].end).toEqual(new Date('2025-10-27T10:00:00.000Z'));
    });
  });

  describe('Monthly recurring tasks (interval: 30 days)', () => {
    it('should generate events based on duration (only original)', () => {
      const events = generateRecurringEvents(baseEvent, 30);

      // 7-day duration, 30-day interval: next starts Nov 19 > Oct 27 (end) → only 1 event
      expect(events).toHaveLength(1);

      // Check original
      expect(events[0].start).toEqual(new Date('2025-10-20T10:00:00.000Z'));
      expect(events[0].end).toEqual(new Date('2025-10-27T10:00:00.000Z'));
    });
  });

  describe('Custom maxOccurrences parameter', () => {
    it('should ignore maxOccurrences (deprecated - uses duration now)', () => {
      const events = generateRecurringEvents(baseEvent, 7, 3);

      // maxOccurrences is ignored, uses duration-based logic instead
      expect(events).toHaveLength(2); // Based on 7-day duration, not maxOccurrences
      expect(events[0].id).toBe('task-123');
      expect(events[1].id).toBe('task-123-recur-1');
    });

    it('should ignore maxOccurrences of 1', () => {
      const events = generateRecurringEvents(baseEvent, 7, 1);

      // maxOccurrences ignored, returns based on duration
      expect(events).toHaveLength(2);
    });

    it('should ignore maxOccurrences of 24', () => {
      const events = generateRecurringEvents(baseEvent, 7, 24);

      // maxOccurrences ignored, returns based on duration
      expect(events).toHaveLength(2);
    });

    it('should handle maxOccurrences of 0 (return empty array)', () => {
      const events = generateRecurringEvents(baseEvent, 7, 0);

      // maxOccurrences = 0 is special case, still returns empty
      expect(events).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle daily recurrence (interval: 1)', () => {
      const events = generateRecurringEvents(baseEvent, 1, 5);

      // 7-day duration, 1-day interval: Oct 20, 21, 22, 23, 24, 25, 26, 27 = 8 events
      expect(events).toHaveLength(8);
      expect(events[0].start).toEqual(new Date('2025-10-20T10:00:00.000Z'));
      expect(events[1].start).toEqual(new Date('2025-10-21T10:00:00.000Z'));
      expect(events[2].start).toEqual(new Date('2025-10-22T10:00:00.000Z'));
      expect(events[3].start).toEqual(new Date('2025-10-23T10:00:00.000Z'));
      expect(events[4].start).toEqual(new Date('2025-10-24T10:00:00.000Z'));
      expect(events[5].start).toEqual(new Date('2025-10-25T10:00:00.000Z'));
      expect(events[6].start).toEqual(new Date('2025-10-26T10:00:00.000Z'));
      expect(events[7].start).toEqual(new Date('2025-10-27T10:00:00.000Z'));
    });

    it('should handle large intervals (interval: 90 days)', () => {
      const events = generateRecurringEvents(baseEvent, 90, 4);

      // 7-day duration, 90-day interval: only original (next starts day 90 >> day 27)
      expect(events).toHaveLength(1);
      expect(events[0].start).toEqual(new Date('2025-10-20T10:00:00.000Z'));
      expect(events[0].end).toEqual(new Date('2025-10-27T10:00:00.000Z'));
    });

    it('should NOT generate forecasts for completed tasks', () => {
      const completedEvent: CalendarEvent = {
        ...baseEvent,
        resource: {
          ...baseEvent.resource,
          status: 'COMPLETED',
          isCompleted: true,
        },
      };

      const events = generateRecurringEvents(completedEvent, 7, 3);

      // Completed tasks don't generate forecasts (prevents duplicates)
      expect(events).toHaveLength(1);
      expect(events[0].resource.isCompleted).toBe(true);
    });

    it('should not mutate the original base event', () => {
      const originalEvent = { ...baseEvent };

      generateRecurringEvents(baseEvent, 7);

      expect(baseEvent).toEqual(originalEvent);
    });
  });

  describe('Date boundary handling', () => {
    it('should correctly handle month boundaries', () => {
      const endOfMonthEvent: CalendarEvent = {
        ...baseEvent,
        start: new Date('2025-10-31T10:00:00.000Z'),
        end: new Date('2025-11-07T10:00:00.000Z'), // 7-day duration
      };

      const events = generateRecurringEvents(endOfMonthEvent, 7, 5);

      // 7-day duration, 7-day interval: 2 events
      expect(events).toHaveLength(2);
      expect(events[0].start).toEqual(new Date('2025-10-31T10:00:00.000Z'));
      expect(events[0].end).toEqual(new Date('2025-11-07T10:00:00.000Z'));
      expect(events[1].start).toEqual(new Date('2025-11-07T10:00:00.000Z')); // +7 days
      expect(events[1].end).toEqual(new Date('2025-11-14T10:00:00.000Z'));
    });

    it('should correctly handle year boundaries', () => {
      const endOfYearEvent: CalendarEvent = {
        ...baseEvent,
        start: new Date('2025-12-31T10:00:00.000Z'),
        end: new Date('2026-01-07T10:00:00.000Z'), // 7-day duration, crosses year
      };

      const events = generateRecurringEvents(endOfYearEvent, 7, 3);

      // 7-day duration, 7-day interval: 2 events
      expect(events).toHaveLength(2);
      expect(events[0].start).toEqual(new Date('2025-12-31T10:00:00.000Z'));
      expect(events[0].end).toEqual(new Date('2026-01-07T10:00:00.000Z'));
      expect(events[1].start).toEqual(new Date('2026-01-07T10:00:00.000Z')); // +7 days, crosses year
      expect(events[1].end).toEqual(new Date('2026-01-14T10:00:00.000Z'));
    });
  });
});
