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
 * Maps priority from 1-10 scale to iCal 1-9 scale
 * Priority 10 (highest) → iCal 1
 * Priority 1 (lowest) → iCal 9
 */
function mapPriorityToICal(priority: number): number {
  return Math.max(1, Math.min(9, 10 - priority));
}

/**
 * Formats a rich description for the iCal event
 * Includes task details, owner, assignees, department, tags, status, priority
 */
function formatDescription(resource: CalendarEvent['resource']): string {
  let desc = '';

  // Task description (if exists)
  if (resource.description) {
    desc += resource.description + '\n\n';
  }

  // Owner info
  if (resource.ownerName) {
    desc += `Owner: ${resource.ownerName}`;
    if (resource.ownerEmail) {
      desc += ` (${resource.ownerEmail})`;
    }
    desc += '\n';
  }

  // Assignees
  if (resource.assigneeDetails && resource.assigneeDetails.length > 0) {
    const assigneeNames = resource.assigneeDetails
      .map(a => a.name || a.email)
      .join(', ');
    desc += `Assigned: ${assigneeNames}\n`;
  }

  // Department
  if (resource.departmentName) {
    desc += `Department: ${resource.departmentName}\n`;
  }

  // Tags
  if (resource.tags && resource.tags.length > 0) {
    desc += `Tags: ${resource.tags.map(t => '#' + t).join(' ')}\n`;
  }

  // Status (always show in description)
  desc += `Status: ${resource.status.replace('_', ' ')}\n`;

  // Priority
  const priorityLabel =
    resource.priority >= 8 ? 'High' : resource.priority >= 5 ? 'Medium' : 'Low';
  desc += `Priority: ${priorityLabel} (${resource.priority}/10)\n`;

  return desc.trim();
}

/**
 * Exports calendar events to iCal (.ics) file format
 *
 * @param events - Array of calendar events to export
 * @param filename - Output filename (default: 'tasks.ics')
 *
 * Business Rules:
 * - Generates valid iCal 2.0 format
 * - Each event includes: title, dates, owner, assignees, tags, recurring rules
 * - All events are marked as all-day events
 * - Status only included for COMPLETED/IN_PROGRESS tasks
 * - Priority converted from 1-10 to iCal 1-9 scale
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

  // Add each task to calendar as VEVENT
  events.forEach(event => {
    // Build event data object dynamically
    const eventData: any = {
      summary: event.title,
      description: formatDescription(event.resource),
      uid: event.resource.taskId,
      due: event.end, // Due date for task
      location: event.resource.departmentName,
      url: 'https://all-in-one-wheat-omega.vercel.app/',
      priority: mapPriorityToICal(event.resource.priority),
      allDay: true, // Use DATE format instead of DATE-TIME
    };

    // Add start date if task has been started
    if (event.resource.isStarted) {
      eventData.start = event.start;
    }

    // Add organizer if owner email exists
    if (event.resource.ownerEmail) {
      eventData.organizer = {
        name: event.resource.ownerName || event.resource.ownerEmail,
        email: event.resource.ownerEmail,
      };
    }

    // Add attendees if assignments exist with valid emails
    if (
      event.resource.assigneeDetails &&
      event.resource.assigneeDetails.length > 0
    ) {
      const validAttendees = event.resource.assigneeDetails.filter(
        a => a.email
      );
      if (validAttendees.length > 0) {
        eventData.attendees = validAttendees.map(a => ({
          name: a.name || a.email,
          email: a.email,
          role: 'REQ-PARTICIPANT',
        }));
      }
    }

    // Add categories (tags) - filter out empty tags and map to category objects
    if (event.resource.tags && event.resource.tags.length > 0) {
      const validTags = event.resource.tags
        .filter(tag => tag && tag.trim())
        .map(tag => ({ name: tag }));
      if (validTags.length > 0) {
        eventData.categories = validTags;
      }
    }

    // Add recurring rule if applicable
    if (event.resource.recurringInterval) {
      eventData.repeating = {
        freq: 'DAILY',
        interval: event.resource.recurringInterval,
      };
    }

    calendar.createEvent(eventData);
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
