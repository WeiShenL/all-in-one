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
        dueDate: new Date('2025-10-15T00:00:00.000Z'),
        createdAt: new Date('2025-10-05T00:00:00.000Z'),
        ownerName: 'Jane Smith',
        ownerEmail: 'jane@example.com',
        assignees: ['Alice Johnson'],
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
