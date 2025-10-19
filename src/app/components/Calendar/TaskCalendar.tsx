'use client';

import { useMemo, useState, useRef } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Task } from '../TaskTable/types';
import { CalendarEvent } from './types';
import { taskToEvent } from './utils/taskToEvent';
import { exportToICal } from './utils/exportToICal';
import { generateRecurringEvents } from './utils/generateRecurringEvents';
import { TaskCard } from '../TaskCard';
import DayView from './views/DayView';
import AgendaView from './views/AgendaView';
import {
  getStatusColor,
  getPriorityColor,
  getOriginalTaskId,
} from './utils/calendarHelpers';

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
  onTaskUpdated?: () => void;
  showDepartmentFilter?: boolean; // Show department filter for managers
}

/**
 * Custom event style getter - applies visual styling with priority border and recurring indicator
 * Also adds data attributes for E2E testing
 */
function eventStyleGetter(event: CalendarEvent) {
  const isStarted = event.resource.isStarted;
  const isOverdue = event.resource.isOverdue;
  const isRecurring =
    event.resource.recurringInterval && event.resource.recurringInterval > 0;
  const isForecastedRecurrence = event.id.includes('-recur-'); // Forecasted occurrences have "-recur-" in ID

  let backgroundColor: string;
  let borderColor: string;
  let borderWidth: string;

  // Forecasted recurring occurrences (not yet created) use gray
  if (isForecastedRecurrence) {
    backgroundColor = '#cbd5e0'; // Light gray for forecasted recurring
    borderColor = getPriorityColor(event.resource.priority);
    borderWidth = '0 0 0 3px';
  } else if (isOverdue) {
    // Overdue tasks (started after deadline) use orange with red border
    backgroundColor = '#fb923c'; // Orange for overdue
    borderColor = '#dc2626'; // Red border for emphasis
    borderWidth = '2px'; // Thicker border all around
  } else {
    // Always use actual task status for color
    backgroundColor = getStatusColor(event.resource.status);
    borderColor = getPriorityColor(event.resource.priority);
    borderWidth = '0 0 0 3px';
  }

  // Get original task ID (without -recur- suffix)
  const originalId = getOriginalTaskId(event.id);

  return {
    style: {
      backgroundColor,
      opacity: isStarted ? 1.0 : 0.6, // TO_DO tasks lighter
      borderRadius: '4px',
      borderWidth,
      borderStyle: isRecurring ? 'dashed' : 'solid', // Dashed border for recurring
      borderColor,
      color: '#ffffff',
      fontSize: '0.875rem',
      padding: '2px 5px',
    },
    // Add data attributes for E2E testing
    className: `calendar-event calendar-event-${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    'data-task-title': event.title,
    'data-task-id': originalId,
  };
}

/**
 * Custom Event Component - adds recurring symbol and subtask indicator
 */
interface EventComponentProps {
  event: CalendarEvent;
  title: string;
}

function EventComponent({ event, title }: EventComponentProps) {
  const isRecurring =
    event.resource.recurringInterval && event.resource.recurringInterval > 0;
  const isSubtask = event.resource.parentTaskId !== null;

  // Create unique data-testid using both title and event ID to handle multi-day events
  const sanitizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 30);
  // Use the original task ID (without -recur- suffix for recurring instances)
  const originalId = getOriginalTaskId(event.id);
  const testId = `calendar-event-${sanitizedTitle}-${originalId}`;

  return (
    <span
      data-testid={testId}
      data-task-title={title}
      data-task-id={originalId}
    >
      {isSubtask && '↳ '}
      {isRecurring && '🔁 '}
      {title}
    </span>
  );
}

/**
 * Custom Toolbar Component for Calendar Navigation
 *
 * Provides:
 * - View switcher (Month, Week, Day, Agenda)
 * - Navigation controls (Today, Back, Next)
 * - Current date range display
 */
interface CustomToolbarProps {
  label: string;
  onNavigate: (action: 'PREV' | 'NEXT' | 'TODAY') => void;
  onView: (view: View) => void;
  view: View;
}

function CustomToolbar({
  label,
  onNavigate,
  onView,
  view,
}: CustomToolbarProps) {
  return (
    <div style={toolbarStyles.container}>
      {/* Left: Navigation Controls */}
      <div style={toolbarStyles.buttonGroup}>
        <button
          onClick={() => onNavigate('TODAY')}
          style={toolbarStyles.navButton}
          data-testid='nav-today'
        >
          Today
        </button>
        <button
          onClick={() => onNavigate('PREV')}
          style={toolbarStyles.navButton}
          data-testid='nav-back'
        >
          ← Back
        </button>
        <button
          onClick={() => onNavigate('NEXT')}
          style={toolbarStyles.navButton}
          data-testid='nav-next'
        >
          Next →
        </button>
      </div>

      {/* Center: Date Range Label */}
      <div style={toolbarStyles.labelContainer}>
        <h3 style={toolbarStyles.label}>{label}</h3>
      </div>

      {/* Right: View Switcher */}
      <div style={toolbarStyles.buttonGroup}>
        <button
          onClick={() => onView('month')}
          style={{
            ...toolbarStyles.viewButton,
            ...(view === 'month' ? toolbarStyles.viewButtonActive : {}),
          }}
          data-testid='view-month'
        >
          Month
        </button>
        <button
          onClick={() => onView('week')}
          style={{
            ...toolbarStyles.viewButton,
            ...(view === 'week' ? toolbarStyles.viewButtonActive : {}),
          }}
          data-testid='view-week'
        >
          Week
        </button>
        <button
          onClick={() => onView('day')}
          style={{
            ...toolbarStyles.viewButton,
            ...(view === 'day' ? toolbarStyles.viewButtonActive : {}),
          }}
          data-testid='view-day'
        >
          Day
        </button>
        <button
          onClick={() => onView('agenda')}
          style={{
            ...toolbarStyles.viewButton,
            ...(view === 'agenda' ? toolbarStyles.viewButtonActive : {}),
          }}
          data-testid='view-agenda'
        >
          Agenda
        </button>
      </div>
    </div>
  );
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
  onTaskUpdated,
  showDepartmentFilter = false,
}: TaskCalendarProps) {
  // State for calendar view and date navigation
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());

  // State for selected task modal
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  // State for department filter (for managers)
  const [departmentFilter, setDepartmentFilter] = useState<string>('');

  // Extract unique departments from tasks for the filter dropdown
  const departments = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return [];
    }
    const departmentSet = new Set<string>();
    tasks.forEach(task => {
      if (task.department?.name) {
        departmentSet.add(task.department.name);
      }
    });
    return Array.from(departmentSet).sort();
  }, [tasks]);

  // Filter tasks by department if filter is active
  const filteredTasks = useMemo(() => {
    if (!departmentFilter || !showDepartmentFilter) {
      return tasks;
    }
    return tasks.filter(task => task.department?.name === departmentFilter);
  }, [tasks, departmentFilter, showDepartmentFilter]);

  // Custom Day View Wrapper - Passes onSelectTask callback to DayView
  const DayViewWrapper = useMemo(() => {
    const Wrapper = (props: any) => (
      <DayView {...props} onSelectTask={setSelectedTaskId} />
    );
    (Wrapper as any).navigate = (DayView as any).navigate;
    (Wrapper as any).title = (DayView as any).title;
    return Wrapper;
  }, []);

  // Custom Agenda View Wrapper - Passes onSelectTask callback to AgendaView
  const AgendaViewWrapper = useMemo(() => {
    const Wrapper = (props: any) => (
      <AgendaView {...props} onSelectTask={setSelectedTaskId} />
    );
    (Wrapper as any).navigate = (AgendaView as any).navigate;
    (Wrapper as any).title = (AgendaView as any).title;
    (Wrapper as any).range = (AgendaView as any).range;
    return Wrapper;
  }, []);

  // Transform tasks to calendar events with recurring occurrences
  const events: CalendarEvent[] = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) {
      return [];
    }

    const allEvents = filteredTasks.flatMap(task => {
      // Transform using taskToEvent utility
      const baseEvent = taskToEvent({
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
        parentTaskId: task.parentTaskId,
      });

      // Generate recurring occurrences only for non-COMPLETED tasks
      // When a recurring task is COMPLETED, the API creates the next occurrence as a new task
      // So we shouldn't forecast futures from the completed task to avoid duplicates
      if (task.status === 'COMPLETED') {
        return [baseEvent]; // Just show the completed task itself
      }

      // For active tasks (TO_DO, IN_PROGRESS, BLOCKED), generate future occurrences
      return generateRecurringEvents(baseEvent, task.recurringInterval, 12);
    });

    // Sort events for consistent, priority-aware display across all views
    return allEvents.sort((a, b) => {
      // 1. Completed tasks go to the bottom
      const aCompleted = a.resource.status === 'COMPLETED';
      const bCompleted = b.resource.status === 'COMPLETED';
      if (aCompleted && !bCompleted) {
        return 1;
      }
      if (!aCompleted && bCompleted) {
        return -1;
      }

      // 2. Sort by due date (earliest first)
      const dateCompare = a.end.getTime() - b.end.getTime();
      if (dateCompare !== 0) {
        return dateCompare;
      }

      // 3. Sort by priority (high to low: 10→1)
      const priorityCompare = b.resource.priority - a.resource.priority;
      if (priorityCompare !== 0) {
        return priorityCompare;
      }

      // 4. Alphabetically by title (tie-breaker)
      return a.title.localeCompare(b.title);
    });
  }, [filteredTasks]);

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
    <div style={styles.container} data-testid='task-calendar'>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .rbc-time-header-gutter,
        .rbc-time-gutter,
        .rbc-current-time-indicator {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          max-width: 0 !important;
        }
        .rbc-time-content {
          margin-left: 0 !important;
        }
        .rbc-time-header-content {
          margin-left: 0 !important;
        }
        .rbc-time-header {
          margin-left: 0 !important;
        }
        .rbc-time-header > .rbc-row {
          margin-left: 0 !important;
        }
        .rbc-allday-cell {
          padding-left: 0 !important;
        }
        .rbc-time-content > * > * > .rbc-day-slot {
          padding-left: 0 !important;
        }

        /* Hover effects */
        .rbc-event {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .rbc-event:hover {
          transform: scale(1.02);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
          z-index: 10;
        }

        /* Week/Day view optimization: Hide empty time grid, expand all-day section */
        .rbc-time-view .rbc-time-content {
          display: none !important;
        }

        .rbc-time-view .rbc-time-header {
          flex: 1 !important;
          min-height: 700px !important;
          overflow: visible !important;
        }

        .rbc-time-view .rbc-allday-cell {
          min-height: 700px !important;
          max-height: none !important;
          position: relative !important;
        }

        /* Make all-day events more prominent in week/day views */
        .rbc-time-view .rbc-row-segment {
          padding: 4px 4px !important;
        }

        .rbc-time-view .rbc-event {
          min-height: 28px !important;
          padding: 4px 8px !important;
        }

        /* Kanban card hover effects */
        .kanban-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }

        /* Agenda card hover effects */
        .agenda-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .agenda-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }

        /* Month view: Limit "show more" popup to 10 items with scroll */
        .rbc-overlay {
          max-height: 400px !important;
          overflow-y: auto !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
          padding: 0 !important;
        }
        .rbc-overlay-header {
          position: sticky !important;
          top: 0 !important;
          background: white !important;
          z-index: 1 !important;
          border-bottom: 1px solid #e2e8f0 !important;
          padding: 8px 12px !important;
          font-weight: 600 !important;
          margin: 0 !important;
        }
        .rbc-overlay > * {
          margin: 0 !important;
        }

        /* Week view: Add scrolling for all-day section when content exceeds height */
        .rbc-time-view .rbc-allday-cell {
          overflow-y: auto !important;
          max-height: 700px !important;
        }

        /* Week view: Extend vertical lines between dates through scrollable area */
        .rbc-time-view .rbc-row-bg {
          display: flex !important;
          height: 100% !important;
        }
        .rbc-time-view .rbc-day-bg {
          border-right: 1px solid #ddd !important;
          flex: 1 !important;
        }
        .rbc-time-view .rbc-day-bg:last-child {
          border-right: none !important;
        }

        /* Make sure header columns also have borders */
        .rbc-time-view .rbc-header {
          border-right: 1px solid #ddd !important;
        }
        .rbc-time-view .rbc-header:last-child {
          border-right: none !important;
        }

        /* Custom scrollbar styling */
        .rbc-overlay::-webkit-scrollbar,
        .rbc-time-view .rbc-allday-cell::-webkit-scrollbar {
          width: 8px;
        }
        .rbc-overlay::-webkit-scrollbar-track,
        .rbc-time-view .rbc-allday-cell::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        .rbc-overlay::-webkit-scrollbar-thumb,
        .rbc-time-view .rbc-allday-cell::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 4px;
        }
        .rbc-overlay::-webkit-scrollbar-thumb:hover,
        .rbc-time-view .rbc-allday-cell::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }
      `,
        }}
      />

      <div style={styles.header}>
        <h2 style={styles.title}>{title}</h2>
        <div style={styles.headerActions}>
          {showDepartmentFilter && departments.length > 0 && (
            <div style={styles.filterContainer}>
              <label htmlFor='department-filter' style={styles.filterLabel}>
                Department:
              </label>
              <select
                id='department-filter'
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value)}
                style={styles.filterSelect}
                data-testid='department-filter'
              >
                <option value=''>All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button onClick={handleExport} style={styles.exportButton}>
            📥 Export to iCal
          </button>
        </div>
      </div>

      <div style={styles.calendarWrapper}>
        <Calendar
          localizer={localizer}
          events={events as any}
          startAccessor='start'
          endAccessor='end'
          style={styles.calendar}
          eventPropGetter={eventStyleGetter as any}
          views={{
            month: true,
            week: true,
            day: DayViewWrapper as any,
            agenda: AgendaViewWrapper as any,
          }}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          onSelectEvent={(event: any) =>
            setSelectedTaskId(getOriginalTaskId(event.id))
          }
          components={{
            toolbar: CustomToolbar,
            event: EventComponent as any,
          }}
          allDayAccessor={() => true}
          step={60}
          timeslots={1}
          formats={{
            timeGutterFormat: () => '',
            eventTimeRangeFormat: () => '',
            agendaTimeRangeFormat: () => '',
          }}
          popup
          tooltipAccessor={(event: any) => {
            return `${event.title}\nStatus: ${event.resource.status}\nPriority: ${event.resource.priority}/10`;
          }}
        />
      </div>

      {/* Task Card Modal */}
      {selectedTaskId && (
        <div
          style={styles.modalOverlay}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setSelectedTaskId(null);
            }
          }}
        >
          <div style={styles.modalContent} ref={modalContentRef}>
            <button
              onClick={() => setSelectedTaskId(null)}
              style={styles.closeButton}
            >
              ×
            </button>
            <TaskCard
              taskId={selectedTaskId}
              onTaskChange={newTaskId => setSelectedTaskId(newTaskId)}
              onTaskUpdated={() => {
                setSelectedTaskId(null);
                onTaskUpdated?.();
              }}
            />
          </div>
        </div>
      )}

      <div style={styles.legend}>
        <h4 style={styles.legendTitle}>Legend:</h4>
        <div style={styles.legendItems}>
          <div style={styles.legendItem}>
            <span
              style={{
                ...styles.legendColor,
                backgroundColor: '#E8C0FA',
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
          <div style={styles.legendItem}>
            <span
              style={{
                ...styles.legendColor,
                backgroundColor: '#fb923c',
                border: '2px solid #dc2626',
              }}
            ></span>
            <span>⚠️ OVERDUE (started late)</span>
          </div>
          <div style={styles.legendItem}>
            <span
              style={{
                ...styles.legendColor,
                backgroundColor: '#805ad5',
              }}
            ></span>
            <span>🔁 RECURRING</span>
          </div>
          <div style={styles.legendItem}>
            <span
              style={{
                ...styles.legendColor,
                backgroundColor: '#edf2f7',
              }}
            >
              ↳
            </span>
            <span>SUBTASK</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const toolbarStyles = {
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    backgroundColor: '#f7fafc',
    borderRadius: '6px',
    marginBottom: '1rem',
    gap: '1rem',
    flexWrap: 'wrap' as const,
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  labelContainer: {
    flex: '1',
    textAlign: 'center' as const,
    minWidth: '200px',
  },
  label: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#2d3748',
    margin: 0,
  },
  navButton: {
    padding: '0.5rem 1rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#4a5568',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  viewButton: {
    padding: '0.5rem 1rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#4a5568',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  viewButtonActive: {
    backgroundColor: '#4299e1',
    color: '#ffffff',
    borderColor: '#4299e1',
    fontWeight: 600,
  },
};

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
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  filterContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  filterLabel: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#4a5568',
  },
  filterSelect: {
    padding: '0.5rem 1rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#4a5568',
    cursor: 'pointer',
    transition: 'all 0.2s',
    minWidth: '200px',
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
    height: '800px',
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
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    position: 'relative' as const,
    background: 'white',
    padding: '2rem',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '900px',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    backgroundClip: 'padding-box',
  },
  closeButton: {
    position: 'absolute' as const,
    top: '1rem',
    right: '1rem',
    padding: '0.5rem',
    backgroundColor: '#e2e8f0',
    color: '#4a5568',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer' as const,
    fontWeight: 600,
    fontSize: '1rem',
    lineHeight: 1,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
