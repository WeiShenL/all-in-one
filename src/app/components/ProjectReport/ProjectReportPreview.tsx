'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/app/lib/trpc';
import { buildProjectReportPDFBlob } from './utils/exportProjectToPDF';

type Props = {
  projectId: string;
};

export function ProjectReportPreview({ projectId }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const reportQuery = trpc.project.getProjectReport.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );

  const reportDataWithDates = useMemo(() => {
    const raw = reportQuery.data as any;
    if (!raw) {
      return null;
    }
    return {
      ...raw,
      project: {
        ...raw.project,
        createdAt: new Date(raw.project.createdAt),
        updatedAt: new Date(raw.project.updatedAt),
      },
      tasks: raw.tasks.map((t: any) => ({
        ...t,
        dueDate: new Date(t.dueDate),
        createdAt: new Date(t.createdAt),
      })),
      collaborators: raw.collaborators.map((c: any) => ({
        ...c,
        addedAt: new Date(c.addedAt),
      })),
    };
  }, [reportQuery.data]);

  useEffect(() => {
    if (!reportDataWithDates || reportQuery.isLoading) {
      return;
    }

    let cancelled = false;

    const generatePreview = async () => {
      try {
        const blob = await buildProjectReportPDFBlob(
          reportDataWithDates as any
        );

        if (cancelled) {
          return;
        }

        // Validate blob
        if (!(blob instanceof Blob)) {
          console.error(
            'buildProjectReportPDFBlob did not return a valid Blob'
          );
          return;
        }

        const url = window.URL.createObjectURL(blob);

        if (previewUrl) {
          window.URL.revokeObjectURL(previewUrl);
        }

        setPreviewUrl(url);
      } catch (error) {
        console.error('Failed to generate PDF preview:', error);
      }
    };

    generatePreview();

    return () => {
      cancelled = true;
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDataWithDates]);

  return (
    <div>
      <h4
        style={{
          margin: '0.5rem 0',
          color: '#111827',
          fontSize: '1rem',
          fontWeight: 600,
        }}
      >
        Report Preview
      </h4>
      {reportQuery.isLoading && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            color: '#6b7280',
          }}
        >
          Generating preview...
        </div>
      )}
      {!reportQuery.isLoading && previewUrl && (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <iframe
            title='Project Report Preview'
            src={previewUrl}
            style={{ width: '100%', height: '480px', border: 'none' }}
          />
        </div>
      )}
      {reportQuery.error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#991b1b',
          }}
        >
          {reportQuery.error.message.includes('Unauthorized')
            ? 'Only HR/Admin can preview reports'
            : 'Failed to generate preview'}
        </div>
      )}
    </div>
  );
}
