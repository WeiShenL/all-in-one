import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProjectDashboard } from '@/app/components/ProjectDashboard';
import { useAuth } from '@/lib/supabase/auth-context';

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

jest.mock('@/lib/supabase/auth-context', () => ({
  useAuth: jest.fn(),
}));

describe('ProjectDashboard', () => {
  it('renders TaskTable with provided title', () => {
    // Mock useAuth return value
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      userProfile: { role: 'MANAGER', name: 'Test User' },
    });

    render(
      <ProjectDashboard
        projectId='11111111-1111-4111-8111-111111111111'
        title='Project Tasks'
      />
    );
    expect(screen.getByText(/Project Tasks/i)).toBeInTheDocument();
  });
});
