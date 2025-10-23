import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ProjectsPage from '@/app/dashboard/projects/page';
import { NotificationProvider } from '@/lib/context/NotificationContext';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

// Mock useAuth to avoid AuthProvider requirement
jest.mock('@/lib/supabase/auth-context', () => ({
  useAuth: jest.fn(() => ({
    user: { email: 'test@example.com' },
    loading: false,
  })),
}));

// Mock useRouter and usePathname to avoid Next.js router requirement
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
  usePathname: jest.fn(() => '/dashboard/projects'),
}));

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  getRealtimeClient: jest.fn(() => ({
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn((callback: (status: string) => void) => {
        callback('SUBSCRIBED');
        return {
          unsubscribe: jest.fn(),
        };
      }),
      send: jest.fn(),
    })),
    removeChannel: jest.fn(),
  })),
}));

// Mock trpc to avoid provider requirement inside ProjectsPage -> ProjectDashboard
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

// Mock Navbar to avoid pulling in app-level dependencies
jest.mock('@/app/components/Navbar', () => {
  return {
    __esModule: true,
    default: () => <div data-testid='navbar' />,
  };
});

describe('Projects Dashboard Page', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    sessionStorage.clear();
  });

  it('renders fallback project title when no selection present', () => {
    render(<ProjectsPage />, { wrapper: TestWrapper });
    expect(
      screen.getByRole('heading', { name: 'Projects' })
    ).toBeInTheDocument();
    expect(screen.getByText('Welcome, test@example.com')).toBeInTheDocument();
  });

  it('selected project title is shown using sessionStorage activeProjectName if present', () => {
    sessionStorage.setItem('activeProjectName', 'Customer Portal Redesign');
    sessionStorage.setItem(
      'activeProjectId',
      '11111111-1111-4111-8111-111111111111'
    );
    render(<ProjectsPage />, { wrapper: TestWrapper });
    expect(
      screen.getByRole('heading', { name: 'Customer Portal Redesign' })
    ).toBeInTheDocument();
    expect(screen.getByText('Welcome, test@example.com')).toBeInTheDocument();
  });

  it('updates selected projecttitle when activeProjectChanged event is dispatched', async () => {
    render(<ProjectsPage />, { wrapper: TestWrapper });
    expect(
      screen.getByRole('heading', { name: 'Projects' })
    ).toBeInTheDocument();
    expect(screen.getByText('Welcome, test@example.com')).toBeInTheDocument();

    window.dispatchEvent(
      new CustomEvent('activeProjectChanged', {
        detail: { id: 'p1', name: 'New Selected Project' },
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'New Selected Project' })
      ).toBeInTheDocument();
    });
  });
});
