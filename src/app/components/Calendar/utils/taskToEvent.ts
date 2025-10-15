/**
 * Task to Calendar Event Transformation Utility
 *
 * Application Service: Transforms Task domain entity to CalendarEvent presentation model
 */

import { CalendarEvent } from '../types';
import { TaskStatus } from '@prisma/client';

/**
 * Task shape from API (getUserTasks, getDepartmentTasksForUser)
 */
interface TaskFromAPI {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO 8601 string
  status: TaskStatus;
  priority: number;
  departmentId: string;
  assignments: Array<{ userId: string }>;
}

/**
 * Converts a Task domain entity to a CalendarEvent presentation model
 *
 * @param task - Task from API response
 * @returns CalendarEvent suitable for react-big-calendar
 *
 * Business Rules:
 * - Tasks are same-day events (start === end)
 * - isCompleted is true only when status === 'COMPLETED'
 * - Assignees are extracted from assignments array
 */
export function taskToEvent(task: TaskFromAPI): CalendarEvent {
  const dueDate = new Date(task.dueDate);

  return {
    id: task.id,
    title: task.title,
    start: dueDate,
    end: dueDate, // Same-day event
    resource: {
      taskId: task.id,
      status: task.status,
      priority: task.priority,
      isCompleted: task.status === 'COMPLETED',
      departmentId: task.departmentId,
      assignees: task.assignments.map(assignment => assignment.userId),
    },
  };
}
