/**
 * Unit Tests for exportProjectToXLSX Utility
 *
 * Tests Excel/XLSX export capability - verifies file generation, not exact content
 * Focus: Can we export?
 */

import { exportProjectToXLSX } from '@/app/components/ProjectReport/utils/exportProjectToXLSX';
import type { ProjectReportData } from '@/services/project/ProjectReportService';
import ExcelJS from 'exceljs';

// Mock ExcelJS library
const mockAddRow = jest.fn();
const mockGetRow = jest.fn(() => ({
  font: {},
  fill: {},
  alignment: {},
  getCell: jest.fn(() => ({
    font: {},
    fill: {},
    alignment: {},
  })),
  eachCell: jest.fn(),
}));
const mockGetColumn = jest.fn(() => ({ width: 0 }));
const mockEachRow = jest.fn(callback => {
  // Simulate calling the callback for a few rows
  callback(mockGetRow(), 1);
  callback(mockGetRow(), 2);
});

const mockWorksheet = {
  addRow: mockAddRow,
  getRow: mockGetRow,
  getColumn: mockGetColumn,
  eachRow: mockEachRow,
  columns: [],
  mergeCells: jest.fn(),
};

const mockWriteBuffer = jest.fn(() =>
  Promise.resolve(Buffer.from('mock-excel-content'))
);

const mockAddWorksheet = jest.fn(() => mockWorksheet);

const mockWorkbook = {
  addWorksheet: mockAddWorksheet,
  xlsx: {
    writeBuffer: mockWriteBuffer,
  },
};

jest.mock('exceljs', () => ({
  __esModule: true,
  default: {
    Workbook: jest.fn(() => mockWorkbook),
  },
}));

describe('exportProjectToXLSX - Export Capability Tests', () => {
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
      createdAt: new Date('2025-10-01T00:00:00.000Z'),
      updatedAt: new Date('2025-10-20T00:00:00.000Z'),
    },
    tasks: [
      {
        id: 'task-1',
        title: 'Design Homepage',
        description: 'Create homepage mockup',
        status: 'COMPLETED',
        priority: 9,
        startDate: new Date('2025-10-05T00:00:00.000Z'),
        dueDate: new Date('2025-10-15T00:00:00.000Z'),
        createdAt: new Date('2025-10-05T00:00:00.000Z'),
        ownerName: 'Jane Smith',
        ownerEmail: 'jane@example.com',
        assignees: ['Alice Johnson'],
        tags: ['UI', 'Design'],
        departments: ['Engineering'],
      },
      {
        id: 'task-2',
        title: 'Implement Backend',
        description: 'Create API endpoints',
        status: 'IN_PROGRESS',
        priority: 7,
        startDate: new Date('2025-10-10T00:00:00.000Z'),
        dueDate: new Date('2025-10-25T00:00:00.000Z'),
        createdAt: new Date('2025-10-10T00:00:00.000Z'),
        ownerName: 'Bob Wilson',
        ownerEmail: 'bob@example.com',
        assignees: ['Charlie Brown', 'David Lee'],
        tags: ['Backend', 'API'],
        departments: ['Engineering', 'Backend'],
      },
    ],
    collaborators: [
      {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        departmentName: 'Engineering',
        addedAt: new Date('2025-10-05T00:00:00.000Z'),
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock URL methods
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = jest.fn();
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = jest.fn();
    }

    mockCreateObjectURL = jest
      .spyOn(window.URL, 'createObjectURL')
      .mockReturnValue('blob:mock-xlsx-url');

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
    jest.restoreAllMocks();
  });

  describe('Core Export Capability', () => {
    it('should successfully generate and download XLSX', async () => {
      await expect(exportProjectToXLSX(mockProjectData)).resolves.not.toThrow();

      // Verify workbook creation and download triggered
      expect(ExcelJS.Workbook).toHaveBeenCalled();
      expect(mockWriteBuffer).toHaveBeenCalled();
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('should create workbook with ExcelJS library', async () => {
      await exportProjectToXLSX(mockProjectData);

      // Verify ExcelJS Workbook was instantiated (i.e., XLSX generation attempted)
      expect(ExcelJS.Workbook).toHaveBeenCalled();
    });

    it('should generate buffer with content', async () => {
      await exportProjectToXLSX(mockProjectData);

      // Verify buffer was created (contains data)
      expect(mockWriteBuffer).toHaveBeenCalled();
      const buffer = await mockWriteBuffer.mock.results[0].value;
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should create multiple worksheets', async () => {
      await exportProjectToXLSX(mockProjectData);

      // Verify worksheets were created (at least Overview sheet)
      expect(mockAddWorksheet).toHaveBeenCalled();
      expect(mockAddWorksheet.mock.calls.length).toBeGreaterThan(0);
    });

    it('should add rows to worksheets', async () => {
      await exportProjectToXLSX(mockProjectData);

      // Verify content was added to sheets
      expect(mockAddRow).toHaveBeenCalled();
    });

    it('should use project name as filename', async () => {
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

      await exportProjectToXLSX(mockProjectData);

      expect(mockLink.download).toContain('Website_Redesign');
      expect(mockLink.download).toContain('.xlsx');
    });

    it('should accept custom filename', async () => {
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

      await exportProjectToXLSX(mockProjectData, 'custom-report.xlsx');

      expect(mockLink.download).toBe('custom-report.xlsx');
    });

    it('should clean up blob URL after download', async () => {
      await exportProjectToXLSX(mockProjectData);

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-xlsx-url');
    });
  });

  describe('Excel Content Structure', () => {
    it('should create 4 worksheets with correct names', async () => {
      await exportProjectToXLSX(mockProjectData);

      expect(mockAddWorksheet).toHaveBeenCalledTimes(4);
      expect(mockAddWorksheet).toHaveBeenCalledWith('Overview');
      expect(mockAddWorksheet).toHaveBeenCalledWith('Tasks by Status');
      expect(mockAddWorksheet).toHaveBeenCalledWith('Schedule Overview');
      expect(mockAddWorksheet).toHaveBeenCalledWith('Collaborators');
    });

    it('should add task headers to Tasks by Status sheet', async () => {
      await exportProjectToXLSX(mockProjectData);

      // Check that addRow was called with task headers
      const taskHeaderCalls = mockAddRow.mock.calls.filter(
        call => call[0] && Array.isArray(call[0]) && call[0].includes('Title')
      );
      expect(taskHeaderCalls.length).toBeGreaterThanOrEqual(1);

      const taskHeaders = taskHeaderCalls[0][0];
      expect(taskHeaders).toEqual([
        'Title',
        'Status',
        'Priority',
        'Due Date',
        'Assignees',
        'Tags',
        'Departments',
      ]);
    });

    it('should add task headers to Schedule Overview sheet', async () => {
      await exportProjectToXLSX(mockProjectData);

      // Check that addRow was called with schedule headers
      const scheduleHeaderCalls = mockAddRow.mock.calls.filter(
        call =>
          call[0] &&
          Array.isArray(call[0]) &&
          call[0].includes('Title') &&
          call[0].includes('Status')
      );
      expect(scheduleHeaderCalls.length).toBeGreaterThanOrEqual(1);

      const scheduleHeaders = scheduleHeaderCalls[0][0];
      expect(scheduleHeaders).toEqual([
        'Title',
        'Status',
        'Priority',
        'Due Date',
        'Assignees',
        'Tags',
        'Departments',
      ]);
    });

    it('should add collaborator headers to Collaborators sheet', async () => {
      await exportProjectToXLSX(mockProjectData);

      // Check that addRow was called with collaborator headers
      const collabHeaderCalls = mockAddRow.mock.calls.filter(
        call => call[0] && Array.isArray(call[0]) && call[0].includes('Name')
      );
      expect(collabHeaderCalls.length).toBeGreaterThanOrEqual(1);

      const collabHeaders = collabHeaderCalls[0][0];
      expect(collabHeaders).toEqual([
        'Name',
        'Email',
        'Department',
        'Added Date',
      ]);
    });

    it('should add section headers for status groups', async () => {
      await exportProjectToXLSX(mockProjectData);

      // Check for status section headers (now arrays with single string element)
      const statusSectionCalls = mockAddRow.mock.calls.filter(
        call =>
          call[0] &&
          Array.isArray(call[0]) &&
          call[0].length === 1 &&
          typeof call[0][0] === 'string' &&
          (call[0][0].includes('To Do') ||
            call[0][0].includes('In Progress') ||
            call[0][0].includes('Completed') ||
            call[0][0].includes('Blocked'))
      );
      expect(statusSectionCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should add section headers for time buckets', async () => {
      await exportProjectToXLSX(mockProjectData);

      // Check for schedule section headers (now arrays with single string element)
      const scheduleSectionCalls = mockAddRow.mock.calls.filter(
        call =>
          call[0] &&
          Array.isArray(call[0]) &&
          call[0].length === 1 &&
          typeof call[0][0] === 'string' &&
          (call[0][0].includes('Overdue') ||
            call[0][0].includes('Due Today') ||
            call[0][0].includes('Due This Week') ||
            call[0][0].includes('Due This Month'))
      );
      expect(scheduleSectionCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should add task data with proper formatting', async () => {
      await exportProjectToXLSX(mockProjectData);

      // Check that task data was added with proper values
      const taskDataCalls = mockAddRow.mock.calls.filter(
        call =>
          call[0] &&
          Array.isArray(call[0]) &&
          call[0].length === 7 &&
          call[0][0] === 'Design Homepage'
      );
      expect(taskDataCalls.length).toBeGreaterThanOrEqual(1);

      const taskData = taskDataCalls[0][0];
      expect(taskData[0]).toBe('Design Homepage');
      expect(taskData[1]).toBe('COMPLETED');
      expect(taskData[2]).toBe(9);
      expect(taskData[4]).toBe('Alice Johnson');
      expect(taskData[5]).toBe('UI, Design');
      expect(taskData[6]).toBe('Engineering');
    });

    it('should add collaborator data with proper formatting', async () => {
      await exportProjectToXLSX(mockProjectData);

      // Check that collaborator data was added
      const collabDataCalls = mockAddRow.mock.calls.filter(
        call =>
          call[0] &&
          Array.isArray(call[0]) &&
          call[0].length === 4 &&
          call[0][0] === 'Alice Johnson'
      );
      expect(collabDataCalls.length).toBeGreaterThanOrEqual(1);

      const collabData = collabDataCalls[0][0];
      expect(collabData[0]).toBe('Alice Johnson');
      expect(collabData[1]).toBe('alice@example.com');
      expect(collabData[2]).toBe('Engineering');
    });
  });

  describe('Edge Cases - Export Robustness', () => {
    it('should handle project with null description', async () => {
      const dataWithoutDesc: ProjectReportData = {
        ...mockProjectData,
        project: {
          ...mockProjectData.project,
          description: null,
        },
      };

      await expect(exportProjectToXLSX(dataWithoutDesc)).resolves.not.toThrow();
    });

    it('should handle project with empty tasks array', async () => {
      const dataWithoutTasks: ProjectReportData = {
        ...mockProjectData,
        tasks: [],
      };

      await expect(
        exportProjectToXLSX(dataWithoutTasks)
      ).resolves.not.toThrow();
    });

    it('should handle project with empty collaborators array', async () => {
      const dataWithoutCollabs: ProjectReportData = {
        ...mockProjectData,
        collaborators: [],
      };

      await expect(
        exportProjectToXLSX(dataWithoutCollabs)
      ).resolves.not.toThrow();
    });

    it('should handle long project names', async () => {
      const dataWithLongName: ProjectReportData = {
        ...mockProjectData,
        project: {
          ...mockProjectData.project,
          name: 'Very Long Project Name That Exceeds Normal Length And Should Be Handled Gracefully',
        },
      };

      await expect(
        exportProjectToXLSX(dataWithLongName)
      ).resolves.not.toThrow();
    });

    it('should handle special characters in project name', async () => {
      const dataWithSpecialChars: ProjectReportData = {
        ...mockProjectData,
        project: {
          ...mockProjectData.project,
          name: 'Project: "Alpha & Beta" <2025>',
        },
      };

      await expect(
        exportProjectToXLSX(dataWithSpecialChars)
      ).resolves.not.toThrow();
    });
  });
});
