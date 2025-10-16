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
        departmentId: 'dept-1',
        assignees: ['user-1'],
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
        departmentId: 'dept-2',
        assignees: ['user-2', 'user-3'],
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
          departmentId: 'dept-1',
          assignees: ['user-1'],
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
          departmentId: 'dept-1',
          assignees: ['user-1'],
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
          departmentId: 'dept-1',
          assignees: ['user-1', 'user-2', 'user-3', 'user-4'],
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
            departmentId: 'dept-1',
            assignees: ['user-1'],
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
});
