'use client';

import { useMemo, useState, useRef } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import {
  format,
  parse,
  startOfWeek,
  getDay,
  isSameDay,
  isWithinInterval,
  startOfDay,
  addDays,
  isBefore,
  parseISO,
  eachDayOfInterval,
} from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Task } from '../TaskTable/types';
import { CalendarEvent } from './types';
import { taskToEvent } from './utils/taskToEvent';
import { exportToICal } from './utils/exportToICal';
import { generateRecurringEvents } from './utils/generateRecurringEvents';
import { TaskCard } from '../TaskCard';

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
      return '#E8C0FA'; // Light purple
  }
}

/**
 * Get priority color for left border indicator
 */
function getPriorityColor(priority: number): string {
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
function getOriginalTaskId(eventId: string): string {
  return eventId.split('-recur-')[0];
}

/**
 * Custom event style getter - applies visual styling with priority border and recurring indicator
 * Also adds data attributes for E2E testing
 */
function eventStyleGetter(event: CalendarEvent) {
  const isStarted = event.resource.isStarted;
  const isRecurring =
    event.resource.recurringInterval && event.resource.recurringInterval > 0;
  const isForecastedRecurrence = event.id.includes('-recur-'); // Forecasted occurrences have "-recur-" in ID

  let backgroundColor: string;

  // Forecasted recurring occurrences (not yet created) use gray
  if (isForecastedRecurrence) {
    backgroundColor = '#cbd5e0'; // Light gray for forecasted recurring
  } else {
    // Always use actual task status for color
    backgroundColor = getStatusColor(event.resource.status);
  }

  // Get original task ID (without -recur- suffix)
  const originalId = event.id.split('-recur-')[0];

  return {
    style: {
      backgroundColor,
      opacity: isStarted ? 1.0 : 0.6, // TO_DO tasks lighter
      borderRadius: '4px',
      borderWidth: '0 0 0 3px',
      borderStyle: isRecurring ? 'dashed' : 'solid', // Dashed border for recurring
      borderColor: getPriorityColor(event.resource.priority), // Priority indicator
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
  const originalId = event.id.split('-recur-')[0];
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

  // Custom Day View - Kanban Board Layout (defined inside component to access setSelectedTaskId)
  const CustomDayView = useMemo(() => {
    function KanbanDayView({
      date,
      events,
    }: {
      date: Date;
      events: CalendarEvent[];
    }) {
      const selectedDayStart = startOfDay(date);

      const dayEvents = events.filter(event => {
        const eventStart = startOfDay(event.start);
        const eventEnd = startOfDay(event.end);
        return (
          isWithinInterval(selectedDayStart, {
            start: eventStart,
            end: eventEnd,
          }) ||
          isSameDay(eventStart, date) ||
          isSameDay(eventEnd, date)
        );
      });

      const columns = [
        {
          status: 'TO_DO',
          label: 'To Do',
          color: '#E8C0FA',
          bgColor: '#faf5ff',
          tasks: dayEvents.filter(e => e.resource.status === 'TO_DO'),
        },
        {
          status: 'IN_PROGRESS',
          label: 'In Progress',
          color: '#3182ce',
          bgColor: '#ebf8ff',
          tasks: dayEvents.filter(e => e.resource.status === 'IN_PROGRESS'),
        },
        {
          status: 'BLOCKED',
          label: 'Blocked',
          color: '#e53e3e',
          bgColor: '#fff5f5',
          tasks: dayEvents.filter(e => e.resource.status === 'BLOCKED'),
        },
        {
          status: 'COMPLETED',
          label: 'Completed',
          color: '#38a169',
          bgColor: '#f0fff4',
          tasks: dayEvents.filter(e => e.resource.status === 'COMPLETED'),
        },
      ];

      return (
        <div style={kanbanStyles.container}>
          <div style={kanbanStyles.dateHeader}>
            <h3 style={kanbanStyles.dateTitle}>
              {format(date, 'EEEE, MMMM d, yyyy')}
            </h3>
            <div style={kanbanStyles.taskCount}>
              {dayEvents.length} {dayEvents.length === 1 ? 'task' : 'tasks'}
            </div>
          </div>
          <div style={kanbanStyles.board}>
            {columns.map(({ status, label, color, bgColor, tasks }) => (
              <div
                key={status}
                style={{ ...kanbanStyles.column, backgroundColor: bgColor }}
              >
                <div
                  style={{
                    ...kanbanStyles.columnHeader,
                    borderLeftColor: color,
                    borderBottomColor: color,
                  }}
                >
                  <h4 style={{ ...kanbanStyles.columnTitle, color }}>
                    {label}
                  </h4>
                  <span style={kanbanStyles.columnCount}>{tasks.length}</span>
                </div>
                <div style={kanbanStyles.cardContainer}>
                  {tasks.length === 0 ? (
                    <div style={kanbanStyles.emptyColumn}>No tasks</div>
                  ) : (
                    tasks.map(task => (
                      <div
                        key={task.id}
                        className='kanban-card'
                        data-task-title={task.title}
                        data-task-id={getOriginalTaskId(task.id)}
                        onClick={() =>
                          setSelectedTaskId(getOriginalTaskId(task.id))
                        }
                        style={{
                          ...kanbanStyles.card,
                          borderLeftColor: getPriorityColor(
                            task.resource.priority
                          ),
                          backgroundColor: task.id.includes('-recur-')
                            ? '#e5e7eb' // Forecasted recurring - gray
                            : task.resource.parentTaskId !== null
                              ? '#edf2f7' // Subtask - light gray
                              : kanbanStyles.card.backgroundColor, // Default white
                          paddingLeft:
                            task.resource.parentTaskId !== null
                              ? '1.5rem'
                              : kanbanStyles.card.padding,
                        }}
                      >
                        <div style={kanbanStyles.cardTitle}>
                          {task.resource.parentTaskId !== null && '↳ '}
                          {task.resource.recurringInterval &&
                            task.resource.recurringInterval > 0 &&
                            '🔁 '}
                          {task.title}
                        </div>
                        <div style={kanbanStyles.cardMeta}>
                          <span
                            style={{
                              ...kanbanStyles.priorityBadge,
                              backgroundColor: getPriorityColor(
                                task.resource.priority
                              ),
                            }}
                          >
                            Priority: {task.resource.priority}/10
                          </span>
                        </div>
                        {task.resource.ownerName && (
                          <div style={kanbanStyles.cardInfo}>
                            <span style={kanbanStyles.cardLabel}>Owner:</span>{' '}
                            {task.resource.ownerName}
                          </div>
                        )}
                        {task.resource.departmentName && (
                          <div style={kanbanStyles.cardInfo}>
                            <span style={kanbanStyles.cardLabel}>
                              Department:
                            </span>{' '}
                            {task.resource.departmentName}
                          </div>
                        )}
                        {task.resource.tags &&
                          task.resource.tags.length > 0 && (
                            <div style={kanbanStyles.tags}>
                              {task.resource.tags
                                .slice(0, 3)
                                .map((tag, idx) => (
                                  <span key={idx} style={kanbanStyles.tag}>
                                    #{tag}
                                  </span>
                                ))}
                            </div>
                          )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    (KanbanDayView as any).navigate = (date: Date, action: string) => {
      switch (action) {
        case 'PREV':
          return new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate() - 1
          );
        case 'NEXT':
          return new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate() + 1
          );
        default:
          return date;
      }
    };
    (KanbanDayView as any).title = (date: Date) => format(date, 'MMMM d, yyyy');

    return KanbanDayView;
  }, []);

  // Custom Agenda View - Enhanced Chronological List
  const CustomAgendaView = useMemo(() => {
    function AgendaView({
      date: _date,
      events,
    }: {
      date: Date;
      events: CalendarEvent[];
    }) {
      const now = new Date();
      const startOfToday = startOfDay(now);
      const rangeEnd = addDays(startOfToday, 30); // 30 days range

      // Filter events in range
      const eventsInRange = events.filter(
        event =>
          isBefore(event.end, rangeEnd) ||
          isSameDay(event.end, rangeEnd) ||
          isBefore(event.end, startOfToday)
      );

      // Separate overdue (due before today)
      const overdueEvents = eventsInRange.filter(event =>
        isBefore(event.end, startOfToday)
      );

      // Future events (due today or later)
      const futureEvents = eventsInRange.filter(
        event => !isBefore(event.end, startOfToday)
      );

      // Group future events by date
      const eventsByDate: Record<string, CalendarEvent[]> = {};
      futureEvents.forEach(event => {
        const dateKey = format(startOfDay(event.end), 'yyyy-MM-dd');
        if (!eventsByDate[dateKey]) {
          eventsByDate[dateKey] = [];
        }
        eventsByDate[dateKey].push(event);
      });

      // Fill in empty dates for better UX
      const allDates = eachDayOfInterval({
        start: startOfToday,
        end: rangeEnd,
      });
      allDates.forEach(d => {
        const dateKey = format(d, 'yyyy-MM-dd');
        if (!eventsByDate[dateKey]) {
          eventsByDate[dateKey] = [];
        }
      });

      // Calculate statistics
      const dueToday = futureEvents.filter(e => isSameDay(e.end, now)).length;
      const dueThisWeek = futureEvents.filter(e =>
        isWithinInterval(e.end, {
          start: startOfToday,
          end: addDays(startOfToday, 7),
        })
      ).length;
      const dueThisMonth = futureEvents.filter(e =>
        isWithinInterval(e.end, {
          start: startOfToday,
          end: addDays(startOfToday, 30),
        })
      ).length;

      return (
        <div style={agendaStyles.container}>
          {/* Statistics Bar */}
          <div style={agendaStyles.statsBar}>
            <div style={agendaStyles.statItem}>
              <span style={{ ...agendaStyles.statValue, color: '#e53e3e' }}>
                {overdueEvents.length}
              </span>
              <span style={agendaStyles.statLabel}>Overdue</span>
            </div>
            <div style={agendaStyles.statDivider}>|</div>
            <div style={agendaStyles.statItem}>
              <span style={{ ...agendaStyles.statValue, color: '#f59e0b' }}>
                {dueToday}
              </span>
              <span style={agendaStyles.statLabel}>Due Today</span>
            </div>
            <div style={agendaStyles.statDivider}>|</div>
            <div style={agendaStyles.statItem}>
              <span style={{ ...agendaStyles.statValue, color: '#3182ce' }}>
                {dueThisWeek}
              </span>
              <span style={agendaStyles.statLabel}>Due This Week</span>
            </div>
            <div style={agendaStyles.statDivider}>|</div>
            <div style={agendaStyles.statItem}>
              <span style={{ ...agendaStyles.statValue, color: '#805ad5' }}>
                {dueThisMonth}
              </span>
              <span style={agendaStyles.statLabel}>Due This Month</span>
            </div>
            <div style={agendaStyles.statDivider}>|</div>
            <div style={agendaStyles.statItem}>
              <span style={agendaStyles.statValue}>{eventsInRange.length}</span>
              <span style={agendaStyles.statLabel}>Total in Range</span>
            </div>
          </div>

          {/* Main Content */}
          <div style={agendaStyles.mainContent}>
            {/* Overdue Section */}
            {overdueEvents.length > 0 && (
              <div style={agendaStyles.section}>
                <div style={agendaStyles.dateColumn}>
                  <div
                    style={{
                      ...agendaStyles.dateHeader,
                      backgroundColor: '#fff5f5',
                      borderLeftColor: '#e53e3e',
                    }}
                  >
                    <span
                      style={{ ...agendaStyles.dateTitle, color: '#e53e3e' }}
                    >
                      ⚠️ OVERDUE
                    </span>
                    <span
                      style={{ ...agendaStyles.taskCount, color: '#e53e3e' }}
                    >
                      {overdueEvents.length}{' '}
                      {overdueEvents.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>
                </div>
                <div style={agendaStyles.eventColumn}>
                  {overdueEvents.map(event => (
                    <div
                      key={event.id}
                      className='agenda-card'
                      data-task-title={event.title}
                      data-task-id={getOriginalTaskId(event.id)}
                      onClick={() =>
                        setSelectedTaskId(getOriginalTaskId(event.id))
                      }
                      style={{
                        ...agendaStyles.taskCard,
                        borderLeftColor: getPriorityColor(
                          event.resource.priority
                        ),
                        backgroundColor: '#fff5f5',
                      }}
                    >
                      {/* Priority & Status Badges */}
                      <div style={agendaStyles.badgeRow}>
                        <span
                          style={{
                            ...agendaStyles.priorityBadge,
                            backgroundColor: getPriorityColor(
                              event.resource.priority
                            ),
                          }}
                        >
                          Priority {event.resource.priority}
                        </span>
                        <span
                          style={{
                            ...agendaStyles.statusBadge,
                            backgroundColor: getStatusColor(
                              event.resource.status
                            ),
                          }}
                        >
                          {event.resource.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Task Title */}
                      <div style={agendaStyles.taskTitle}>
                        {event.resource.parentTaskId !== null && '↳ '}
                        {event.resource.recurringInterval &&
                          event.resource.recurringInterval > 0 &&
                          '🔁 '}
                        {event.title}
                      </div>

                      {/* Meta Info */}
                      <div style={agendaStyles.metaRow}>
                        {event.resource.ownerName && (
                          <span style={agendaStyles.metaItem}>
                            Owner: {event.resource.ownerName}
                          </span>
                        )}
                        {event.resource.departmentName && (
                          <>
                            <span style={agendaStyles.metaDivider}>|</span>
                            <span style={agendaStyles.metaItem}>
                              Dept: {event.resource.departmentName}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Tags */}
                      {event.resource.tags &&
                        event.resource.tags.length > 0 && (
                          <div style={agendaStyles.tagsRow}>
                            {event.resource.tags.slice(0, 3).map((tag, idx) => (
                              <span key={idx} style={agendaStyles.tag}>
                                #{tag}
                              </span>
                            ))}
                            {event.resource.tags.length > 3 && (
                              <span style={agendaStyles.tagMore}>
                                +{event.resource.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chronological Date Sections */}
            {Object.entries(eventsByDate)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([dateKey, dayEvents]) => {
                const sectionDate = parseISO(dateKey);
                const isToday = isSameDay(sectionDate, now);
                const dayName = format(sectionDate, 'EEEE, MMMM d');

                return (
                  <div key={dateKey} style={agendaStyles.section}>
                    <div style={agendaStyles.dateColumn}>
                      <div
                        style={{
                          ...agendaStyles.dateHeader,
                          backgroundColor: isToday ? '#fef3c7' : '#f7fafc',
                          borderLeftColor: isToday ? '#f59e0b' : '#cbd5e0',
                        }}
                      >
                        <span
                          style={{
                            ...agendaStyles.dateTitle,
                            color: isToday ? '#f59e0b' : '#2d3748',
                          }}
                        >
                          {dayName}
                          {isToday && (
                            <span
                              style={{
                                marginLeft: '0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                color: '#f59e0b',
                              }}
                            >
                              (TODAY)
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            ...agendaStyles.taskCount,
                            color: isToday ? '#f59e0b' : '#718096',
                          }}
                        >
                          {dayEvents.length}{' '}
                          {dayEvents.length === 1 ? 'task' : 'tasks'}
                        </span>
                      </div>
                    </div>
                    <div style={agendaStyles.eventColumn}>
                      {dayEvents.length === 0 ? (
                        <div style={agendaStyles.emptyDay}>No tasks due</div>
                      ) : (
                        dayEvents.map(event => (
                          <div
                            key={event.id}
                            className='agenda-card'
                            data-task-title={event.title}
                            data-task-id={getOriginalTaskId(event.id)}
                            onClick={() =>
                              setSelectedTaskId(getOriginalTaskId(event.id))
                            }
                            style={{
                              ...agendaStyles.taskCard,
                              borderLeftColor: getPriorityColor(
                                event.resource.priority
                              ),
                              backgroundColor:
                                event.resource.recurringInterval &&
                                event.resource.recurringInterval > 0
                                  ? '#f3e8ff'
                                  : '#ffffff',
                            }}
                          >
                            {/* Priority & Status Badges */}
                            <div style={agendaStyles.badgeRow}>
                              <span
                                style={{
                                  ...agendaStyles.priorityBadge,
                                  backgroundColor: getPriorityColor(
                                    event.resource.priority
                                  ),
                                }}
                              >
                                Priority {event.resource.priority}
                              </span>
                              <span
                                style={{
                                  ...agendaStyles.statusBadge,
                                  backgroundColor: getStatusColor(
                                    event.resource.status
                                  ),
                                }}
                              >
                                {event.resource.status.replace('_', ' ')}
                              </span>
                            </div>

                            {/* Task Title */}
                            <div style={agendaStyles.taskTitle}>
                              {event.resource.parentTaskId !== null && '↳ '}
                              {event.resource.recurringInterval &&
                                event.resource.recurringInterval > 0 &&
                                '🔁 '}
                              {event.title}
                            </div>

                            {/* Meta Info */}
                            <div style={agendaStyles.metaRow}>
                              {event.resource.ownerName && (
                                <span style={agendaStyles.metaItem}>
                                  Owner: {event.resource.ownerName}
                                </span>
                              )}
                              {event.resource.departmentName && (
                                <>
                                  <span style={agendaStyles.metaDivider}>
                                    |
                                  </span>
                                  <span style={agendaStyles.metaItem}>
                                    Dept: {event.resource.departmentName}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Tags */}
                            {event.resource.tags &&
                              event.resource.tags.length > 0 && (
                                <div style={agendaStyles.tagsRow}>
                                  {event.resource.tags
                                    .slice(0, 3)
                                    .map((tag, idx) => (
                                      <span key={idx} style={agendaStyles.tag}>
                                        #{tag}
                                      </span>
                                    ))}
                                  {event.resource.tags.length > 3 && (
                                    <span style={agendaStyles.tagMore}>
                                      +{event.resource.tags.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      );
    }

    // Add required static methods for react-big-calendar
    (AgendaView as any).navigate = (date: Date, action: string) => {
      switch (action) {
        case 'PREV':
          return addDays(date, -30);
        case 'NEXT':
          return addDays(date, 30);
        default:
          return date;
      }
    };
    (AgendaView as any).title = (date: Date) => {
      const end = addDays(date, 30);
      return `${format(date, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    };
    (AgendaView as any).range = (date: Date) => {
      const start = startOfDay(date);
      const end = addDays(start, 30);
      return [start, end];
    };

    return AgendaView;
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
            day: CustomDayView as any,
            agenda: CustomAgendaView as any,
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

const kanbanStyles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '1rem',
  },
  dateHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    paddingBottom: '1rem',
    borderBottom: '2px solid #e2e8f0',
  },
  dateTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#2d3748',
    margin: 0,
  },
  taskCount: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#718096',
    backgroundColor: '#f7fafc',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
  },
  board: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
    flex: 1,
    overflow: 'hidden',
  },
  column: {
    display: 'flex',
    flexDirection: 'column' as const,
    borderRadius: '8px',
    padding: '1rem',
    minHeight: 0,
  },
  columnHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    paddingBottom: '0.75rem',
    borderBottom: '2px solid currentColor',
    borderLeft: '4px solid',
    paddingLeft: '0.5rem',
  },
  columnTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: 0,
  },
  columnCount: {
    fontSize: '0.875rem',
    fontWeight: 600,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: '0.25rem 0.5rem',
    borderRadius: '12px',
  },
  cardContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    overflowY: 'auto' as const,
    flex: 1,
    paddingRight: '0.25rem',
  },
  emptyColumn: {
    textAlign: 'center' as const,
    color: '#a0aec0',
    fontSize: '0.875rem',
    padding: '2rem 1rem',
    fontStyle: 'italic' as const,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    padding: '0.875rem',
    borderLeft: '4px solid',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  cardTitle: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#2d3748',
    marginBottom: '0.75rem',
    lineHeight: 1.4,
  },
  cardMeta: {
    marginBottom: '0.5rem',
  },
  priorityBadge: {
    display: 'inline-block',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#ffffff',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
  },
  cardInfo: {
    fontSize: '0.8125rem',
    color: '#4a5568',
    marginBottom: '0.25rem',
  },
  cardLabel: {
    fontWeight: 600,
    color: '#718096',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.375rem',
    marginTop: '0.5rem',
  },
  tag: {
    fontSize: '0.75rem',
    color: '#4a5568',
    backgroundColor: '#edf2f7',
    padding: '0.125rem 0.5rem',
    borderRadius: '4px',
  },
};

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

/**
 * Agenda View Styles
 */
const agendaStyles = {
  container: {
    padding: '1.5rem',
    backgroundColor: '#ffffff',
    height: '100%',
    overflow: 'auto',
  },
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: '#f7fafc',
    borderRadius: '8px',
    marginBottom: '1.5rem',
    border: '1px solid #e2e8f0',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.25rem',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#2d3748',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#718096',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  statDivider: {
    color: '#cbd5e0',
    fontSize: '1.5rem',
    fontWeight: 'lighter',
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0',
  },
  section: {
    display: 'grid',
    gridTemplateColumns: '200px 1fr',
    borderBottom: '1px solid #e2e8f0',
    minHeight: '60px',
  },
  dateColumn: {
    borderRight: '2px solid #e2e8f0',
    display: 'flex',
    alignItems: 'flex-start',
  },
  dateHeader: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    width: '100%',
    borderLeft: '4px solid',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
  },
  dateTitle: {
    fontSize: '0.875rem',
    fontWeight: 'bold',
    color: '#2d3748',
  },
  taskCount: {
    fontSize: '0.75rem',
    color: '#718096',
  },
  eventColumn: {
    padding: '0.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  taskCard: {
    padding: '0.75rem',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderLeft: '4px solid',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  badgeRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.5rem',
    flexWrap: 'wrap' as const,
  },
  priorityBadge: {
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#ffffff',
  },
  statusBadge: {
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#ffffff',
  },
  taskTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#2d3748',
    marginBottom: '0.5rem',
    lineHeight: 1.4,
  },
  metaRow: {
    display: 'flex',
    gap: '0.5rem',
    fontSize: '0.8rem',
    color: '#718096',
    marginBottom: '0.5rem',
    flexWrap: 'wrap' as const,
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
  },
  metaDivider: {
    color: '#cbd5e0',
  },
  tagsRow: {
    display: 'flex',
    gap: '0.375rem',
    flexWrap: 'wrap' as const,
  },
  tag: {
    padding: '0.125rem 0.5rem',
    backgroundColor: '#edf2f7',
    color: '#4a5568',
    borderRadius: '4px',
    fontSize: '0.75rem',
  },
  tagMore: {
    padding: '0.125rem 0.5rem',
    color: '#718096',
    fontSize: '0.75rem',
    fontStyle: 'italic' as const,
  },
  emptyDay: {
    padding: '1rem',
    color: '#a0aec0',
    fontStyle: 'italic' as const,
    fontSize: '0.875rem',
    textAlign: 'center' as const,
  },
};
