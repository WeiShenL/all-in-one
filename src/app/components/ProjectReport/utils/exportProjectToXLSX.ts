/**
 * XLSX Export Utility for Project Reports
 *
 * Exports project report data to Excel format using exceljs
 * Creates multi-sheet workbook with comprehensive project data
 *
 * Sheets:
 * 1. Overview - Project details
 * 2. Tasks by Status - Tasks grouped by status (To Do, In Progress, Completed, Blocked)
 * 3. Schedule Overview - Tasks grouped by time buckets (Overdue, Due Today, Due This Week, Due This Month)
 * 4. Collaborators - Project collaborators
 */

import ExcelJS from 'exceljs';
import type { ProjectReportData } from '@/services/project/ProjectReportService';

/**
 * Sanitize filename - remove special characters and replace spaces
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[:"&<>]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .trim();
}

/**
 * Format date to readable string
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

/**
 * Export project report to XLSX
 *
 * @param data - Project report data from ProjectReportService
 * @param filename - Optional custom filename (default: ProjectName_Report.xlsx)
 */
export async function exportProjectToXLSX(
  data: ProjectReportData,
  filename?: string
): Promise<void> {
  // Create new workbook
  const workbook = new ExcelJS.Workbook();

  // Set workbook properties
  workbook.creator = 'All-In-One Task Manager';
  workbook.created = new Date();

  // ============================================
  // SHEET 1: Overview
  // ============================================
  const overviewSheet = workbook.addWorksheet('Overview');

  // Add overview data
  const overviewData = [
    ['Field', 'Value'],
    ['Project Name', data.project.name],
    ['Description', data.project.description || 'N/A'],
    ['Status', data.project.status],
    ['Priority', data.project.priority],
    ['Department', data.project.departmentName],
    ['Created By', data.project.creatorName],
    ['Creator Email', data.project.creatorEmail],
    ['Created Date', formatDate(data.project.createdAt)],
    ['Last Updated', formatDate(data.project.updatedAt)],
  ];

  overviewData.forEach(row => {
    overviewSheet.addRow(row);
  });

  // Style header row
  const overviewHeaderRow = overviewSheet.getRow(1);
  overviewHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  overviewHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' }, // Indigo
  };
  overviewHeaderRow.alignment = { vertical: 'middle', horizontal: 'left' };

  // Set column widths
  overviewSheet.getColumn(1).width = 20;
  overviewSheet.getColumn(2).width = 60;

  // Bold the field names (column A)
  overviewSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.getCell(1).font = { bold: true };
    }
  });

  // ============================================
  // SHEET 2: Tasks by Status
  // ============================================
  const tasksSheet = workbook.addWorksheet('Tasks by Status');

  // Add header
  const taskHeaders = [
    'Title',
    'Status',
    'Priority',
    'Due Date',
    'Assignees',
    'Tags',
    'Departments',
  ];
  tasksSheet.addRow(taskHeaders);

  // Style header
  const taskHeaderRow = tasksSheet.getRow(1);
  taskHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  taskHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' }, // Indigo
  };
  taskHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Freeze header row so it stays visible when scrolling
  tasksSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Group tasks by status
  const statusGroups = [
    { key: 'TO_DO', title: 'To Do', color: 'FF9CA3AF' },
    { key: 'IN_PROGRESS', title: 'In Progress', color: 'FF3B82F6' },
    { key: 'COMPLETED', title: 'Completed', color: 'FF22C55E' },
    { key: 'BLOCKED', title: 'Blocked', color: 'FFEF4444' },
  ];

  let currentRow = 2;

  statusGroups.forEach(group => {
    const groupTasks = data.tasks.filter(task => task.status === group.key);

    if (groupTasks.length > 0) {
      // Add section header as merged cell across all columns
      const sectionHeaderText = `${group.title} (${groupTasks.length} ${groupTasks.length === 1 ? 'task' : 'tasks'})`;
      tasksSheet.addRow([sectionHeaderText]);
      const sectionRow = tasksSheet.getRow(currentRow);
      sectionRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sectionRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: group.color },
      };
      sectionRow.alignment = { vertical: 'middle', horizontal: 'left' };
      // Merge cells across all 7 columns (guarded for mocked environments)
      if (typeof (tasksSheet as any).mergeCells === 'function') {
        (tasksSheet as any).mergeCells(currentRow, 1, currentRow, 7);
      }
      currentRow++;

      // Add task rows via addRow so tests can detect
      groupTasks.forEach(task => {
        tasksSheet.addRow([
          task.title,
          task.status.replace('_', ' '),
          task.priority,
          formatDate(task.dueDate),
          task.assignees.join(', '),
          task.tags.join(', '),
          task.departments.join(', '),
        ]);
        currentRow++;
      });

      // Add empty row for spacing
      tasksSheet.addRow(['']);
      currentRow++;
    }
  });

  // Set column widths
  tasksSheet.getColumn(1).width = 40; // Title
  tasksSheet.getColumn(2).width = 15; // Status
  tasksSheet.getColumn(3).width = 10; // Priority
  tasksSheet.getColumn(4).width = 15; // Due Date
  tasksSheet.getColumn(5).width = 30; // Assignees
  tasksSheet.getColumn(6).width = 20; // Tags
  tasksSheet.getColumn(7).width = 25; // Departments

  // ============================================
  // SHEET 3: Schedule Overview
  // ============================================
  const scheduleSheet = workbook.addWorksheet('Schedule Overview');

  // Add header
  scheduleSheet.addRow(taskHeaders);

  // Style header
  const scheduleHeaderRow = scheduleSheet.getRow(1);
  scheduleHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  scheduleHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' }, // Indigo
  };
  scheduleHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Add summary row like the PDF (Overdue | Today | This Week | This Month | Total)
  const totalTasks = data.tasks.length;
  const summaryRowIndex = 2;
  // Placeholder row; text populated after buckets computed
  scheduleSheet.addRow(['']);
  // Style summary row background (subtle gray)
  const summaryRow = scheduleSheet.getRow(summaryRowIndex);
  summaryRow.font = { bold: true, color: { argb: 'FF111827' } }; // Gray-900
  summaryRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' }, // Gray-200
  };
  scheduleSheet.mergeCells(summaryRowIndex, 1, summaryRowIndex, 7);

  // Freeze header + summary so they stay visible when scrolling
  scheduleSheet.views = [{ state: 'frozen', ySplit: 2 }];

  // Calculate time buckets
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const thirtyDaysFromNow = new Date(
    startOfToday.getTime() + 30 * 24 * 60 * 60 * 1000
  );

  const normalize = (d: Date | string) => (d instanceof Date ? d : new Date(d));
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  const bucketOverdue = data.tasks.filter(
    t => normalize(t.dueDate) < startOfToday
  );
  const bucketToday = data.tasks.filter(t =>
    isSameDay(normalize(t.dueDate), startOfToday)
  );
  const bucketThisWeek = data.tasks.filter(t => {
    const d = normalize(t.dueDate);
    const weekEnd = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    return d > startOfToday && d < weekEnd;
  });
  const bucketThisMonth = data.tasks.filter(t => {
    const d = normalize(t.dueDate);
    return (
      d >= new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000) &&
      d < thirtyDaysFromNow
    );
  });

  const timeBuckets = [
    { title: 'Overdue', tasks: bucketOverdue, color: 'FFEF4444' },
    { title: 'Due Today', tasks: bucketToday, color: 'FFF59E0B' },
    { title: 'Due This Week', tasks: bucketThisWeek, color: 'FF3B82F6' },
    { title: 'Due This Month', tasks: bucketThisMonth, color: 'FF6B7280' },
  ];

  // Populate the summary text now that buckets are known
  const summaryText = `${bucketOverdue.length} Overdue | ${bucketToday.length} Due Today | ${bucketThisWeek.length} Due This Week | ${bucketThisMonth.length} Due This Month | ${totalTasks} Total`;
  summaryRow.getCell(1).value = summaryText;
  summaryRow.alignment = { vertical: 'middle', horizontal: 'left' };

  currentRow = 3;

  timeBuckets.forEach(bucket => {
    if (bucket.tasks.length > 0) {
      // Add section header as merged cell across all columns
      const sectionHeaderText = `${bucket.title} (${bucket.tasks.length} ${bucket.tasks.length === 1 ? 'task' : 'tasks'})`;
      scheduleSheet.addRow([sectionHeaderText]);
      const sectionRow = scheduleSheet.getRow(currentRow);
      sectionRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sectionRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bucket.color },
      };
      sectionRow.alignment = { vertical: 'middle', horizontal: 'left' };
      // Merge cells across all 7 columns (guarded for mocked environments)
      if (typeof (scheduleSheet as any).mergeCells === 'function') {
        (scheduleSheet as any).mergeCells(currentRow, 1, currentRow, 7);
      }
      currentRow++;

      // Sort tasks by due date
      const sortedTasks = bucket.tasks.sort(
        (a, b) =>
          normalize(a.dueDate).getTime() - normalize(b.dueDate).getTime()
      );

      // Add task rows via addRow so tests can detect
      sortedTasks.forEach(task => {
        scheduleSheet.addRow([
          task.title,
          task.status.replace('_', ' '),
          task.priority,
          formatDate(task.dueDate),
          task.assignees.join(', '),
          task.tags.join(', '),
          task.departments.join(', '),
        ]);
        currentRow++;
      });

      // Add empty row for spacing
      scheduleSheet.addRow(['']);
      currentRow++;
    }
  });

  // Set column widths
  scheduleSheet.getColumn(1).width = 40; // Title
  scheduleSheet.getColumn(2).width = 15; // Status
  scheduleSheet.getColumn(3).width = 10; // Priority
  scheduleSheet.getColumn(4).width = 15; // Due Date
  scheduleSheet.getColumn(5).width = 30; // Assignees
  scheduleSheet.getColumn(6).width = 20; // Tags
  scheduleSheet.getColumn(7).width = 25; // Departments

  // ============================================
  // SHEET 4: Collaborators
  // ============================================
  const collabsSheet = workbook.addWorksheet('Collaborators');

  if (data.collaborators.length > 0) {
    // Add header
    const collabHeaders = ['Name', 'Email', 'Department', 'Added Date'];
    collabsSheet.addRow(collabHeaders);

    // Style header
    const collabHeaderRow = collabsSheet.getRow(1);
    collabHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    collabHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // Indigo
    };
    collabHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add collaborator data
    data.collaborators.forEach(collab => {
      collabsSheet.addRow([
        collab.name,
        collab.email,
        collab.departmentName,
        formatDate(collab.addedAt),
      ]);
    });

    // Set column widths
    collabsSheet.getColumn(1).width = 25; // Name
    collabsSheet.getColumn(2).width = 35; // Email
    collabsSheet.getColumn(3).width = 25; // Department
    collabsSheet.getColumn(4).width = 15; // Added Date
  } else {
    collabsSheet.addRow(['No collaborators found for this project']);
  }

  // ============================================
  // DOWNLOAD: Blob Pattern
  // ============================================
  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  // Create blob
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  // Create object URL
  const url = window.URL.createObjectURL(blob);

  // Create temporary link for download
  const link = document.createElement('a');
  link.href = url;
  link.download =
    filename || `${sanitizeFilename(data.project.name)}_Report.xlsx`;

  // Append to body (required for Firefox)
  document.body.appendChild(link);

  // Trigger download
  link.click();

  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
