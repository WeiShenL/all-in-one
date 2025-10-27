/**
 * ProjectReportExportButton Component
 *
 * Dropdown button for exporting project reports in PDF or XLSX format
 * Only shown to HR/Admin users
 *
 * Features:
 * - Fetches report data via tRPC
 * - Export options: PDF / XLSX
 * - Loading states
 * - Error handling
 */

'use client';

import React, { useState } from 'react';
import { trpc } from '@/app/lib/trpc';
import { exportProjectToPDF } from './utils/exportProjectToPDF';
import { exportProjectToXLSX } from './utils/exportProjectToXLSX';
import { Download, FileText, Table } from 'lucide-react';

interface ProjectReportExportButtonProps {
  projectId: string;
  projectName: string;
}

export function ProjectReportExportButton({
  projectId,
  projectName: _projectName,
}: ProjectReportExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch report data when button is clicked
  const { data, isLoading, error, refetch } =
    trpc.project.getProjectReport.useQuery(
      { id: projectId },
      {
        enabled: false, // Don't auto-fetch on mount
        retry: false,
      }
    );

  // Convert date strings from tRPC to Date objects
  const convertDates = (rawData: any): typeof rawData => {
    return {
      ...rawData,
      project: {
        ...rawData.project,
        createdAt: new Date(rawData.project.createdAt),
        updatedAt: new Date(rawData.project.updatedAt),
      },
      tasks: rawData.tasks.map((task: any) => ({
        ...task,
        dueDate: new Date(task.dueDate),
        createdAt: new Date(task.createdAt),
      })),
      collaborators: rawData.collaborators.map((collab: any) => ({
        ...collab,
        addedAt: new Date(collab.addedAt),
      })),
    };
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    setIsOpen(false);

    try {
      // Fetch fresh data if not already loaded
      const rawData = data || (await refetch()).data;

      if (!rawData) {
        throw new Error('Failed to fetch report data');
      }

      // Convert date strings to Date objects
      const reportData = convertDates(rawData);

      // Export to PDF
      exportProjectToPDF(reportData);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert(
        err instanceof Error
          ? err.message
          : 'Failed to export PDF. Please try again.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportXLSX = async () => {
    setIsExporting(true);
    setIsOpen(false);

    try {
      // Fetch fresh data if not already loaded
      const rawData = data || (await refetch()).data;

      if (!rawData) {
        throw new Error('Failed to fetch report data');
      }

      // Convert date strings to Date objects
      const reportData = convertDates(rawData);

      // Export to XLSX
      await exportProjectToXLSX(reportData);
    } catch (err) {
      console.error('XLSX export failed:', err);
      alert(
        err instanceof Error
          ? err.message
          : 'Failed to export Excel file. Please try again.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Show error message if authorization fails
  if (error) {
    return (
      <div
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#fef2f2',
          color: '#991b1b',
          borderRadius: '6px',
          fontSize: '0.875rem',
          border: '1px solid #fecaca',
        }}
      >
        {error.message.includes('Unauthorized')
          ? 'Only HR/Admin can export reports'
          : 'Failed to load report'}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Main Button */}
      <button
        data-testid='export-report-button'
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || isExporting}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.625rem 1rem',
          backgroundColor: '#4f46e5',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.875rem',
          fontWeight: '500',
          cursor: isLoading || isExporting ? 'not-allowed' : 'pointer',
          opacity: isLoading || isExporting ? 0.6 : 1,
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          if (!isLoading && !isExporting) {
            e.currentTarget.style.backgroundColor = '#4338ca';
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = '#4f46e5';
        }}
      >
        <Download size={16} />
        {isExporting
          ? 'Exporting...'
          : isLoading
            ? 'Loading...'
            : 'Export Report'}
      </button>

      {/* Dropdown Menu */}
      {isOpen && !isLoading && !isExporting && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.5rem',
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              zIndex: 20,
              minWidth: '200px',
              overflow: 'hidden',
            }}
          >
            {/* PDF Option */}
            <button
              data-testid='export-pdf-button'
              onClick={handleExportPDF}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '0.875rem',
                color: '#374151',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                textAlign: 'left',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <FileText size={18} color='#ef4444' />
              <div>
                <div style={{ fontWeight: '500', color: '#111827' }}>
                  Export as PDF
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Formatted document
                </div>
              </div>
            </button>

            {/* Divider */}
            <div
              style={{ height: '1px', backgroundColor: '#e5e7eb', margin: 0 }}
            />

            {/* XLSX Option */}
            <button
              data-testid='export-xlsx-button'
              onClick={handleExportXLSX}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '0.875rem',
                color: '#374151',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                textAlign: 'left',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Table size={18} color='#10b981' />
              <div>
                <div style={{ fontWeight: '500', color: '#111827' }}>
                  Export as Excel
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Spreadsheet with data
                </div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
