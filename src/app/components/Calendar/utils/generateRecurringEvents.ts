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
 * @param maxOccurrences - Maximum number of occurrences to generate (IGNORED - capped at 2)
 * @returns Array of calendar events including base event and future occurrences
 *
 * Business Rules:
 * - Non-recurring tasks (null/0/negative interval): return single event
 * - Recurring tasks: always show exactly 2 instances (original + 1 forecast)
 * - Keeps calendar clean and consistent regardless of interval
 * - Each recurring event gets unique ID: {baseId}-recur-{index}
 * - All metadata preserved across occurrences
 * - Dates calculated using addDays for accurate calendar math
 *
 * Example:
 * - Task: Oct 22 (start) → Oct 25 (end), daily recurring
 * - Shows: Oct 22-25 (original), Oct 23-26 (forecast)
 * - Task: Oct 22 (start) → Oct 29 (end), weekly recurring
 * - Shows: Oct 22-29 (original), Oct 29-Nov 5 (forecast)
 */
export function generateRecurringEvents(
  baseEvent: CalendarEvent,
  recurringInterval: number | null | undefined,
  maxOccurrences: number = 12 // Still accept parameter for backward compatibility, but ignore it
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

  // ⚠️ FIX: Don't generate forecast occurrences for COMPLETED tasks
  // Completed tasks already created their next instance via backend
  if (baseEvent.resource.status === 'COMPLETED') {
    return [baseEvent]; // Only show the completed task itself, no forecasts
  }

  // Generate recurring events (capped at 2 total instances)
  // Shows original + 1 forecast to keep calendar clean
  const events: CalendarEvent[] = [];

  let i = 0;
  const continueGenerating = true;

  while (continueGenerating && i < 2) {
    // Cap at 2 total instances (original + 1 forecast)
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
        ...baseEvent.resource, // Preserve all resource fields including recurringInterval
      },
    });

    i++;
  }

  return events;
}
