import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProjectDashboard } from '@/app/components/ProjectDashboard';

jest.mock('@/app/lib/trpc', () => ({
  trpc: {
    task: {
      getProjectTasksForUser: {
        useQuery: jest.fn(() => ({ data: [], isLoading: false, error: null })),
      },
    },
    userProfile: {
      getAll: {
        useQuery: jest.fn(() => ({ data: [], isLoading: false, error: null })),
      },
    },
    useUtils: jest.fn(() => ({
      task: {
        getProjectTasksForUser: {
          invalidate: jest.fn(),
        },
      },
    })),
  },
}));

describe('ProjectDashboard', () => {
  it('renders TaskTable with provided title', () => {
    render(
      <ProjectDashboard
        projectId='11111111-1111-4111-8111-111111111111'
        title='Project Tasks'
      />
    );
    expect(screen.getByText(/Project Tasks/i)).toBeInTheDocument();
  });
});
