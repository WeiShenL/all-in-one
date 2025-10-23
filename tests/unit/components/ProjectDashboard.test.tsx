import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProjectDashboard } from '@/app/components/ProjectDashboard';
import { useAuth } from '@/lib/supabase/auth-context';
import { NotificationProvider } from '@/lib/context/NotificationContext';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/dashboard/projects'),
}));

jest.mock('@/app/lib/trpc', () => ({
  trpc: {
    task: {
      getProjectTasksForUser: {
        useQuery: jest.fn(() => ({
          data: [],
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        })),
      },
    },
    userProfile: {
      getAll: {
        useQuery: jest.fn(() => ({ data: [], isLoading: false, error: null })),
      },
    },
    notification: {
      getUnreadNotifications: {
        useQuery: jest.fn(() => ({ data: [], isLoading: false, error: null })),
      },
      getUnreadCount: {
        useQuery: jest.fn(() => ({
          data: { count: 0 },
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        })),
      },
      getNotifications: {
        useQuery: jest.fn(() => ({
          data: [],
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        })),
      },
      markAsRead: {
        useMutation: jest.fn(() => ({
          mutate: jest.fn(),
          isLoading: false,
          error: null,
        })),
      },
    },
    useUtils: jest.fn(() => ({
      task: {
        getProjectTasksForUser: {
          invalidate: jest.fn(),
        },
      },
      notification: {
        getUnreadNotifications: {
          invalidate: jest.fn(),
        },
        getUnreadCount: {
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
      />,
      { wrapper: TestWrapper }
    );
    expect(screen.getByText(/Project Tasks/i)).toBeInTheDocument();
  });
});
