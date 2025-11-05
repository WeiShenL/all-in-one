/**
 * Unit Tests for exportProjectToPDF Utility
 *
 * Tests PDF export capability - verifies file generation, not exact content
 * Focus: Can we export?
 */

import {
  exportProjectToPDF,
  buildProjectReportPDFBlob,
} from '@/app/components/ProjectReport/utils/exportProjectToPDF';
import type { ProjectReportData } from '@/services/project/ProjectReportService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Mock jsPDF and autoTable
jest.mock('jspdf', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      text: jest.fn(),
      setFontSize: jest.fn(),
      setFont: jest.fn(),
      setTextColor: jest.fn(),
      setFillColor: jest.fn(),
      rect: jest.fn(),
      roundedRect: jest.fn(),
      getTextWidth: jest.fn(() => 50),
      addPage: jest.fn(),
      save: jest.fn(),
      output: jest.fn(
        () => new Blob(['mock-pdf-content'], { type: 'application/pdf' })
      ),
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
        pages: [null, {}],
        getCurrentPageInfo: () => ({ pageNumber: 1 }),
      },
      lastAutoTable: {
        finalY: 100,
      },
    })),
    jsPDF: jest.fn(),
  };
});

jest.mock('jspdf-autotable', () => jest.fn());

describe('exportProjectToPDF - Export Capability Tests', () => {
  let mockCreateObjectURL: jest.SpyInstance;
  let mockRevokeObjectURL: jest.SpyInstance;

  const mockProjectData: ProjectReportData = {
    project: {
      id: 'proj-1',
      name: 'Website Redesign',
      description: 'Redesign company website with modern UI',
      priority: 8,
      status: 'ACTIVE',
      departmentName: 'Engineering',
      creatorName: 'John Doe',
      creatorEmail: 'john@example.com',
      createdAt: new Date('2025-10-01'),
      updatedAt: new Date('2025-10-20'),
    },
    tasks: [
      {
        id: 'task-1',
        title: 'Design Homepage',
        description: 'Create homepage mockup',
        status: 'COMPLETED',
        priority: 9,
        startDate: new Date('2025-10-05'),
        dueDate: new Date('2025-10-15'),
        createdAt: new Date('2025-10-05'),
        ownerName: 'Jane Smith',
        ownerEmail: 'jane@example.com',
        assignees: ['Alice Johnson'],
        tags: ['UI', 'Design'],
        departments: ['Engineering'],
      },
    ],
    collaborators: [
      {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        departmentName: 'Engineering',
        addedAt: new Date('2025-10-05'),
      },
    ],
  };

  beforeEach(() => {
    // Mock URL methods
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = jest.fn();
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = jest.fn();
    }

    mockCreateObjectURL = jest
      .spyOn(window.URL, 'createObjectURL')
      .mockReturnValue('blob:mock-pdf-url');

    mockRevokeObjectURL = jest
      .spyOn(window.URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    // Mock document methods
    const mockClick = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation(tagName => {
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
      .mockImplementation(() => null as any);
    jest
      .spyOn(document.body, 'removeChild')
      .mockImplementation(() => null as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Core Export Capability', () => {
    it('should successfully generate and download PDF', () => {
      expect(() => exportProjectToPDF(mockProjectData)).not.toThrow();

      // Verify download was triggered
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');
    });

    it('should create PDF with jsPDF library', () => {
      exportProjectToPDF(mockProjectData);

      // Verify jsPDF instance was created (i.e., PDF generation attempted)
      expect(jsPDF).toHaveBeenCalled();
    });

    it('should generate blob with content', () => {
      const mockOutput = jest.fn(
        () => new Blob(['pdf-content'], { type: 'application/pdf' })
      );

      (jsPDF as unknown as jest.Mock).mockImplementation(() => ({
        text: jest.fn(),
        setFontSize: jest.fn(),
        setFont: jest.fn(),
        setTextColor: jest.fn(),
        setFillColor: jest.fn(),
        rect: jest.fn(),
        roundedRect: jest.fn(),
        getTextWidth: jest.fn(() => 50),
        addPage: jest.fn(),
        save: jest.fn(),
        output: mockOutput,
        internal: {
          pageSize: {
            getWidth: () => 210,
            getHeight: () => 297,
          },
          pages: [null, {}],
          getCurrentPageInfo: () => ({ pageNumber: 1 }),
        },
        lastAutoTable: { finalY: 100 },
      }));

      exportProjectToPDF(mockProjectData);

      expect(mockOutput).toHaveBeenCalledWith('blob');
    });

    it('should use project name as filename', () => {
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
        style: {},
      };

      jest.spyOn(document, 'createElement').mockImplementation(tagName => {
        if (tagName === 'a') {
          return mockLink as any;
        }
        return {} as any;
      });

      exportProjectToPDF(mockProjectData);

      expect(mockLink.download).toContain('Website_Redesign');
      expect(mockLink.download).toContain('.pdf');
    });

    it('should accept custom filename', () => {
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
        style: {},
      };

      jest.spyOn(document, 'createElement').mockImplementation(tagName => {
        if (tagName === 'a') {
          return mockLink as any;
        }
        return {} as any;
      });

      exportProjectToPDF(mockProjectData, 'custom-report.pdf');

      expect(mockLink.download).toBe('custom-report.pdf');
    });

    it('should clean up blob URL after download', () => {
      exportProjectToPDF(mockProjectData);

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-pdf-url');
    });
  });

  describe('Report Content - Sections and Columns', () => {
    it('renders section tables with Tags and Departments with comma+newline separation', () => {
      // Arrange: a dataset with one task in IN_PROGRESS with multiple values
      const data: ProjectReportData = {
        project: mockProjectData.project,
        tasks: [
          {
            id: 't-1',
            title: 'with tag',
            description: 'd',
            status: 'IN_PROGRESS' as any,
            priority: 5,
            dueDate: new Date('2025-10-28'),
            createdAt: new Date('2025-10-20'),
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            assignees: ['manager', 'Finance Executive Two'],
            tags: ['appear', 'again'],
            departments: ['Consultancy Division', 'Finance Executive'],
          } as any,
        ],
        collaborators: mockProjectData.collaborators,
      } as any;

      // Act
      (autoTable as jest.Mock).mockClear();
      exportProjectToPDF(data);

      // Assert: there should be 1 overview table + 4 section tables
      const calls = (autoTable as jest.Mock).mock.calls as Array<any[]>;
      expect(calls.length).toBeGreaterThanOrEqual(5);

      // Collect all section tables (there are 4)
      const sectionCalls = calls.filter(args => {
        const opts = args[1] ?? args[0];
        return (
          opts &&
          opts.head &&
          JSON.stringify(opts.head).includes('Assignees') &&
          JSON.stringify(opts.head).includes('Departments')
        );
      });

      expect(sectionCalls.length).toBeGreaterThanOrEqual(1);

      // Find the row for our task across any section (IN_PROGRESS)
      const allRows: string[][] = sectionCalls.flatMap(sc => {
        const o = (sc as any)[1] ?? (sc as any)[0];
        return o.body as string[][];
      });

      // Titles may contain soft wrap characters \u200B, strip before matching
      const bodyRow = allRows.find(
        row => (row[0] || '').replace(/\u200B/g, '') === 'with tag'
      );
      expect(bodyRow).toBeTruthy();
      if (!bodyRow) {
        return;
      } // TS narrow for following assertions
      expect(bodyRow[3]).toContain('manager');
      expect(bodyRow[3]).toContain(',\n');
      expect(bodyRow[4]).toContain('appear');
      expect(bodyRow[4]).toContain(',\n');
      expect(bodyRow[5]).toContain('Consultancy Division');
      expect(bodyRow[5]).toContain(',\n');
    });

    it('renders schedule section with time buckets and Status column', () => {
      // Arrange: tasks with different due dates to test time buckets
      const now = new Date('2025-10-20T12:00:00Z');
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const overdue = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      const data: ProjectReportData = {
        project: mockProjectData.project,
        tasks: [
          {
            id: 'overdue-task',
            title: 'Overdue Task',
            description: 'd',
            status: 'BLOCKED' as any,
            priority: 8,
            startDate: overdue,
            dueDate: overdue,
            createdAt: new Date('2025-10-15'),
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            assignees: ['Alice', 'Bob'],
            tags: ['urgent', 'critical'],
            departments: ['Engineering', 'QA'],
          } as any,
          {
            id: 'today-task',
            title: 'Today Task',
            description: 'd',
            status: 'IN_PROGRESS' as any,
            priority: 5,
            startDate: today,
            dueDate: today,
            createdAt: new Date('2025-10-20'),
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            assignees: ['Charlie'],
            tags: ['important'],
            departments: ['Design'],
          } as any,
          {
            id: 'week-task',
            title: 'This Week Task',
            description: 'd',
            status: 'TO_DO' as any,
            priority: 3,
            startDate: tomorrow,
            dueDate: nextWeek,
            createdAt: new Date('2025-10-21'),
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            assignees: ['David', 'Eve'],
            tags: ['feature', 'enhancement'],
            departments: ['Product'],
          } as any,
          {
            id: 'month-task',
            title: 'This Month Task',
            description: 'd',
            status: 'COMPLETED' as any,
            priority: 2,
            startDate: nextWeek,
            dueDate: nextMonth,
            createdAt: new Date('2025-10-25'),
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            assignees: ['Frank'],
            tags: ['maintenance'],
            departments: ['Operations'],
          } as any,
        ],
        collaborators: mockProjectData.collaborators,
      } as any;

      // Mock Date.now to return our fixed date
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => now.getTime());

      try {
        // Act
        (autoTable as jest.Mock).mockClear();
        exportProjectToPDF(data);

        // Assert: should have overview table + 4 status sections + 4 schedule buckets
        const calls = (autoTable as jest.Mock).mock.calls as Array<any[]>;
        expect(calls.length).toBeGreaterThanOrEqual(9); // 1 overview + 4 status + 4 schedule

        // Find schedule tables (should have Status column)
        const scheduleCalls = calls.filter(args => {
          const opts = args[1] ?? args[0];
          return (
            opts &&
            opts.head &&
            Array.isArray(opts.head[0]) &&
            opts.head[0].includes('Status') &&
            opts.head[0].includes('Due Date')
          );
        });

        expect(scheduleCalls.length).toBe(4); // Overdue, Due Today, Due This Week, Due This Month

        // Check that each schedule table has the correct columns
        scheduleCalls.forEach(call => {
          const opts = call[1] ?? call[0];
          const headers = opts.head[0];
          expect(headers).toEqual([
            'Title',
            'Status',
            'Priority',
            'Due Date',
            'Assignees',
            'Tags',
            'Departments',
          ]);
        });

        // Check that tasks are properly distributed across buckets
        const overdueTable = scheduleCalls.find(call => {
          const opts = call[1] ?? call[0];
          return opts.body.some((row: any[]) =>
            row[0]?.includes('Overdue Task')
          );
        });
        expect(overdueTable).toBeTruthy();

        const todayTable = scheduleCalls.find(call => {
          const opts = call[1] ?? call[0];
          return opts.body.some((row: any[]) => row[0]?.includes('Today Task'));
        });
        expect(todayTable).toBeTruthy();

        const weekTable = scheduleCalls.find(call => {
          const opts = call[1] ?? call[0];
          return opts.body.some((row: any[]) =>
            row[0]?.includes('This Week Task')
          );
        });
        expect(weekTable).toBeTruthy();

        const monthTable = scheduleCalls.find(call => {
          const opts = call[1] ?? call[0];
          return opts.body.some((row: any[]) =>
            row[0]?.includes('This Month Task')
          );
        });
        expect(monthTable).toBeTruthy();

        // Check that Status column shows proper values
        const allScheduleRows = scheduleCalls.flatMap(call => {
          const opts = call[1] ?? call[0];
          return opts.body;
        });

        const overdueRow = allScheduleRows.find(row =>
          row[0]?.includes('Overdue Task')
        );
        expect(overdueRow?.[1]).toBe('BLOCKED');

        const todayRow = allScheduleRows.find(row =>
          row[0]?.includes('Today Task')
        );
        expect(todayRow?.[1]).toBe('IN PROGRESS');

        const weekRow = allScheduleRows.find(row =>
          row[0]?.includes('This Week Task')
        );
        expect(weekRow?.[1]).toBe('TO DO');

        const monthRow = allScheduleRows.find(row =>
          row[0]?.includes('This Month Task')
        );
        expect(monthRow?.[1]).toBe('COMPLETED');
      } finally {
        // Restore original Date.now
        Date.now = originalDateNow;
      }
    });
  });

  describe('Edge Cases - Export Robustness', () => {
    it('should handle project with null description', () => {
      const dataWithoutDesc: ProjectReportData = {
        ...mockProjectData,
        project: {
          ...mockProjectData.project,
          description: null,
        },
      };

      expect(() => exportProjectToPDF(dataWithoutDesc)).not.toThrow();
    });

    it('should handle project with empty tasks array', () => {
      const dataWithoutTasks: ProjectReportData = {
        ...mockProjectData,
        tasks: [],
      };

      expect(() => exportProjectToPDF(dataWithoutTasks)).not.toThrow();
    });

    it('should handle project with empty collaborators array', () => {
      const dataWithoutCollabs: ProjectReportData = {
        ...mockProjectData,
        collaborators: [],
      };

      expect(() => exportProjectToPDF(dataWithoutCollabs)).not.toThrow();
    });

    it('should handle long project names', () => {
      const dataWithLongName: ProjectReportData = {
        ...mockProjectData,
        project: {
          ...mockProjectData.project,
          name: 'Very Long Project Name That Exceeds Normal Length And Should Be Handled Gracefully',
        },
      };

      expect(() => exportProjectToPDF(dataWithLongName)).not.toThrow();
    });

    it('should handle special characters in project name', () => {
      const dataWithSpecialChars: ProjectReportData = {
        ...mockProjectData,
        project: {
          ...mockProjectData.project,
          name: 'Project: "Alpha & Beta" <2025>',
        },
      };

      expect(() => exportProjectToPDF(dataWithSpecialChars)).not.toThrow();
    });

    it('should handle tasks with null dates', () => {
      const dataWithNullDates: ProjectReportData = {
        ...mockProjectData,
        tasks: [
          {
            id: 'task-1',
            title: 'Task without dates',
            description: 'Description',
            status: 'TO_DO',
            priority: 5,
            startDate: null as any,
            dueDate: null as any,
            createdAt: new Date(),
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            assignees: [],
            tags: [],
            departments: [],
          },
        ],
      };

      expect(() => exportProjectToPDF(dataWithNullDates)).not.toThrow();
    });

    it('should handle tasks with empty arrays', () => {
      const dataWithEmptyArrays: ProjectReportData = {
        ...mockProjectData,
        tasks: [
          {
            id: 'task-1',
            title: 'Minimal Task',
            description: 'Description',
            status: 'TO_DO',
            priority: 5,
            startDate: new Date(),
            dueDate: new Date(),
            createdAt: new Date(),
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            assignees: [],
            tags: [],
            departments: [],
          },
        ],
      };

      expect(() => exportProjectToPDF(dataWithEmptyArrays)).not.toThrow();
    });

    it('should handle tasks with very long titles', () => {
      const longTitle = 'A'.repeat(200);
      const dataWithLongTitle: ProjectReportData = {
        ...mockProjectData,
        tasks: [
          {
            id: 'task-1',
            title: longTitle,
            description: 'Description',
            status: 'IN_PROGRESS',
            priority: 5,
            startDate: new Date(),
            dueDate: new Date(),
            createdAt: new Date(),
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            assignees: ['Assignee'],
            tags: ['Tag'],
            departments: ['Dept'],
          },
        ],
      };

      expect(() => exportProjectToPDF(dataWithLongTitle)).not.toThrow();
    });

    it('should handle multiple tasks across all statuses', () => {
      const multiStatusData: ProjectReportData = {
        ...mockProjectData,
        tasks: [
          {
            id: 'task-1',
            title: 'To Do Task',
            description: 'Description',
            status: 'TO_DO',
            priority: 3,
            startDate: new Date(),
            dueDate: new Date(),
            createdAt: new Date(),
            ownerName: 'Owner 1',
            ownerEmail: 'owner1@example.com',
            assignees: ['Alice'],
            tags: ['Feature'],
            departments: ['Engineering'],
          },
          {
            id: 'task-2',
            title: 'In Progress Task',
            description: 'Description',
            status: 'IN_PROGRESS',
            priority: 7,
            startDate: new Date(),
            dueDate: new Date(),
            createdAt: new Date(),
            ownerName: 'Owner 2',
            ownerEmail: 'owner2@example.com',
            assignees: ['Bob'],
            tags: ['Bug'],
            departments: ['QA'],
          },
          {
            id: 'task-3',
            title: 'Blocked Task',
            description: 'Description',
            status: 'BLOCKED',
            priority: 9,
            startDate: new Date(),
            dueDate: new Date(),
            createdAt: new Date(),
            ownerName: 'Owner 3',
            ownerEmail: 'owner3@example.com',
            assignees: ['Charlie'],
            tags: ['Critical'],
            departments: ['DevOps'],
          },
          {
            id: 'task-4',
            title: 'Completed Task',
            description: 'Description',
            status: 'COMPLETED',
            priority: 5,
            startDate: new Date(),
            dueDate: new Date(),
            createdAt: new Date(),
            ownerName: 'Owner 4',
            ownerEmail: 'owner4@example.com',
            assignees: ['Diana'],
            tags: ['Enhancement'],
            departments: ['Product'],
          },
        ],
      };

      expect(() => exportProjectToPDF(multiStatusData)).not.toThrow();
    });

    it('should handle tasks with multiple assignees, tags, and departments', () => {
      const dataWithMultiples: ProjectReportData = {
        ...mockProjectData,
        tasks: [
          {
            id: 'task-1',
            title: 'Complex Task',
            description: 'Description',
            status: 'IN_PROGRESS',
            priority: 8,
            startDate: new Date(),
            dueDate: new Date(),
            createdAt: new Date(),
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            assignees: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
            tags: ['Feature', 'Critical', 'UI', 'Backend', 'Testing'],
            departments: ['Engineering', 'Design', 'QA', 'Product', 'DevOps'],
          },
        ],
      };

      expect(() => exportProjectToPDF(dataWithMultiples)).not.toThrow();
    });

    it('should handle empty project name gracefully', () => {
      const dataWithEmptyName: ProjectReportData = {
        ...mockProjectData,
        project: {
          ...mockProjectData.project,
          name: '',
        },
      };

      expect(() => exportProjectToPDF(dataWithEmptyName)).not.toThrow();
    });

    it('should handle project with all statuses ACTIVE', () => {
      const dataWithActiveStatus: ProjectReportData = {
        ...mockProjectData,
        project: {
          ...mockProjectData.project,
          status: 'ACTIVE',
        },
      };

      expect(() => exportProjectToPDF(dataWithActiveStatus)).not.toThrow();
    });

    it('should handle project with COMPLETED status', () => {
      const dataWithCompletedStatus: ProjectReportData = {
        ...mockProjectData,
        project: {
          ...mockProjectData.project,
          status: 'COMPLETED',
        },
      };

      expect(() => exportProjectToPDF(dataWithCompletedStatus)).not.toThrow();
    });

    it('should handle collaborators with long names', () => {
      const dataWithLongCollabName: ProjectReportData = {
        ...mockProjectData,
        collaborators: [
          {
            name: 'Very Long Collaborator Name That Exceeds Normal Length',
            email: 'longname@example.com',
            departmentName: 'Engineering',
            addedAt: new Date(),
          },
        ],
      };

      expect(() => exportProjectToPDF(dataWithLongCollabName)).not.toThrow();
    });

    it('should sanitize filename with multiple special characters', () => {
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
        style: {},
      };

      jest.spyOn(document, 'createElement').mockImplementation(tagName => {
        if (tagName === 'a') {
          return mockLink as any;
        }
        return {} as any;
      });

      const dataWithSpecialChars: ProjectReportData = {
        ...mockProjectData,
        project: {
          ...mockProjectData.project,
          name: 'Project: Test & "Demo" <2025> | Final',
        },
      };

      exportProjectToPDF(dataWithSpecialChars);

      // Should remove/replace special characters in filename
      expect(mockLink.download).not.toContain(':');
      expect(mockLink.download).not.toContain('"');
      expect(mockLink.download).not.toContain('<');
      expect(mockLink.download).not.toContain('>');
      expect(mockLink.download).not.toContain('&');
    });
  });

  describe('Edge Cases and Helper Functions', () => {
    it('should handle status with default color case', () => {
      const dataWithUnknownStatus: ProjectReportData = {
        ...mockProjectData,
        project: {
          ...mockProjectData.project,
          status: 'UNKNOWN_STATUS' as any,
        },
      };

      // Should not throw and use default gray color
      expect(() => exportProjectToPDF(dataWithUnknownStatus)).not.toThrow();
    });

    it('should handle tasks with unknown status in task list', () => {
      const dataWithUnknownTaskStatus: ProjectReportData = {
        ...mockProjectData,
        tasks: [
          {
            ...mockProjectData.tasks[0],
            status: 'CUSTOM_STATUS' as any,
          },
        ],
      };

      expect(() => exportProjectToPDF(dataWithUnknownTaskStatus)).not.toThrow();
    });

    it('should handle empty/null text in content', () => {
      const dataWithEmptyFields: ProjectReportData = {
        ...mockProjectData,
        project: {
          ...mockProjectData.project,
          description: '',
        },
        tasks: [
          {
            ...mockProjectData.tasks[0],
            description: '',
            title: '',
          },
        ],
      };

      expect(() => exportProjectToPDF(dataWithEmptyFields)).not.toThrow();
    });

    it('should handle tasks with very long titles for text wrapping', () => {
      const dataWithLongTitle: ProjectReportData = {
        ...mockProjectData,
        tasks: [
          {
            ...mockProjectData.tasks[0],
            title: 'A'.repeat(200), // Very long title to trigger soft wrap
            description: 'B'.repeat(500), // Very long description
          },
        ],
      };

      expect(() => exportProjectToPDF(dataWithLongTitle)).not.toThrow();
    });
  });

  describe('buildProjectReportPDFBlob', () => {
    it('should generate a PDF blob without triggering download', () => {
      const blob = buildProjectReportPDFBlob(mockProjectData);

      expect(blob).toBeDefined();
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
    });

    it('should generate blob with project title and status', () => {
      const blob = buildProjectReportPDFBlob(mockProjectData);

      // Should create jsPDF instance
      expect(jsPDF).toHaveBeenCalled();
      expect(blob).toBeDefined();
    });

    it('should generate blob with all project statuses', () => {
      const statuses = [
        'ACTIVE',
        'COMPLETED',
        'IN_PROGRESS',
        'BLOCKED',
        'TO_DO',
      ];

      statuses.forEach(status => {
        const dataWithStatus: ProjectReportData = {
          ...mockProjectData,
          project: {
            ...mockProjectData.project,
            status: status as any,
          },
        };

        const blob = buildProjectReportPDFBlob(dataWithStatus);
        expect(blob).toBeInstanceOf(Blob);
      });
    });

    it('should generate blob with project overview table', () => {
      (autoTable as jest.Mock).mockClear();

      buildProjectReportPDFBlob(mockProjectData);

      // Should call autoTable for overview
      expect(autoTable).toHaveBeenCalled();

      const calls = (autoTable as jest.Mock).mock.calls;
      const overviewCall = calls.find((args: any[]) => {
        const opts = args[1] ?? args[0];
        return opts?.head?.[0]?.includes('Field');
      });

      expect(overviewCall).toBeDefined();
    });

    it('should generate blob with task sections', () => {
      const dataWithMultipleTasks: ProjectReportData = {
        ...mockProjectData,
        tasks: [
          {
            ...mockProjectData.tasks[0],
            status: 'COMPLETED',
          },
          {
            ...mockProjectData.tasks[0],
            id: 'task-2',
            title: 'In Progress Task',
            status: 'IN_PROGRESS',
          },
          {
            ...mockProjectData.tasks[0],
            id: 'task-3',
            title: 'Blocked Task',
            status: 'BLOCKED',
          },
        ] as any,
      };

      const blob = buildProjectReportPDFBlob(dataWithMultipleTasks);
      expect(blob).toBeInstanceOf(Blob);
    });

    it('should generate blob with schedule timeline', () => {
      const dataWithDatedTasks: ProjectReportData = {
        ...mockProjectData,
        tasks: [
          {
            ...mockProjectData.tasks[0],
            startDate: new Date('2025-10-01'),
            dueDate: new Date('2025-10-15'),
          },
          {
            ...mockProjectData.tasks[0],
            id: 'task-2',
            title: 'Second Task',
            startDate: new Date('2025-10-10'),
            dueDate: new Date('2025-10-20'),
          },
        ] as any,
      };

      const blob = buildProjectReportPDFBlob(dataWithDatedTasks);
      expect(blob).toBeInstanceOf(Blob);
    });

    it('should generate blob with empty tasks array', () => {
      const dataWithNoTasks: ProjectReportData = {
        ...mockProjectData,
        tasks: [],
      };

      const blob = buildProjectReportPDFBlob(dataWithNoTasks);
      expect(blob).toBeInstanceOf(Blob);
    });

    it('should not trigger download when generating blob', () => {
      const mockClick = jest.fn();
      jest.spyOn(document, 'createElement').mockImplementation(tagName => {
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

      buildProjectReportPDFBlob(mockProjectData);

      // Click should NOT be called (no download)
      expect(mockClick).not.toHaveBeenCalled();
    });

    it('should handle project with all field types filled', () => {
      const completeData: ProjectReportData = {
        project: {
          id: 'proj-complete',
          name: 'Complete Project',
          description: 'Full description here',
          priority: 10,
          status: 'ACTIVE',
          departmentName: 'Engineering Department',
          creatorName: 'Jane Doe',
          creatorEmail: 'jane.doe@example.com',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-11-06'),
        },
        tasks: [
          {
            id: 'task-complete',
            title: 'Complete Task',
            description: 'Full task description',
            status: 'IN_PROGRESS',
            priority: 8,
            startDate: new Date('2025-02-01'),
            dueDate: new Date('2025-03-01'),
            createdAt: new Date('2025-01-15'),
            ownerName: 'John Smith',
            ownerEmail: 'john.smith@example.com',
            assignees: ['Alice Brown', 'Bob Green'],
            tags: ['Frontend', 'UI', 'Critical'],
            departments: ['Engineering', 'Design'],
          },
        ],
        collaborators: [
          {
            name: 'Carol White',
            email: 'carol.white@example.com',
            departmentName: 'Product',
            addedAt: new Date('2025-01-20'),
          },
        ],
      };

      const blob = buildProjectReportPDFBlob(completeData);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });
  });
});
