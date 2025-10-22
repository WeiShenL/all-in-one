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
 * @param maxOccurrences - Maximum number of occurrences to generate (IGNORED - calculated from task duration)
 * @returns Array of calendar events including base event and future occurrences
 *
 * Business Rules:
 * - Non-recurring tasks (null/0/negative interval): return single event
 * - Recurring tasks: generate forecasts while forecast.start <= original task.end
 * - This creates duration-based forecasts (longer tasks show more forecasts)
 * - Each recurring event gets unique ID: {baseId}-recur-{index}
 * - All metadata preserved across occurrences
 * - Dates calculated using addDays for accurate calendar math
 *
 * Example:
 * - Task: Oct 22 (start) → Oct 25 (end), daily recurring
 * - Forecasts: Oct 23-26, Oct 24-27, Oct 25-28 (3 forecasts)
 * - Stop at Oct 26-29 because start (26) > original end (25)
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
    // console.log('🔄 [FORECAST] Skipping forecasts for completed task:', baseEvent.title);
    return [baseEvent]; // Only show the completed task itself, no forecasts
  }

  // Generate recurring events based on task duration
  // Show forecasts while forecast.start <= original task.end
  const events: CalendarEvent[] = [];
  const originalEnd = baseEvent.end; // Store original task deadline

  // console.log('🔄 [FORECAST] Task:', baseEvent.title);
  // console.log('🔄 [FORECAST] Original: start =', baseEvent.start.toISOString(), ', end =', originalEnd.toISOString());
  // console.log('🔄 [FORECAST] Interval:', recurringInterval, 'days');

  let i = 0;
  let continueGenerating = true;

  while (continueGenerating && i < 100) {
    // Safety limit of 100 to prevent infinite loops
    // Calculate new dates by adding (interval * occurrence_index) days
    const newStart = addDays(baseEvent.start, recurringInterval * i);
    const newEnd = addDays(baseEvent.end, recurringInterval * i);

    // Stop when forecast start date exceeds original task's end date
    if (i > 0 && newStart > originalEnd) {
      // console.log('🔄 [FORECAST] Stopping - forecast start', newStart.toISOString(), '> original end', originalEnd.toISOString());
      continueGenerating = false;
      break;
    }

    // First occurrence keeps original ID, subsequent ones get unique IDs
    const eventId = i === 0 ? baseEvent.id : `${baseEvent.id}-recur-${i}`;

    if (i === 0) {
      // console.log('🔄 [FORECAST] #0 Real task:', newStart.toISOString(), '→', newEnd.toISOString());
    } else {
      // console.log('🔄 [FORECAST] #' + i + ' Forecast:', newStart.toISOString(), '→', newEnd.toISOString());
    }

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

  // console.log('🔄 [FORECAST] Total events generated:', events.length);
  return events;
}
