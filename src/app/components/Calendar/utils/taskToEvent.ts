/**
 * Task to Calendar Event Transformation Utility
 *
 * Application Service: Transforms Task domain entity to CalendarEvent presentation model
 */

import { CalendarEvent } from '../types';
import { TaskStatus } from '@prisma/client';

/**
 * Task shape from API (getUserTasks, getDepartmentTasksForUser)
 * Updated to match standardized API structure after API standardization work
 */
interface TaskFromAPI {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO 8601 string
  createdAt: string; // ISO 8601 string
  startDate: string | null; // ISO 8601 string - When work began (IN_PROGRESS first time)
  status: TaskStatus;
  priorityBucket: number; // 1-10 scale
  owner: {
    id: string;
    name: string | null;
    email: string | null;
  };
  department: {
    id: string;
    name: string;
  };
  assignments: Array<{
    userId: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }>;
  tags: string[];
  recurringInterval: number | null;
  parentTaskId: string | null; // If not null, this is a subtask
}

/**
 * Converts a Task domain entity to a CalendarEvent presentation model
 *
 * @param task - Task from API response (getUserTasks or getDepartmentTasksForUser)
 * @returns CalendarEvent suitable for react-big-calendar and iCal export
 *
 * Business Rules:
 * - start = startDate (when work began) if exists, otherwise createdAt (task creation)
 * - end = task deadline (dueDate) for iCal DTEND
 * - isCompleted is true only when status === 'COMPLETED'
 * - isStarted is true when startDate exists (work has begun on task)
 * - isOverdue is true when task started after deadline (startDate > dueDate)
 * - Extracts all owner, department, assignee, and tag details for iCal export
 *
 * Display Logic:
 * - TO_DO tasks (no startDate): Show from createdAt with lighter styling
 * - IN_PROGRESS/BLOCKED/COMPLETED tasks (has startDate): Show from startDate with normal styling
 * - Overdue tasks (startDate > dueDate): Show from dueDate → startDate to ensure visibility
 *
 * Overdue Handling (Industry Standard):
 * 1. Task started after deadline (e.g., due Oct 20, started Oct 21):
 *    - Store actual dates: startDate = Oct 21, dueDate = Oct 20
 *    - Display range: Show from dueDate (Oct 20) to startDate (Oct 21)
 *    - Visual indicator: Orange background + red border to indicate "started late"
 * 2. Task deadline passed, not started (e.g., due Oct 20, today Oct 22, status TO_DO):
 *    - Display range: Show from createdAt to dueDate (normal positioning in past)
 *    - Visual indicator: Orange background + red border to indicate "overdue and not started"
 * - Exception: COMPLETED tasks are never flagged as overdue (show completion status instead)
 * - This ensures tasks remain visible in calendar views while preserving data accuracy
 */
export function taskToEvent(task: TaskFromAPI): CalendarEvent {
  const createdAt = new Date(task.createdAt);
  const dueDate = new Date(task.dueDate);
  const startDate = task.startDate ? new Date(task.startDate) : null;

  // Handle overdue tasks (started after deadline)
  let displayStart: Date;
  let displayEnd: Date;
  let isOverdue = false;

  if (startDate && startDate > dueDate) {
    // Task started late - show from dueDate to startDate
    displayStart = dueDate;
    displayEnd = startDate;
    // Only flag as overdue if NOT completed (completed tasks show as "done", not "late")
    isOverdue = task.status !== 'COMPLETED';
  } else {
    // Normal case
    displayStart = startDate || createdAt;
    displayEnd = dueDate;

    // Check if deadline has passed for non-completed tasks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDateNormalized = new Date(dueDate);
    dueDateNormalized.setHours(0, 0, 0, 0);

    if (dueDateNormalized < today && task.status !== 'COMPLETED') {
      isOverdue = true;
    }
  }

  return {
    id: task.id,
    title: task.title,
    start: displayStart,
    end: displayEnd,
    resource: {
      taskId: task.id,
      status: task.status,
      priority: task.priorityBucket,
      isCompleted: task.status === 'COMPLETED',
      isStarted: startDate !== null, // Flag for visual styling
      isOverdue: isOverdue, // Flag for overdue styling
      description: task.description,
      createdAt: createdAt,
      departmentName: task.department.name,
      ownerName: task.owner.name || 'Unknown Owner',
      ownerEmail: task.owner.email || 'noreply@example.com',
      assigneeDetails: task.assignments.map(assignment => ({
        name: assignment.user.name || 'Unknown',
        email: assignment.user.email || 'noreply@example.com',
      })),
      tags: task.tags,
      recurringInterval: task.recurringInterval,
      parentTaskId: task.parentTaskId, // For identifying subtasks
    },
  };
}
