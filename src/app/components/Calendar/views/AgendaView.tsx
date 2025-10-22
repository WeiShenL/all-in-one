'use client';

import {
  format,
  startOfDay,
  addDays,
  isBefore,
  isSameDay,
  isWithinInterval,
  eachDayOfInterval,
  parseISO,
} from 'date-fns';
import { CalendarEvent } from '../types';
import {
  getStatusColor,
  getPriorityColor,
  getOriginalTaskId,
} from '../utils/calendarHelpers';

interface AgendaViewProps {
  date: Date;
  events: CalendarEvent[];
  onSelectTask: (taskId: string) => void;
}

/**
 * Custom Agenda View - Enhanced Chronological List
 *
 * Displays tasks in a timeline format with:
 * - Statistics bar showing overdue, due today, due this week, etc.
 * - Overdue section highlighted in red
 * - Chronological date sections with tasks
 * - Empty date placeholders for better UX
 */
function AgendaView({ date: _date, events, onSelectTask }: AgendaViewProps) {
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
                <span style={{ ...agendaStyles.dateTitle, color: '#e53e3e' }}>
                  ⚠️ OVERDUE
                </span>
                <span style={{ ...agendaStyles.taskCount, color: '#e53e3e' }}>
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
                  onClick={() => onSelectTask(getOriginalTaskId(event.id))}
                  style={{
                    ...agendaStyles.taskCard,
                    borderLeftColor: getPriorityColor(event.resource.priority),
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
                        backgroundColor: getStatusColor(event.resource.status),
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
                  {event.resource.tags && event.resource.tags.length > 0 && (
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
                          onSelectTask(getOriginalTaskId(event.id))
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

// Attach static methods required by react-big-calendar
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

(AgendaView as any).title = () => {
  return 'Upcoming Tasks (Next 30 Days)';
};

(AgendaView as any).range = (date: Date) => {
  const start = startOfDay(date);
  const end = addDays(start, 30);
  return [start, end];
};

export default AgendaView;

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
