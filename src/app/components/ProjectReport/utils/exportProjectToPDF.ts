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

  return doc.output('blob');
}
