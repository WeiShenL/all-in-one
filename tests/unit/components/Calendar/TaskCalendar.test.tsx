/**
 * Unit Tests for TaskCalendar Component
 *
 * Testing calendar view switching and event interaction:
 * - View switching between Month, Week, Day, Agenda (CIT003)
 * - Event click handling and modal display
 * - Task detail display on click
 * - Export functionality integration
 *
 * Test Coverage:
 * - AC (CIT003): User can switch between Day, Week, and Month layouts
 * - AC: Clicking a task event displays full details
 * - AC (CIT004): Export to iCal functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskCalendar } from '@/app/components/Calendar/TaskCalendar';
import { Task } from '@/app/components/TaskTable/types';

// Mock react-big-calendar
jest.mock('react-big-calendar', () => {
  const actual = jest.requireActual('react-big-calendar');
  return {
    ...actual,
    Calendar: ({ onSelectEvent, view, onView, events }: any) => {
      // Store the current view and callback for testing
      (global as any).mockCalendarView = view;
      (global as any).mockCalendarOnView = onView;
      (global as any).mockCalendarOnSelectEvent = onSelectEvent;
      (global as any).mockCalendarEvents = events;

      return (
        <div data-testid='mock-calendar'>
          <div data-testid='calendar-view'>{view}</div>
          <div data-testid='calendar-toolbar'>
            <button onClick={() => onView('month')} data-testid='view-month'>
              Month
            </button>
            <button onClick={() => onView('week')} data-testid='view-week'>
              Week
            </button>
            <button onClick={() => onView('day')} data-testid='view-day'>
              Day
            </button>
            <button onClick={() => onView('agenda')} data-testid='view-agenda'>
              Agenda
            </button>
          </div>
          <div data-testid='calendar-events'>
            {events.map((event: any) => (
              <div
                key={event.id}
                data-testid={`event-${event.id}`}
                onClick={() => onSelectEvent && onSelectEvent(event)}
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>
      );
    },
  };
});

// Mock TaskCard modal component
jest.mock('@/app/components/TaskCard', () => {
  return {
    TaskCard: function MockTaskCard({
      taskId,
      onTaskUpdated: _onTaskUpdated,
    }: any) {
      return (
        <div data-testid='task-card-modal' role='dialog'>
          <div data-testid='modal-task-id'>{taskId}</div>
          <div data-testid='modal-task-details'>Task Details for {taskId}</div>
        </div>
      );
    },
  };
});

describe('TaskCalendar - View Switching (CIT003)', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Test Task 1',
      description: 'Test description',
      status: 'TO_DO',
      priorityBucket: 5,
      dueDate: '2025-12-31T10:00:00.000Z',
      assignments: [
        {
          userId: 'user-1',
          user: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ],
      departmentId: 'dept-1',
      department: {
        id: 'dept-1',
        name: 'Engineering',
      },
      ownerId: 'owner-1',
      owner: {
        id: 'owner-1',
        name: 'Owner',
        email: 'owner@example.com',
      },
      projectId: null,
      parentTaskId: null,
      isRecurring: false,
      recurringInterval: null,
      isArchived: false,
      createdAt: '2025-10-01T10:00:00.000Z',
      startDate: null,
      updatedAt: '2025-10-01T10:00:00.000Z',
      tags: [],
      comments: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear global mock state
    delete (global as any).mockCalendarView;
    delete (global as any).mockCalendarOnView;
    delete (global as any).mockCalendarOnSelectEvent;
    delete (global as any).mockCalendarEvents;
  });

  it('should render Month view by default', () => {
    render(<TaskCalendar tasks={mockTasks} title='Test Calendar' />);

    // Verify calendar is rendered
    expect(screen.getByTestId('mock-calendar')).toBeInTheDocument();

    // Verify default view is month
    expect(screen.getByTestId('calendar-view')).toHaveTextContent('month');
  });

  it('should switch from Month to Week view when button clicked', async () => {
    render(<TaskCalendar tasks={mockTasks} title='Test Calendar' />);

    // Click Week button
    const weekButton = screen.getByTestId('view-week');
    fireEvent.click(weekButton);

    // Wait for view to update
    await waitFor(() => {
      expect(screen.getByTestId('calendar-view')).toHaveTextContent('week');
    });
  });

  it('should switch from Week to Day view', async () => {
    render(<TaskCalendar tasks={mockTasks} title='Test Calendar' />);

    // First switch to week
    fireEvent.click(screen.getByTestId('view-week'));

    await waitFor(() => {
      expect(screen.getByTestId('calendar-view')).toHaveTextContent('week');
    });

    // Then switch to day
    fireEvent.click(screen.getByTestId('view-day'));

    await waitFor(() => {
      expect(screen.getByTestId('calendar-view')).toHaveTextContent('day');
    });
  });

  it('should switch from Day to Agenda view', async () => {
    render(<TaskCalendar tasks={mockTasks} title='Test Calendar' />);

    // First switch to day
    fireEvent.click(screen.getByTestId('view-day'));

    await waitFor(() => {
      expect(screen.getByTestId('calendar-view')).toHaveTextContent('day');
    });

    // Then switch to agenda
    fireEvent.click(screen.getByTestId('view-agenda'));

    await waitFor(() => {
      expect(screen.getByTestId('calendar-view')).toHaveTextContent('agenda');
    });
  });

  it('should switch back to Month view from other views', async () => {
    render(<TaskCalendar tasks={mockTasks} title='Test Calendar' />);

    // Switch to week
    fireEvent.click(screen.getByTestId('view-week'));
    await waitFor(() => {
      expect(screen.getByTestId('calendar-view')).toHaveTextContent('week');
    });

    // Switch back to month
    fireEvent.click(screen.getByTestId('view-month'));
    await waitFor(() => {
      expect(screen.getByTestId('calendar-view')).toHaveTextContent('month');
    });
  });

  it('should show appropriate events for each view type', async () => {
    render(<TaskCalendar tasks={mockTasks} title='Test Calendar' />);

    // Verify events are rendered
    await waitFor(() => {
      expect(screen.getByTestId('event-task-1')).toBeInTheDocument();
    });

    // Switch views and verify events still visible
    fireEvent.click(screen.getByTestId('view-week'));
    await waitFor(() => {
      expect(screen.getByTestId('event-task-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('view-day'));
    await waitFor(() => {
      expect(screen.getByTestId('event-task-1')).toBeInTheDocument();
    });
  });
});

describe('TaskCalendar - Event Click Handling', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-click-1',
      title: 'Clickable Task',
      description: 'Click to see details',
      status: 'IN_PROGRESS',
      priorityBucket: 7,
      dueDate: '2025-12-31T10:00:00.000Z',
      assignments: [
        {
          userId: 'user-1',
          user: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ],
      departmentId: 'dept-1',
      department: {
        id: 'dept-1',
        name: 'Engineering',
      },
      ownerId: 'owner-1',
      owner: {
        id: 'owner-1',
        name: 'Owner',
        email: 'owner@example.com',
      },
      projectId: null,
      parentTaskId: null,
      isRecurring: false,
      recurringInterval: null,
      isArchived: false,
      createdAt: '2025-10-01T10:00:00.000Z',
      startDate: '2025-10-15T09:00:00.000Z',
      updatedAt: '2025-10-01T10:00:00.000Z',
      tags: ['backend', 'api'],
      comments: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should open TaskCard modal when event is clicked', async () => {
    render(<TaskCalendar tasks={mockTasks} title='Test Calendar' />);

    // Verify modal is not open initially
    expect(screen.queryByTestId('task-card-modal')).not.toBeInTheDocument();

    // Click on event
    const event = screen.getByTestId('event-task-click-1');
    fireEvent.click(event);

    // Verify modal opens
    await waitFor(() => {
      expect(screen.getByTestId('task-card-modal')).toBeInTheDocument();
    });
  });

  it('should display correct task ID in modal', async () => {
    render(<TaskCalendar tasks={mockTasks} title='Test Calendar' />);

    // Click on event
    const event = screen.getByTestId('event-task-click-1');
    fireEvent.click(event);

    // Verify correct task ID is passed to modal
    await waitFor(() => {
      expect(screen.getByTestId('modal-task-id')).toHaveTextContent(
        'task-click-1'
      );
    });
  });

  it('should close modal when close button clicked', async () => {
    render(<TaskCalendar tasks={mockTasks} title='Test Calendar' />);

    // Open modal
    const event = screen.getByTestId('event-task-click-1');
    fireEvent.click(event);

    await waitFor(() => {
      expect(screen.getByTestId('task-card-modal')).toBeInTheDocument();
    });

    // Close modal by clicking the × button
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByTestId('task-card-modal')).not.toBeInTheDocument();
    });
  });

  it('should handle recurring event clicks (show original task)', async () => {
    const recurringTasks: Task[] = [
      {
        id: 'recurring-task-1',
        title: 'Weekly Meeting',
        description: 'Recurring weekly',
        status: 'TO_DO',
        priorityBucket: 5,
        dueDate: '2025-12-31T10:00:00.000Z',
        assignments: [
          {
            userId: 'user-1',
            user: {
              id: 'user-1',
              name: 'Test User',
              email: 'test@example.com',
            },
          },
        ],
        departmentId: 'dept-1',
        department: {
          id: 'dept-1',
          name: 'Engineering',
        },
        ownerId: 'owner-1',
        owner: {
          id: 'owner-1',
          name: 'Owner',
          email: 'owner@example.com',
        },
        projectId: null,
        parentTaskId: null,
        isRecurring: true,
        recurringInterval: 7,
        isArchived: false,
        createdAt: '2025-10-01T10:00:00.000Z',
        startDate: null,
        updatedAt: '2025-10-01T10:00:00.000Z',
        tags: [],
        comments: [],
      },
    ];

    render(<TaskCalendar tasks={recurringTasks} title='Test Calendar' />);

    // The generateRecurringEvents utility will create multiple events
    // Event IDs will be: "recurring-task-1", "recurring-task-1-recur-1", etc.
    await waitFor(() => {
      const events = screen.getByTestId('calendar-events');
      expect(events).toBeInTheDocument();
    });

    // Click on any recurring event
    const firstEvent = screen.getByTestId('event-recurring-task-1');
    fireEvent.click(firstEvent);

    // Verify modal opens with original task ID (not the recurrence ID)
    await waitFor(() => {
      expect(screen.getByTestId('task-card-modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-task-id')).toHaveTextContent(
        'recurring-task-1'
      );
    });
  });

  it('should handle multiple event clicks (open different modals)', async () => {
    const multipleTasks: Task[] = [
      {
        id: 'task-a',
        title: 'Task A',
        description: 'First task',
        status: 'TO_DO',
        priorityBucket: 5,
        dueDate: '2025-12-31T10:00:00.000Z',
        assignments: [],
        departmentId: 'dept-1',
        department: { id: 'dept-1', name: 'Engineering' },
        ownerId: 'owner-1',
        owner: { id: 'owner-1', name: 'Owner', email: 'owner@example.com' },
        projectId: null,
        parentTaskId: null,
        isRecurring: false,
        recurringInterval: null,
        isArchived: false,
        createdAt: '2025-10-01T10:00:00.000Z',
        startDate: null,
        updatedAt: '2025-10-01T10:00:00.000Z',
        tags: [],
        comments: [],
      },
      {
        id: 'task-b',
        title: 'Task B',
        description: 'Second task',
        status: 'IN_PROGRESS',
        priorityBucket: 7,
        dueDate: '2025-12-30T10:00:00.000Z',
        assignments: [],
        departmentId: 'dept-1',
        department: { id: 'dept-1', name: 'Engineering' },
        ownerId: 'owner-1',
        owner: { id: 'owner-1', name: 'Owner', email: 'owner@example.com' },
        projectId: null,
        parentTaskId: null,
        isRecurring: false,
        recurringInterval: null,
        isArchived: false,
        createdAt: '2025-10-02T10:00:00.000Z',
        startDate: null,
        updatedAt: '2025-10-02T10:00:00.000Z',
        tags: [],
        comments: [],
      },
    ];

    render(<TaskCalendar tasks={multipleTasks} title='Test Calendar' />);

    // Click first event
    const eventA = screen.getByTestId('event-task-a');
    fireEvent.click(eventA);

    await waitFor(() => {
      expect(screen.getByTestId('modal-task-id')).toHaveTextContent('task-a');
    });

    // Close first modal by clicking × button
    fireEvent.click(screen.getByText('×'));

    await waitFor(() => {
      expect(screen.queryByTestId('task-card-modal')).not.toBeInTheDocument();
    });

    // Click second event
    const eventB = screen.getByTestId('event-task-b');
    fireEvent.click(eventB);

    await waitFor(() => {
      expect(screen.getByTestId('modal-task-id')).toHaveTextContent('task-b');
    });
  });
});

describe('TaskCalendar - Export Integration (CIT004)', () => {
  const mockTasks: Task[] = [
    {
      id: 'export-task-1',
      title: 'Export Test Task',
      description: 'Task for export',
      status: 'TO_DO',
      priorityBucket: 5,
      dueDate: '2025-12-31T10:00:00.000Z',
      assignments: [],
      departmentId: 'dept-1',
      department: { id: 'dept-1', name: 'Engineering' },
      ownerId: 'owner-1',
      owner: { id: 'owner-1', name: 'Owner', email: 'owner@example.com' },
      projectId: null,
      parentTaskId: null,
      isRecurring: false,
      recurringInterval: null,
      isArchived: false,
      createdAt: '2025-10-01T10:00:00.000Z',
      startDate: null,
      updatedAt: '2025-10-01T10:00:00.000Z',
      tags: [],
      comments: [],
    },
  ];

  it('should have export button available', () => {
    render(<TaskCalendar tasks={mockTasks} title='Test Calendar' />);

    // Find export button
    const exportButton = screen.getByText(/export.*iCal/i);
    expect(exportButton).toBeInTheDocument();
    expect(exportButton).toBeEnabled();
  });

  it('should have export button that is interactive', () => {
    render(<TaskCalendar tasks={mockTasks} title='Test Calendar' />);

    // Export button should be clickable
    const exportButton = screen.getByText(/export.*iCal/i);
    expect(exportButton.tagName).toBe('BUTTON');
    expect(exportButton).not.toHaveAttribute('disabled');
  });
});

describe('TaskCalendar - Edge Cases', () => {
  it('should handle empty task list', () => {
    render(<TaskCalendar tasks={[]} title='Empty Calendar' />);

    // Should show empty state
    expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
  });

  it('should handle loading state', () => {
    render(
      <TaskCalendar tasks={[]} title='Loading Calendar' isLoading={true} />
    );

    // Should show loading indicator
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should handle error state', () => {
    const mockError = new Error('Failed to fetch tasks');

    render(
      <TaskCalendar
        tasks={[]}
        title='Error Calendar'
        error={mockError}
        emptyStateConfig={{
          icon: '⚠️',
          title: 'Error',
          description: 'Failed to load tasks',
        }}
      />
    );

    // Should show error message
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it('should render calendar when tasks are provided', () => {
    const singleTask: Task[] = [
      {
        id: 'task-edge-1',
        title: 'Edge Case Task',
        description: 'Test',
        status: 'TO_DO',
        priorityBucket: 5,
        dueDate: '2025-12-31T10:00:00.000Z',
        assignments: [],
        departmentId: 'dept-1',
        department: { id: 'dept-1', name: 'Engineering' },
        ownerId: 'owner-1',
        owner: { id: 'owner-1', name: 'Owner', email: 'owner@example.com' },
        projectId: null,
        parentTaskId: null,
        isRecurring: false,
        recurringInterval: null,
        isArchived: false,
        createdAt: '2025-10-01T10:00:00.000Z',
        startDate: null,
        updatedAt: '2025-10-01T10:00:00.000Z',
        tags: [],
        comments: [],
      },
    ];

    render(<TaskCalendar tasks={singleTask} title='Calendar with Task' />);

    // Calendar should render
    expect(screen.getByTestId('mock-calendar')).toBeInTheDocument();
  });
});
