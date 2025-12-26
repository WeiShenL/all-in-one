import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ProjectReportPreview } from '@/app/components/ProjectReport/ProjectReportPreview';

// Mock PDF builder to avoid heavy work
jest.mock('@/app/components/ProjectReport/utils/exportProjectToPDF', () => ({
  buildProjectReportPDFBlob: jest.fn(
    () => new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' })
  ),
}));

// Mock tRPC
jest.mock('@/app/lib/trpc', () => ({
  trpc: {
    project: {
      getProjectReport: {
        useQuery: jest.fn(),
      },
    },
  },
}));

import { trpc } from '@/app/lib/trpc';

describe('ProjectReportPreview', () => {
  const mockUseQuery = trpc.project.getProjectReport.useQuery as jest.Mock;

  const sample = {
    project: {
      id: 'p1',
      name: 'Proj',
      description: null,
      priority: 5,
      status: 'ACTIVE',
      departmentName: 'Dept',
      creatorName: 'Alice',
      creatorEmail: 'a@x.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    tasks: [],
    collaborators: [],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock URL.createObjectURL / revokeObjectURL for JSDOM
    (global as any).URL.createObjectURL = jest.fn(() => 'blob:mock');
    (global as any).URL.revokeObjectURL = jest.fn();
    mockUseQuery.mockReturnValue({
      data: sample,
      isLoading: false,
      error: null,
    });
  });

  it('renders header and iframe when data is loaded', async () => {
    render(<ProjectReportPreview projectId='p1' />);

    expect(screen.getByText('Report Preview')).toBeInTheDocument();

    // Wait for async PDF generation to complete
    await waitFor(() => {
      expect(
        document.querySelector('iframe[title="Project Report Preview"]')
      ).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: true, error: null });
    render(<ProjectReportPreview projectId='p1' />);
    expect(screen.getByText('Generating preview...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('boom'),
    });
    render(<ProjectReportPreview projectId='p1' />);
    expect(screen.getByText('Failed to generate preview')).toBeInTheDocument();
  });
});
