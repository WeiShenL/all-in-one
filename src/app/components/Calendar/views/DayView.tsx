'use client';

import { format, startOfDay, isWithinInterval, isSameDay } from 'date-fns';
import { CalendarEvent } from '../types';
import { getPriorityColor, getOriginalTaskId } from '../utils/calendarHelpers';

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
  onSelectTask: (taskId: string) => void;
}

/**
 * Custom Day View - Kanban Board Layout
 *
 * Displays tasks for a selected day organized by status columns (TO_DO, IN_PROGRESS, BLOCKED, COMPLETED)
 */
function DayView({ date, events, onSelectTask }: DayViewProps) {
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
              <h4 style={{ ...kanbanStyles.columnTitle, color }}>{label}</h4>
              <span style={kanbanStyles.columnCount}>{tasks.length}</span>
            </div>
            <div style={kanbanStyles.cardContainer}>
              {tasks.length === 0 ? (
                <div style={kanbanStyles.emptyColumn}>No tasks</div>
              ) : (
                tasks.map(task => {
                  const isOverdue = task.resource.isOverdue;
                  const isForecastedRecurring = task.id.includes('-recur-');
                  const isSubtask = task.resource.parentTaskId !== null;

                  // Determine background color and border styling
                  let backgroundColor: string;
                  let border: string;
                  let borderLeft: string;

                  if (isOverdue) {
                    // Overdue tasks: orange background with red border (all sides)
                    backgroundColor = '#fb923c';
                    border = '2px solid #dc2626';
                    borderLeft = 'none';
                  } else {
                    // Non-overdue tasks: use existing logic
                    backgroundColor = isForecastedRecurring
                      ? '#e5e7eb' // Forecasted recurring - gray
                      : isSubtask
                        ? '#edf2f7' // Subtask - light gray
                        : kanbanStyles.card.backgroundColor; // Default white
                    border = 'none';
                    borderLeft = `4px solid ${getPriorityColor(task.resource.priority)}`;
                  }

                  return (
                    <div
                      key={task.id}
                      className='kanban-card'
                      data-task-title={task.title}
                      data-task-id={getOriginalTaskId(task.id)}
                      onClick={() => onSelectTask(getOriginalTaskId(task.id))}
                      style={{
                        ...kanbanStyles.card,
                        backgroundColor,
                        border,
                        borderLeft,
                        paddingLeft: isSubtask
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
                      {task.resource.tags && task.resource.tags.length > 0 && (
                        <div style={kanbanStyles.tags}>
                          {task.resource.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} style={kanbanStyles.tag}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Attach static methods required by react-big-calendar
(DayView as any).navigate = (date: Date, action: string) => {
  switch (action) {
    case 'PREV':
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
    case 'NEXT':
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    default:
      return date;
  }
};

(DayView as any).title = (date: Date) => format(date, 'MMMM d, yyyy');

export default DayView;

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
