/**
 * Unit Tests for exportToICal Utility
 *
 * TDD Cycle 3: iCal Export Functionality
 *
 * Testing export of calendar events to iCal (.ics) format
 * Supports AC: CIT004 (export currently displayed tasks to iCal format)
 */

import { exportToICal } from '@/app/components/Calendar/utils/exportToICal';
import { CalendarEvent } from '@/app/components/Calendar/types';

// Helper to read blob text (FileReader for JSDOM compatibility)
const readBlobAsText = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
};

describe('exportToICal', () => {
  let mockCreateObjectURL: jest.SpyInstance;
  let mockRevokeObjectURL: jest.SpyInstance;
  let mockCreateElement: jest.SpyInstance;
  let mockClick: jest.Mock;
  let mockAppendChild: jest.Mock;
  let mockRemoveChild: jest.Mock;

  const mockEvents: CalendarEvent[] = [
    {
      id: 'task-123',
      title: 'Weekly team standup',
      start: new Date('2025-10-20T10:00:00.000Z'),
      end: new Date('2025-10-20T10:00:00.000Z'),
      resource: {
        taskId: 'task-123',
        status: 'TO_DO',
        priority: 5,
        isCompleted: false,
        isStarted: false,
        isOverdue: false,
        description: 'Team standup meeting',
        createdAt: new Date('2025-10-15T00:00:00.000Z'),
        departmentName: 'Engineering',
        ownerName: 'John Doe',
        ownerEmail: 'john@example.com',
        assigneeDetails: [{ name: 'User 1', email: 'user1@example.com' }],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
      },
    },
    {
      id: 'task-456',
      title: 'Review quarterly report',
      start: new Date('2025-10-25T14:00:00.000Z'),
      end: new Date('2025-10-25T14:00:00.000Z'),
      resource: {
        taskId: 'task-456',
        status: 'IN_PROGRESS',
        priority: 8,
        isCompleted: false,
        isStarted: true,
        isOverdue: false,
        description: 'Quarterly business review',
        createdAt: new Date('2025-10-20T00:00:00.000Z'),
        departmentName: 'Finance',
        ownerName: 'Jane Smith',
        ownerEmail: 'jane@example.com',
        assigneeDetails: [
          { name: 'User 2', email: 'user2@example.com' },
          { name: 'User 3', email: 'user3@example.com' },
        ],
        tags: [],
        recurringInterval: null,
        parentTaskId: null,
      },
    },
  ];

  beforeEach(() => {
    // Define URL methods if they don't exist (for JSDOM)
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = jest.fn();
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = jest.fn();
    }

    // Mock URL.createObjectURL and revokeObjectURL
    mockCreateObjectURL = jest
      .spyOn(window.URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url');
    mockRevokeObjectURL = jest
      .spyOn(window.URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    // Mock document.createElement and link behavior
    mockClick = jest.fn();
    mockAppendChild = jest.fn();
    mockRemoveChild = jest.fn();

    mockCreateElement = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return {
            href: '',
            download: '',
            click: mockClick,
            style: {},
          } as unknown as HTMLAnchorElement;
        }
        return {} as any;
      });

    jest
      .spyOn(document.body, 'appendChild')
      .mockImplementation(mockAppendChild);
    jest
      .spyOn(document.body, 'removeChild')
      .mockImplementation(mockRemoveChild);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Basic export functionality', () => {
    it('should create a Blob with correct MIME type', () => {
      exportToICal(mockEvents);

      // Check that Blob was created (createObjectURL was called)
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);

      // Get the Blob argument
      const blobCall = mockCreateObjectURL.mock.calls[0][0];
      expect(blobCall).toBeInstanceOf(Blob);
      expect(blobCall.type).toBe('text/calendar');
    });

    it('should trigger download with default filename', () => {
      exportToICal(mockEvents);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('should use custom filename when provided', () => {
      exportToICal(mockEvents, 'my-tasks.ics');

      // We'll verify this in the implementation by checking the download attribute
      expect(mockCreateElement).toHaveBeenCalledWith('a');
    });

    it('should clean up object URL after download', () => {
      exportToICal(mockEvents);

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('iCal content generation', () => {
    it('should generate valid iCal content for single event', async () => {
      const singleEvent = [mockEvents[0]];

      exportToICal(singleEvent);

      // Get the Blob content
      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // Verify iCal structure
      expect(text).toContain('BEGIN:VCALENDAR');
      expect(text).toContain('END:VCALENDAR');
      expect(text).toContain('BEGIN:VEVENT');
      expect(text).toContain('END:VEVENT');
      expect(text).toContain('VERSION:2.0');
    });

    it('should include event summary (title)', async () => {
      exportToICal(mockEvents);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      expect(text).toContain('SUMMARY:Weekly team standup');
      expect(text).toContain('SUMMARY:Review quarterly report');
    });

    it('should include event dates in iCal format', async () => {
      exportToICal(mockEvents);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // iCal uses DTSTART and DTEND
      expect(text).toContain('DTSTART');
      expect(text).toContain('DTEND');
    });

    it('should include event description with status and priority', async () => {
      exportToICal(mockEvents);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // Description should contain status and priority
      expect(text).toContain('DESCRIPTION');
      expect(text).toContain('Status: TO_DO');
      expect(text).toContain('Priority: 5');
      expect(text).toContain('Status: IN_PROGRESS');
      expect(text).toContain('Priority: 8');
    });

    it('should generate multiple VEVENT entries for multiple events', async () => {
      exportToICal(mockEvents);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // Count VEVENT occurrences
      const veventMatches = text.match(/BEGIN:VEVENT/g);
      expect(veventMatches).toHaveLength(2);
    });

    it('should set calendar name/product ID', async () => {
      exportToICal(mockEvents);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // ical-generator sets PRODID
      expect(text).toContain('PRODID');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty events array', async () => {
      exportToICal([]);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // Should still generate valid iCal structure
      expect(text).toContain('BEGIN:VCALENDAR');
      expect(text).toContain('END:VCALENDAR');
      expect(text).not.toContain('BEGIN:VEVENT');
    });

    it('should handle events with special characters in title', async () => {
      const specialCharEvent: CalendarEvent = {
        id: 'task-special',
        title: 'Review: "Project Alpha" & Submit Report (Priority!)',
        start: new Date('2025-10-20T10:00:00.000Z'),
        end: new Date('2025-10-20T10:00:00.000Z'),
        resource: {
          taskId: 'task-special',
          status: 'TO_DO',
          priority: 5,
          isCompleted: false,
          isStarted: false,
          isOverdue: false,
          description: 'Special characters test',
          createdAt: new Date('2025-10-15T00:00:00.000Z'),
          departmentName: 'Engineering',
          ownerName: 'John Doe',
          ownerEmail: 'john@example.com',
          assigneeDetails: [{ name: 'User 1', email: 'user1@example.com' }],
          tags: [],
          recurringInterval: null,
          parentTaskId: null,
        },
      };

      exportToICal([specialCharEvent]);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // Should contain the title (ical-generator handles escaping)
      expect(text).toContain('SUMMARY');
    });

    it('should handle completed tasks', async () => {
      const completedEvent: CalendarEvent = {
        id: 'task-completed',
        title: 'Completed task',
        start: new Date('2025-10-15T10:00:00.000Z'),
        end: new Date('2025-10-15T10:00:00.000Z'),
        resource: {
          taskId: 'task-completed',
          status: 'COMPLETED',
          priority: 7,
          isCompleted: true,
          isStarted: true,
          isOverdue: false,
          description: 'Completed task test',
          createdAt: new Date('2025-10-10T00:00:00.000Z'),
          departmentName: 'Engineering',
          ownerName: 'John Doe',
          ownerEmail: 'john@example.com',
          assigneeDetails: [{ name: 'User 1', email: 'user1@example.com' }],
          tags: [],
          recurringInterval: null,
          parentTaskId: null,
        },
      };

      exportToICal([completedEvent]);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      expect(text).toContain('Status: COMPLETED');
    });

    it('should handle events with multiple assignees', async () => {
      const multiAssigneeEvent: CalendarEvent = {
        id: 'task-multi',
        title: 'Team collaboration',
        start: new Date('2025-10-20T10:00:00.000Z'),
        end: new Date('2025-10-20T10:00:00.000Z'),
        resource: {
          taskId: 'task-multi',
          status: 'TO_DO',
          priority: 5,
          isCompleted: false,
          isStarted: false,
          isOverdue: false,
          description: 'Multi-assignee task test',
          createdAt: new Date('2025-10-15T00:00:00.000Z'),
          departmentName: 'Engineering',
          ownerName: 'John Doe',
          ownerEmail: 'john@example.com',
          assigneeDetails: [
            { name: 'User 1', email: 'user1@example.com' },
            { name: 'User 2', email: 'user2@example.com' },
            { name: 'User 3', email: 'user3@example.com' },
            { name: 'User 4', email: 'user4@example.com' },
          ],
          tags: [],
          recurringInterval: null,
          parentTaskId: null,
        },
      };

      exportToICal([multiAssigneeEvent]);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // Should include assignee count or list in description
      expect(text).toContain('DESCRIPTION');
    });

    it('should handle large number of events (100+)', async () => {
      const manyEvents: CalendarEvent[] = Array.from(
        { length: 150 },
        (_, i) => ({
          id: `task-${i}`,
          title: `Task ${i}`,
          start: new Date('2025-10-20T10:00:00.000Z'),
          end: new Date('2025-10-20T10:00:00.000Z'),
          resource: {
            taskId: `task-${i}`,
            status: 'TO_DO' as const,
            priority: 5,
            isCompleted: false,
            isStarted: false,
            isOverdue: false,
            description: `Task ${i} description`,
            createdAt: new Date('2025-10-15T00:00:00.000Z'),
            departmentName: 'Engineering',
            ownerName: 'John Doe',
            ownerEmail: 'john@example.com',
            assigneeDetails: [{ name: 'User 1', email: 'user1@example.com' }],
            tags: [],
            recurringInterval: null,
            parentTaskId: null,
          },
        })
      );

      exportToICal(manyEvents);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      const veventMatches = text.match(/BEGIN:VEVENT/g);
      expect(veventMatches).toHaveLength(150);
    });
  });

  describe('File download behavior', () => {
    it('should set correct href on link element', () => {
      const mockLink = {
        href: '',
        download: '',
        click: mockClick,
        style: {},
      };

      mockCreateElement.mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return mockLink as any;
        }
        return {} as any;
      });

      exportToICal(mockEvents);

      expect(mockLink.href).toBe('blob:mock-url');
    });

    it('should set download attribute with .ics extension', () => {
      const mockLink = {
        href: '',
        download: '',
        click: mockClick,
        style: {},
      };

      mockCreateElement.mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return mockLink as any;
        }
        return {} as any;
      });

      exportToICal(mockEvents, 'my-calendar.ics');

      expect(mockLink.download).toBe('my-calendar.ics');
    });

    it('should append and remove link from document body', () => {
      exportToICal(mockEvents);

      expect(mockAppendChild).toHaveBeenCalledTimes(1);
      expect(mockRemoveChild).toHaveBeenCalledTimes(1);
    });
  });

  describe('Default filename', () => {
    it('should use "tasks.ics" as default filename', () => {
      const mockLink = {
        href: '',
        download: '',
        click: mockClick,
        style: {},
      };

      mockCreateElement.mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return mockLink as any;
        }
        return {} as any;
      });

      exportToICal(mockEvents);

      expect(mockLink.download).toBe('tasks.ics');
    });
  });

  describe('Branch coverage - Tags, Attendees, and Recurring', () => {
    it('should include tags in description when tags exist', async () => {
      const eventWithTags: CalendarEvent[] = [
        {
          id: 'task-with-tags',
          title: 'Task with tags',
          start: new Date('2025-10-20T10:00:00.000Z'),
          end: new Date('2025-10-20T10:00:00.000Z'),
          resource: {
            taskId: 'task-with-tags',
            status: 'TO_DO',
            priority: 5,
            isCompleted: false,
            isStarted: false,
            isOverdue: false,
            description: 'Task with multiple tags',
            createdAt: new Date('2025-10-15T00:00:00.000Z'),
            departmentName: 'Engineering',
            ownerName: 'John Doe',
            ownerEmail: 'john@example.com',
            assigneeDetails: [{ name: 'User 1', email: 'user1@example.com' }],
            tags: ['urgent', 'frontend', 'bug-fix'],
            recurringInterval: null,
            parentTaskId: null,
          },
        },
      ];

      exportToICal(eventWithTags);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // Description should contain tags with # prefix (may be line-wrapped)
      expect(text).toContain('Tags:');
      expect(text).toContain('urgent');
      expect(text).toContain('frontend');
      expect(text).toContain('bug');
      // Categories should be present in iCal format
      expect(text).toContain('CATEGORIES');
      expect(text).toContain('urgent,frontend,bug-fix');
    });

    it('should handle events with valid attendees (emails present)', async () => {
      const eventWithAttendees: CalendarEvent[] = [
        {
          id: 'task-attendees',
          title: 'Task with multiple attendees',
          start: new Date('2025-10-20T10:00:00.000Z'),
          end: new Date('2025-10-20T10:00:00.000Z'),
          resource: {
            taskId: 'task-attendees',
            status: 'IN_PROGRESS',
            priority: 8,
            isCompleted: false,
            isStarted: true,
            isOverdue: false,
            description: 'Task with valid attendees',
            createdAt: new Date('2025-10-15T00:00:00.000Z'),
            departmentName: 'Engineering',
            ownerName: 'John Doe',
            ownerEmail: 'john@example.com',
            assigneeDetails: [
              { name: 'Alice Brown', email: 'alice@example.com' },
              { name: 'Bob Green', email: 'bob@example.com' },
            ],
            tags: [],
            recurringInterval: null,
            parentTaskId: null,
          },
        },
      ];

      exportToICal(eventWithAttendees);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // Should include attendees
      expect(text).toContain('ATTENDEE');
      expect(text).toContain('alice@example.com');
      expect(text).toContain('bob@example.com');
    });

    it('should filter out attendees without emails', async () => {
      const eventWithMixedAttendees: CalendarEvent[] = [
        {
          id: 'task-mixed-attendees',
          title: 'Task with mixed attendees',
          start: new Date('2025-10-20T10:00:00.000Z'),
          end: new Date('2025-10-20T10:00:00.000Z'),
          resource: {
            taskId: 'task-mixed-attendees',
            status: 'TO_DO',
            priority: 5,
            isCompleted: false,
            isStarted: false,
            isOverdue: false,
            description: 'Some attendees without emails',
            createdAt: new Date('2025-10-15T00:00:00.000Z'),
            departmentName: 'Engineering',
            ownerName: 'John Doe',
            ownerEmail: 'john@example.com',
            assigneeDetails: [
              { name: 'Valid User', email: 'valid@example.com' },
              { name: 'No Email User', email: '' }, // Empty email - should be filtered
            ],
            tags: [],
            recurringInterval: null,
            parentTaskId: null,
          },
        },
      ];

      exportToICal(eventWithMixedAttendees);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // Should only include valid attendee in ATTENDEE field
      expect(text).toContain('valid@example.com');
      // No Email User will be in description (assigned list) but not as ATTENDEE
      // The ATTENDEE section should only have emails
      const attendeeMatches = text.match(/ATTENDEE.*No Email User/);
      expect(attendeeMatches).toBeNull();
    });

    it('should handle recurring tasks with interval', async () => {
      const recurringEvent: CalendarEvent[] = [
        {
          id: 'task-recurring',
          title: 'Daily recurring task',
          start: new Date('2025-10-20T10:00:00.000Z'),
          end: new Date('2025-10-20T10:00:00.000Z'),
          resource: {
            taskId: 'task-recurring',
            status: 'IN_PROGRESS',
            priority: 7,
            isCompleted: false,
            isStarted: true,
            isOverdue: false,
            description: 'Task that repeats every 2 days',
            createdAt: new Date('2025-10-15T00:00:00.000Z'),
            departmentName: 'Operations',
            ownerName: 'Jane Smith',
            ownerEmail: 'jane@example.com',
            assigneeDetails: [{ name: 'User 1', email: 'user1@example.com' }],
            tags: [],
            recurringInterval: 2,
            parentTaskId: null,
          },
        },
      ];

      exportToICal(recurringEvent);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // Should include recurring rule
      expect(text).toContain('RRULE');
      expect(text).toContain('FREQ=DAILY');
      expect(text).toContain('INTERVAL=2');
    });

    it('should filter out empty tags', async () => {
      const eventWithEmptyTags: CalendarEvent[] = [
        {
          id: 'task-empty-tags',
          title: 'Task with empty tags',
          start: new Date('2025-10-20T10:00:00.000Z'),
          end: new Date('2025-10-20T10:00:00.000Z'),
          resource: {
            taskId: 'task-empty-tags',
            status: 'TO_DO',
            priority: 5,
            isCompleted: false,
            isStarted: false,
            isOverdue: false,
            description: 'Task with some empty tags',
            createdAt: new Date('2025-10-15T00:00:00.000Z'),
            departmentName: 'Engineering',
            ownerName: 'John Doe',
            ownerEmail: 'john@example.com',
            assigneeDetails: [],
            tags: ['valid-tag', '', '  ', 'another-tag'], // Mix of valid and empty
            recurringInterval: null,
            parentTaskId: null,
          },
        },
      ];

      exportToICal(eventWithEmptyTags);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // Should only include non-empty tags
      expect(text).toContain('valid-tag');
      expect(text).toContain('another-tag');
    });

    it('should not add categories when all tags are empty', async () => {
      const eventWithOnlyEmptyTags: CalendarEvent[] = [
        {
          id: 'task-only-empty-tags',
          title: 'Task with only empty tags',
          start: new Date('2025-10-20T10:00:00.000Z'),
          end: new Date('2025-10-20T10:00:00.000Z'),
          resource: {
            taskId: 'task-only-empty-tags',
            status: 'TO_DO',
            priority: 5,
            isCompleted: false,
            isStarted: false,
            isOverdue: false,
            description: 'Task with only empty tags',
            createdAt: new Date('2025-10-15T00:00:00.000Z'),
            departmentName: 'Engineering',
            ownerName: 'John Doe',
            ownerEmail: 'john@example.com',
            assigneeDetails: [],
            tags: ['', '  ', '   '], // All empty/whitespace
            recurringInterval: null,
            parentTaskId: null,
          },
        },
      ];

      exportToICal(eventWithOnlyEmptyTags);

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobAsText(blob);

      // Should not include CATEGORIES since all tags are empty
      const categoriesMatch = text.match(/CATEGORIES:/g);
      expect(categoriesMatch).toBeNull();
    });
  });
});
