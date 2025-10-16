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
 * - Extracts all owner, department, assignee, and tag details for iCal export
 *
 * Display Logic:
 * - TO_DO tasks (no startDate): Show from createdAt with lighter styling
 * - IN_PROGRESS/BLOCKED/COMPLETED tasks (has startDate): Show from startDate with normal styling
 */
export function taskToEvent(task: TaskFromAPI): CalendarEvent {
  const createdAt = new Date(task.createdAt);
  const dueDate = new Date(task.dueDate);
  const startDate = task.startDate ? new Date(task.startDate) : null;

  return {
    id: task.id,
    title: task.title,
    start: startDate || createdAt, // Use startDate if work began, otherwise creation date
    end: dueDate, // Task deadline
    resource: {
      taskId: task.id,
      status: task.status,
      priority: task.priorityBucket,
      isCompleted: task.status === 'COMPLETED',
      isStarted: startDate !== null, // Flag for visual styling
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
    },
  };
}
