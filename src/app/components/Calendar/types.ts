/**
 * Calendar Component Type Definitions
 *
 * Defines the shape of calendar events and view types
 */

import { TaskStatus } from '@prisma/client';

/**
 * Calendar Event - Presentation model for tasks in calendar view
 * Transformed from Task domain entity via taskToEvent utility
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    taskId: string;
    status: TaskStatus;
    priority: number;
    isCompleted: boolean;
    departmentId: string;
    assignees: string[];
  };
}

/**
 * View types supported by the calendar
 */
export type CalendarViewType = 'month' | 'week' | 'day';

/**
 * Props for CalendarView component
 */
export interface CalendarViewProps {
  tasks: any[]; // Will be typed more specifically when integrated
  onEventClick?: (taskId: string) => void;
  initialView?: CalendarViewType;
}
