/**
 * XLSX Export Utility for Project Reports
 *
 * Exports project report data to Excel format using exceljs
 * Creates multi-sheet workbook with project overview data
 *
 * Sheets:
 * 1. Overview - Project details (populated)
 * 2. Tasks - Placeholder (data not included)
 * 3. Collaborators - Placeholder (data not included)
 * 4. Statistics - Placeholder (data not included)
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
  // SHEET 2: Tasks
  // ============================================
  const tasksSheet = workbook.addWorksheet('Tasks');
  tasksSheet.addRow(['No task data included in this export']);

  // ============================================
  // SHEET 3: Collaborators
  // ============================================
  const collabsSheet = workbook.addWorksheet('Collaborators');
  collabsSheet.addRow(['No collaborator data included in this export']);

  // ============================================
  // SHEET 4: Statistics
  // ============================================
  const statsSheet = workbook.addWorksheet('Statistics');
  statsSheet.addRow(['No statistics data included in this export']);

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
