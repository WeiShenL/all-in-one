'use client';

import { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Task } from '../TaskTable/types';
import { CalendarEvent } from './types';
import { taskToEvent } from './utils/taskToEvent';
import { exportToICal } from './utils/exportToICal';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface TaskCalendarProps {
  tasks: Task[];
  title?: string;
  emptyStateConfig?: {
    icon: string;
    title: string;
    description: string;
  };
  isLoading?: boolean;
  error?: Error | null;
}

/**
 * Get status-based background color
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'IN_PROGRESS':
      return '#3182ce'; // Blue
    case 'COMPLETED':
      return '#38a169'; // Green
    case 'BLOCKED':
      return '#e53e3e'; // Red
    case 'TO_DO':
    default:
      return '#cbd5e0'; // Light gray
  }
}

/**
 * Custom event style getter - applies visual styling based on isStarted flag
 */
function eventStyleGetter(event: CalendarEvent) {
  const isStarted = event.resource.isStarted;
  const backgroundColor = isStarted
    ? getStatusColor(event.resource.status)
    : '#cbd5e0'; // Light gray for not started

  return {
    style: {
      backgroundColor,
      opacity: isStarted ? 1.0 : 0.6, // TO_DO tasks lighter
      borderRadius: '4px',
      border: 'none',
      color: '#ffffff',
      fontSize: '0.875rem',
      padding: '2px 5px',
    },
  };
}

/**
 * TaskCalendar Component
 *
 * Reusable calendar component for displaying tasks (mirrors TaskTable pattern)
 *
 * Features:
 * - Transforms tasks using taskToEvent utility
 * - Visual styling based on isStarted flag (TO_DO lighter, others normal)
 * - Export to iCal functionality
 * - Multiple views: Month, Week, Day, Agenda
 *
 * Display Logic:
 * - TO_DO tasks (no startDate): Show from createdAt with lighter styling (opacity 0.6, gray)
 * - IN_PROGRESS/BLOCKED/COMPLETED (has startDate): Show from startDate with normal styling
 */
export function TaskCalendar({
  tasks,
  title = 'Task Calendar',
  emptyStateConfig = {
    icon: '📅',
    title: 'No tasks to display',
    description: 'Tasks will appear here once they are created.',
  },
  isLoading = false,
  error = null,
}: TaskCalendarProps) {
  // Transform tasks to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return [];
    }

    return tasks.map(task => {
      // Transform using taskToEvent utility
      // This applies the startDate ?? createdAt logic automatically
      return taskToEvent({
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        startDate: task.startDate,
        status: task.status,
        priorityBucket: task.priorityBucket,
        owner: task.owner,
        department: task.department,
        assignments: task.assignments,
        tags: task.tags,
        recurringInterval: task.recurringInterval,
      });
    });
  }, [tasks]);

  // Handle export
  const handleExport = () => {
    exportToICal(events, 'tasks.ics');
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingState}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading calendar...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorState}>
          <p style={styles.errorIcon}>⚠️</p>
          <p style={styles.errorTitle}>Error loading calendar</p>
          <p style={styles.errorMessage}>{error.message}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (events.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <p style={styles.emptyIcon}>{emptyStateConfig.icon}</p>
          <h3 style={styles.emptyTitle}>{emptyStateConfig.title}</h3>
          <p style={styles.emptyDescription}>{emptyStateConfig.description}</p>
        </div>
      </div>
    );
  }

  // Render calendar
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>{title}</h2>
        <button onClick={handleExport} style={styles.exportButton}>
          📥 Export to iCal
        </button>
      </div>

      <div style={styles.calendarWrapper}>
        <Calendar
          localizer={localizer}
          events={events as any}
          startAccessor='start'
          endAccessor='end'
          style={styles.calendar}
          eventPropGetter={eventStyleGetter as any}
          views={['month', 'week', 'day', 'agenda']}
          defaultView='month'
          popup
          tooltipAccessor={(event: any) => {
            return `${event.title}\nStatus: ${event.resource.status}\nPriority: ${event.resource.priority}/10`;
          }}
        />
      </div>

      <div style={styles.legend}>
        <h4 style={styles.legendTitle}>Legend:</h4>
        <div style={styles.legendItems}>
          <div style={styles.legendItem}>
            <span
              style={{
                ...styles.legendColor,
                backgroundColor: '#cbd5e0',
                opacity: 0.6,
              }}
            ></span>
            <span>TO_DO (not started)</span>
          </div>
          <div style={styles.legendItem}>
            <span
              style={{
                ...styles.legendColor,
                backgroundColor: '#3182ce',
              }}
            ></span>
            <span>IN_PROGRESS</span>
          </div>
          <div style={styles.legendItem}>
            <span
              style={{
                ...styles.legendColor,
                backgroundColor: '#38a169',
              }}
            ></span>
            <span>COMPLETED</span>
          </div>
          <div style={styles.legendItem}>
            <span
              style={{
                ...styles.legendColor,
                backgroundColor: '#e53e3e',
              }}
            ></span>
            <span>BLOCKED</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#ffffff',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    marginBottom: '1rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#2d3748',
    margin: 0,
  },
  exportButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#4299e1',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  calendarWrapper: {
    height: '600px',
    marginBottom: '1.5rem',
  },
  calendar: {
    height: '100%',
  },
  legend: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#f7fafc',
    borderRadius: '6px',
  },
  legendTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#4a5568',
    margin: '0 0 0.5rem 0',
  },
  legendItems: {
    display: 'flex',
    gap: '1.5rem',
    flexWrap: 'wrap' as const,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: '#4a5568',
  },
  legendColor: {
    width: '16px',
    height: '16px',
    borderRadius: '3px',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #4299e1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '1rem',
    color: '#718096',
    fontSize: '0.875rem',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '4rem 2rem',
  },
  errorIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  errorTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#e53e3e',
    marginBottom: '0.5rem',
  },
  errorMessage: {
    color: '#718096',
    fontSize: '0.875rem',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '4rem 2rem',
  },
  emptyIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  emptyTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#2d3748',
    marginBottom: '0.5rem',
  },
  emptyDescription: {
    color: '#718096',
    fontSize: '0.875rem',
    textAlign: 'center' as const,
  },
};
