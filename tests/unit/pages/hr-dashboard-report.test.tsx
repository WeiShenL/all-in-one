import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// SUT
import HRDashboard from '@/app/dashboard/hr/page';

// Mocks
jest.mock('@/lib/supabase/auth-context', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'u1' }, loading: false })),
}));

// Mock Navbar to avoid NotificationProvider dependency in unit tests
jest.mock('@/app/components/Navbar', () => {
  const MockNavbar = () => <div data-testid='mock-navbar'>Navbar</div>;
  // Set display name to satisfy react/display-name rule
  (MockNavbar as any).displayName = 'MockNavbar';
  return { __esModule: true, default: MockNavbar };
});

// Mock the export button to avoid triggering inner tRPC/report fetch
jest.mock('@/app/components/ProjectReport/ProjectReportExportButton', () => ({
  ProjectReportExportButton: ({ projectId }: { projectId: string }) => (
    <div data-testid='mock-export-button'>Export for {projectId}</div>
  ),
}));

// Mock tRPC getAll query
jest.mock('@/app/lib/trpc', () => ({
  trpc: {
    project: {
      getAll: {
        useQuery: jest.fn(),
      },
      getProjectReport: {
        useQuery: jest.fn(),
      },
    },
  },
}));

import { trpc } from '@/app/lib/trpc';
jest.mock('@/app/components/ProjectReport/ProjectReportPreview', () => ({
  ProjectReportPreview: ({ projectId }: { projectId: string }) => (
    <div data-testid='mock-preview'>Preview for {projectId}</div>
  ),
}));

describe('HR Dashboard - Project report project source', () => {
  const mockUseQuery = trpc.project.getAll.useQuery as jest.Mock;

  const projects = [
    {
      id: 'p1',
      name: 'Proj A',
      description: null,
      priority: 5,
      status: 'ACTIVE',
      departmentId: 'd1',
      creatorId: 'u1',
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'p2',
      name: 'Proj B',
      description: null,
      priority: 6,
      status: 'PLANNING',
      departmentId: 'd1',
      creatorId: 'u1',
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: projects, isLoading: false });
  });

  it('calls trpc.project.getAll with { isArchived: false }', () => {
    render(<HRDashboard />);
    expect(mockUseQuery).toHaveBeenCalledWith(
      { isArchived: false },
      expect.objectContaining({ enabled: expect.any(Boolean) })
    );
  });

  it('populates dropdown with all projects and enables export after selection', () => {
    render(<HRDashboard />);

    const select = screen.getByTestId(
      'project-select-dropdown'
    ) as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    // Has options for both projects
    expect(screen.getByText(/Proj A/)).toBeInTheDocument();
    expect(screen.getByText(/Proj B/)).toBeInTheDocument();

    // Export button not shown until selection
    expect(screen.queryByTestId('mock-export-button')).not.toBeInTheDocument();

    // Select a project
    fireEvent.change(select, { target: { value: 'p2' } });

    // Export component appears with selected id
    expect(screen.getByTestId('mock-export-button')).toHaveTextContent('p2');

    // Preview appears for selected project
    expect(screen.getByTestId('mock-preview')).toHaveTextContent('p2');
  });
});
