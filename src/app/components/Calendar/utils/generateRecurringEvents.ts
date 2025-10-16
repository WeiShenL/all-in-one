/**
 * Recurring Events Generation Utility
 *
 * Application Service: Generates future occurrences of recurring tasks for calendar display
 */

import { addDays } from 'date-fns';
import { CalendarEvent } from '../types';

/**
 * Generates recurring event occurrences based on recurringInterval
 *
 * @param baseEvent - The original calendar event (from taskToEvent)
 * @param recurringInterval - Days between recurrences (from Task.recurringInterval), null if non-recurring
 * @param maxOccurrences - Maximum number of occurrences to generate (default: 12)
 * @returns Array of calendar events including base event and future occurrences
 *
 * Business Rules:
 * - Non-recurring tasks (null/0/negative interval): return single event
 * - Recurring tasks: generate up to maxOccurrences events
 * - Each recurring event gets unique ID: {baseId}-recur-{index}
 * - All metadata preserved across occurrences
 * - Dates calculated using addDays for accurate calendar math
 */
export function generateRecurringEvents(
  baseEvent: CalendarEvent,
  recurringInterval: number | null | undefined,
  maxOccurrences: number = 12
): CalendarEvent[] {
  // Handle maxOccurrences = 0
  if (maxOccurrences === 0) {
    return [];
  }

  // Handle non-recurring tasks
  if (
    recurringInterval === null ||
    recurringInterval === undefined ||
    recurringInterval <= 0
  ) {
    return [baseEvent];
  }

  // Generate recurring events
  const events: CalendarEvent[] = [];

  for (let i = 0; i < maxOccurrences; i++) {
    // Calculate new dates by adding (interval * occurrence_index) days
    const newStart = addDays(baseEvent.start, recurringInterval * i);
    const newEnd = addDays(baseEvent.end, recurringInterval * i);

    // First occurrence keeps original ID, subsequent ones get unique IDs
    const eventId = i === 0 ? baseEvent.id : `${baseEvent.id}-recur-${i}`;

    events.push({
      id: eventId,
      title: baseEvent.title,
      start: newStart,
      end: newEnd,
      resource: {
        taskId: baseEvent.resource.taskId,
        status: baseEvent.resource.status,
        priority: baseEvent.resource.priority,
        isCompleted: baseEvent.resource.isCompleted,
        departmentId: baseEvent.resource.departmentId,
        assignees: [...baseEvent.resource.assignees], // Create new array to avoid mutation
      },
    });
  }

  return events;
}
