/**
 * PDF Export Utility for Project Reports
 *
 * Exports project report data to PDF format using jsPDF and jspdf-autotable
 *
 * Features:
 * - Barebones details now to show minimal implementation details
 * - Project overview with basic information
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
 * Get status color for badges
 */
function getStatusColor(status: string): [number, number, number] {
  switch (status) {
    case 'COMPLETED':
      return [34, 197, 94]; // Green
    case 'IN_PROGRESS':
      return [59, 130, 246]; // Blue
    case 'BLOCKED':
      return [239, 68, 68]; // Red
    case 'TO_DO':
      return [156, 163, 175]; // Gray
    case 'ACTIVE':
      return [34, 197, 94]; // Green
    default:
      return [107, 114, 128]; // Default gray
  }
}

/**
 * Insert zero-width spaces to allow breaking long unspaced tokens
 */
function softWrap(text: string, maxTokenLen = 24): string {
  if (!text) {
    return text;
  }
  return text
    .split(/(\s+)/) // keep whitespace tokens
    .map(token => {
      if (/^\s+$/.test(token)) {
        return token;
      } // whitespace
      if (token.length <= maxTokenLen) {
        return token;
      }
      const chunks: string[] = [];
      for (let i = 0; i < token.length; i += maxTokenLen) {
        chunks.push(token.slice(i, i + maxTokenLen));
      }
      return chunks.join('\u200B'); // allow line break within long token
    })
    .join('');
}

/**
 * Render a schedule view similar to the calendar AgendaView - perfect for PDFs!
 * Shows tasks organized by date with statistics and clean layout.
 */
function renderScheduleTimeline(
  doc: any,
  tasks: Array<{
    title: string;
    startDate: Date;
    dueDate: Date;
    status: string;
    assignees: string[];
    priority: number;
    tags: string[];
    departments: string[];
  }>,
  startY: number
): number {
  if (!tasks || tasks.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text('No tasks for schedule view.', 14, startY + 10);
    return startY + 20;
  }

  // Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('Schedule Overview', 14, startY);
  startY += 8;

  // Calculate statistics (similar to AgendaView)
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const thirtyDaysFromNow = new Date(
    startOfToday.getTime() + 30 * 24 * 60 * 60 * 1000
  );

  const overdueTasks = tasks.filter(task => {
    const dueDate =
      task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
    return dueDate < startOfToday;
  });

  const dueToday = tasks.filter(task => {
    const dueDate =
      task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
    return (
      dueDate >= startOfToday &&
      dueDate < new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
    );
  });

  const dueThisWeek = tasks.filter(task => {
    const dueDate =
      task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
    const weekEnd = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    return dueDate >= startOfToday && dueDate < weekEnd;
  });

  const dueThisMonth = tasks.filter(task => {
    const dueDate =
      task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
    return dueDate >= startOfToday && dueDate < thirtyDaysFromNow;
  });

  // Statistics bar
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);

  const statsText = `${overdueTasks.length} Overdue | ${dueToday.length} Due Today | ${dueThisWeek.length} Due This Week | ${dueThisMonth.length} Due This Month | ${tasks.length} Total`;
  doc.text(statsText, 14, startY);
  startY += 12;

  // Build time buckets (exclusive ranges)
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const weekEnd = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  const normalize = (d: Date | string) => (d instanceof Date ? d : new Date(d));

  const bucketOverdue = tasks.filter(t => normalize(t.dueDate) < startOfToday);
  const bucketToday = tasks.filter(t =>
    isSameDay(normalize(t.dueDate), startOfToday)
  );
  const bucketThisWeek = tasks.filter(t => {
    const d = normalize(t.dueDate);
    return d > startOfToday && d < weekEnd; // strictly after today
  });
  const bucketThisMonth = tasks.filter(t => {
    const d = normalize(t.dueDate);
    return d >= weekEnd && d < thirtyDaysFromNow;
  });

  // Helper to render a bucket as a table (same columns as status sections)
  const renderBucket = (
    title: string,
    color: [number, number, number],
    list: typeof tasks
  ) => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(
      `${title} (${list.length} ${list.length === 1 ? 'task' : 'tasks'})`,
      14,
      startY
    );
    startY += 4;

    const rows = list
      .sort((a, b) => +normalize(a.dueDate) - +normalize(b.dueDate))
      .map(t => [
        softWrap(String(t.title), 36),
        t.status.replace('_', ' '),
        String(t.priority),
        new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(normalize(t.dueDate)),
        t.assignees && t.assignees.length > 0
          ? t.assignees.map(a => softWrap(a, 24)).join(',\n')
          : '—',
        t.tags && t.tags.length > 0
          ? t.tags.map(x => softWrap(x, 20)).join(',\n')
          : '—',
        t.departments && t.departments.length > 0
          ? t.departments.map(x => softWrap(x, 22)).join(',\n')
          : '—',
      ]);

    // Ensure table fits within page content width
    const pageWidth = doc.internal.pageSize.getWidth();
    const leftMargin = 14;
    const rightMargin = 14;
    const contentWidth = pageWidth - leftMargin - rightMargin;

    // Pre-allocate deterministic column widths that sum to contentWidth
    // Title, Status, Priority, Due, Assignees, Tags, Departments
    const col0 = 50; // Title
    const col1 = 18; // Status
    const col2 = 14; // Priority
    const col3 = 24; // Due Date
    const col4 = 32; // Assignees
    const col5 = 20; // Tags
    const col6 = Math.max(
      24,
      contentWidth - (col0 + col1 + col2 + col3 + col4 + col5)
    ); // Departments gets the rest

    autoTable(doc, {
      startY: startY,
      head: [
        [
          'Title',
          'Status',
          'Priority',
          'Due Date',
          'Assignees',
          'Tags',
          'Departments',
        ],
      ],
      body:
        rows.length > 0 ? rows : [['No tasks', '-', '-', '-', '-', '-', '-']],
      theme: 'striped',
      headStyles: { fillColor: color, fontSize: 9, fontStyle: 'bold' },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        valign: 'top',
      },
      tableWidth: contentWidth,
      columnStyles: {
        0: { cellWidth: col0 },
        1: { cellWidth: col1 },
        2: { cellWidth: col2 },
        3: { cellWidth: col3 },
        4: { cellWidth: col4 },
        5: { cellWidth: col5 },
        6: { cellWidth: col6 },
      },
      margin: { left: leftMargin, right: rightMargin },
    });

    startY = ((doc as any).lastAutoTable?.finalY ?? startY) + 10;
  };

  // Render buckets in order
  renderBucket('Overdue', [239, 68, 68], bucketOverdue);
  renderBucket('Due Today', [245, 158, 11], bucketToday);
  renderBucket('Due This Week', [59, 130, 246], bucketThisWeek);
  renderBucket('Due This Month', [107, 114, 128], bucketThisMonth);

  return startY;
}
/**
 * Render task sections grouped by status using autoTable.
 */
function renderTaskSections(
  doc: any,
  tasks: Array<{
    title: string;
    status: string;
    priority: number;
    dueDate: Date;
    assignees: string[];
  }>,
  startY: number
): void {
  const sections: Array<{
    key: string;
    title: string;
    color: [number, number, number];
  }> = [
    { key: 'TO_DO', title: 'To Do', color: [156, 163, 175] },
    { key: 'IN_PROGRESS', title: 'In Progress', color: [59, 130, 246] },
    { key: 'COMPLETED', title: 'Completed', color: [34, 197, 94] },
    { key: 'BLOCKED', title: 'Blocked', color: [239, 68, 68] },
  ];

  let y = startY;

  sections.forEach(section => {
    const rows = tasks
      .filter(t => t.status === section.key)
      .map(t => [
        softWrap(String(t.title), 36),
        String(t.priority),
        new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(new Date(t.dueDate)),
        t.assignees && t.assignees.length > 0
          ? t.assignees.map(a => softWrap(a, 24)).join(',\n')
          : '—',
        // tags/departments provided by repository service
        (t as any).tags && (t as any).tags.length > 0
          ? (t as any).tags.map((x: string) => softWrap(x, 20)).join(',\n')
          : '—',
        (t as any).departments && (t as any).departments.length > 0
          ? (t as any).departments
              .map((x: string) => softWrap(x, 22))
              .join(',\n')
          : '—',
      ]);

    // Section heading
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(section.color[0], section.color[1], section.color[2]);
    doc.text(section.title, 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [
        ['Title', 'Priority', 'Due Date', 'Assignees', 'Tags', 'Departments'],
      ],
      body: rows.length > 0 ? rows : [['No tasks', '-', '-', '-', '-', '-']],
      theme: 'striped',
      headStyles: { fillColor: section.color, fontSize: 9, fontStyle: 'bold' },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        valign: 'top',
      },
      tableWidth: 'auto',
      columnStyles: {
        0: { cellWidth: 62 }, // Title
        1: { cellWidth: 16 }, // Priority
        2: { cellWidth: 26 }, // Due Date
        3: { cellWidth: 36 }, // Assignees
        4: { cellWidth: 24 }, // Tags
        5: { cellWidth: 'auto' }, // Departments
      },
      margin: { left: 14, right: 14 },
    });

    // Move Y below last table

    const finalY = (doc as any).lastAutoTable?.finalY ?? y;
    y = finalY + 10;
  });
}

/**
 * Export project report to PDF
 *
 * @param data - Project report data from ProjectReportService
 * @param filename - Optional custom filename (default: ProjectName_Report.pdf)
 */
export function exportProjectToPDF(
  data: ProjectReportData,
  filename?: string
): void {
  // Create PDF document (A4, portrait)
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // ============================================
  // HEADER: Project Name and Status
  // ============================================
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PROJECT REPORT', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 10;
  doc.setFontSize(16);
  doc.text(data.project.name, pageWidth / 2, yPosition, { align: 'center' });

  // Status badge
  yPosition += 10;
  const statusColor = getStatusColor(data.project.status);
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  const statusText = data.project.status;
  const statusWidth = doc.getTextWidth(statusText) + 8;
  doc.roundedRect(
    pageWidth / 2 - statusWidth / 2,
    yPosition - 4,
    statusWidth,
    7,
    2,
    2,
    'F'
  );
  doc.text(statusText, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${formatDate(new Date())}`, pageWidth / 2, yPosition, {
    align: 'center',
  });

  yPosition += 15;

  // ============================================
  // SECTION 1: Project Overview
  // ============================================
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55); // Gray-800
  doc.text('Project Overview', 14, yPosition);
  yPosition += 2;

  // Overview table
  autoTable(doc, {
    startY: yPosition,
    head: [['Field', 'Value']],
    body: [
      ['Description', data.project.description || 'N/A'],
      ['Priority', `${data.project.priority}/10`],
      ['Department', data.project.departmentName],
      [
        'Created By',
        `${data.project.creatorName} (${data.project.creatorEmail})`,
      ],
      ['Created Date', formatDate(data.project.createdAt)],
      ['Last Updated', formatDate(data.project.updatedAt)],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: [79, 70, 229], // Indigo-600
      fontSize: 10,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
  });

  // ============================================
  // SECTION 2: Tasks by Status
  // ============================================
  // Move Y below the overview table

  const afterOverviewY = ((doc as any).lastAutoTable?.finalY || yPosition) + 12;
  renderTaskSections(doc, data.tasks as any, afterOverviewY);

  // ============================================
  // SECTION 3: Schedule Overview
  // ============================================
  const scheduleStartY =
    ((doc as any).lastAutoTable?.finalY || afterOverviewY) + 12;
  renderScheduleTimeline(doc, data.tasks as any, scheduleStartY);

  // ============================================
  // DOWNLOAD: Blob Pattern (from exportToICal)
  // ============================================
  const pdfBlob = doc.output('blob');
  const url = window.URL.createObjectURL(pdfBlob);

  // Create temporary link for download
  const link = document.createElement('a');
  link.href = url;
  link.download =
    filename || `${sanitizeFilename(data.project.name)}_Report.pdf`;

  // Append to body (required for Firefox)
  document.body.appendChild(link);

  // Trigger download
  link.click();

  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Build a PDF Blob for preview (no auto-download)
 * Reuses the same content structure as exportProjectToPDF.
 */
export function buildProjectReportPDFBlob(data: ProjectReportData): Blob {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PROJECT REPORT', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 10;
  doc.setFontSize(16);
  doc.text(data.project.name, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 10;
  const statusColor = getStatusColor(data.project.status);
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  const statusText = data.project.status;
  const statusWidth = doc.getTextWidth(statusText) + 8;
  doc.roundedRect(
    pageWidth / 2 - statusWidth / 2,
    yPosition - 4,
    statusWidth,
    7,
    2,
    2,
    'F'
  );
  doc.text(statusText, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${formatDate(new Date())}`, pageWidth / 2, yPosition, {
    align: 'center',
  });

  yPosition += 15;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('Project Overview', 14, yPosition);
  yPosition += 2;

  autoTable(doc, {
    startY: yPosition,
    head: [['Field', 'Value']],
    body: [
      ['Description', data.project.description || 'N/A'],
      ['Priority', `${data.project.priority}/10`],
      ['Department', data.project.departmentName],
      [
        'Created By',
        `${data.project.creatorName} (${data.project.creatorEmail})`,
      ],
      ['Created Date', formatDate(data.project.createdAt)],
      ['Last Updated', formatDate(data.project.updatedAt)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229], fontSize: 10, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
  });

  // Tasks by Status

  const afterOverviewY = ((doc as any).lastAutoTable?.finalY || yPosition) + 12;
  renderTaskSections(doc, (data as any).tasks, afterOverviewY);

  // Schedule (Mini Gantt)
  const scheduleStartY3 =
    ((doc as any).lastAutoTable?.finalY || afterOverviewY) + 12;
  renderScheduleTimeline(doc, (data as any).tasks, scheduleStartY3);

  return doc.output('blob');
}
