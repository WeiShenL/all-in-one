/**
 * Calendar Helper Functions
 *
 * Shared utility functions used across calendar components
 */

/**
 * Get status-based background color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'IN_PROGRESS':
      return '#3182ce'; // Blue
    case 'COMPLETED':
      return '#38a169'; // Green
    case 'BLOCKED':
      return '#e53e3e'; // Red
    case 'TO_DO':
    default:
      return '#E8C0FA'; // Light purple
  }
}

/**
 * Get priority color for left border indicator
 */
export function getPriorityColor(priority: number): string {
  if (priority >= 8) {
    return '#dc2626';
  } // High priority - Red
  if (priority >= 5) {
    return '#f59e0b';
  } // Medium priority - Orange
  return '#10b981'; // Low priority - Green
}

/**
 * Extract original task ID from event ID
 * Recurring occurrences have IDs like "abc123-recur-1", "abc123-recur-2"
 * This function strips the "-recur-X" suffix to get the original task ID
 */
export function getOriginalTaskId(eventId: string): string {
  return eventId.split('-recur-')[0];
}
