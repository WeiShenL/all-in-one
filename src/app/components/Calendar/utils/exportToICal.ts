/**
 * iCal Export Utility
 *
 * Application Service: Exports calendar events to iCal (.ics) format
 * Following DDD: Application layer export functionality
 * Supports AC: CIT004 (export currently displayed tasks to iCal format)
 */

import ical from 'ical-generator';
import { CalendarEvent } from '../types';

/**
 * Exports calendar events to iCal (.ics) file format
 *
 * @param events - Array of calendar events to export
 * @param filename - Output filename (default: 'tasks.ics')
 *
 * Business Rules:
 * - Generates valid iCal 2.0 format
 * - Each event includes: title, dates, status, priority
 * - Triggers browser download of .ics file
 * - Cleans up blob URL after download
 *
 * Usage:
 * exportToICal(calendarEvents, 'my-tasks.ics');
 */
export function exportToICal(
  events: CalendarEvent[],
  filename: string = 'tasks.ics'
): void {
  // Create iCal calendar
  const calendar = ical({
    name: 'Task Calendar',
    prodId: '//All-In-One Task Manager//Task Calendar//EN',
  });

  // Add each event to calendar
  events.forEach(event => {
    calendar.createEvent({
      start: event.start,
      end: event.end,
      summary: event.title,
      description: `Status: ${event.resource.status}\nPriority: ${event.resource.priority}`,
      uid: event.resource.taskId, // Use taskId for unique identifier
    });
  });

  // Generate iCal string
  const icalString = calendar.toString();

  // Create Blob with correct MIME type
  const blob = new Blob([icalString], { type: 'text/calendar' });

  // Create object URL
  const url = window.URL.createObjectURL(blob);

  // Create temporary link element for download
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Append to body (required for Firefox)
  document.body.appendChild(link);

  // Trigger download
  link.click();

  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
