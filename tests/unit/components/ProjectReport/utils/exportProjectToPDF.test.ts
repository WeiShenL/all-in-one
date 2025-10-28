/**
 * Unit Tests for exportProjectToPDF Utility
 *
 * Tests PDF export capability - verifies file generation, not exact content
 * Focus: Can we export?
 */

import { exportProjectToPDF } from '@/app/components/ProjectReport/utils/exportProjectToPDF';
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
  });
});
