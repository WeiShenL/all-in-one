import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import PersonalDashboard from '@/app/dashboard/personal/page';
import DepartmentDashboard from '@/app/dashboard/department/page';
import HRDashboard from '@/app/dashboard/hr/page';
import { NotificationProvider } from '@/lib/context/NotificationContext';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('@/lib/supabase/auth-context', () => ({
  useAuth: jest.fn(),
}));

// Import the hook so we can access the mock
import { useSecureLogout } from '@/lib/hooks/useSecureLogout';

jest.mock('@/lib/hooks/useSecureLogout', () => ({
  useSecureLogout: jest.fn(),
}));

// Mock the tRPC module
jest.mock('@/app/lib/trpc', () => {
  return {
    trpc: {
      task: {
        getUserTasks: {
          useQuery: jest.fn(),
        },
        getDashboardTasks: {
          useQuery: jest.fn(),
        },
        getDepartmentTasksForUser: {
          useQuery: jest.fn(),
        },
      },
      project: {
        getVisible: {
          useQuery: jest.fn(() => ({
            data: [],
            isLoading: false,
            error: null,
          })),
        },
        getAll: {
          useQuery: jest.fn(() => ({
            data: [],
            isLoading: false,
            error: null,
          })),
        },
      },
      userProfile: {
        getAll: {
          useQuery: jest.fn(),
        },
      },
      notification: {
        getUnreadNotifications: {
          useQuery: jest.fn(),
        },
        getUnreadCount: {
          useQuery: jest.fn(),
        },
        getNotifications: {
          useQuery: jest.fn(),
        },
        markAsRead: {
          useMutation: jest.fn(),
        },
      },
      department: {
        getById: {
          useQuery: jest.fn(() => ({
            data: { id: 'dep-1', name: 'Engineering' },
            isLoading: false,
          })),
        },
      },
      useUtils: jest.fn(),
    },
  };
});

// Import mocked trpc to access the mock function
import { trpc } from '@/app/lib/trpc';

describe('Logout Page Flow', () => {
  const mockPush = jest.fn();
  const mockSignOut = jest.fn();
  const mockHandleSecureLogout = jest.fn();

  const mockAuthenticatedUser = {
    user: { email: 'test@example.com', id: '123' },
    userProfile: { name: 'Test User', role: 'STAFF' },
    signOut: mockSignOut,
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (usePathname as jest.Mock).mockReturnValue('/dashboard/personal');
    (useAuth as jest.Mock).mockReturnValue(mockAuthenticatedUser);

    // Mock useSecureLogout hook
    (useSecureLogout as jest.Mock).mockReturnValue({
      handleSecureLogout: mockHandleSecureLogout,
      isLoggingOut: false,
    });

    // Mock tRPC getUserTasks query with empty data
    (trpc.task.getUserTasks.useQuery as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    // Mock tRPC getDashboardTasks query for ManagerDashboard
    (trpc.task.getDashboardTasks.useQuery as jest.Mock).mockReturnValue({
      data: {
        tasks: [],
        metrics: {
          toDo: 0,
          inProgress: 0,
          completed: 0,
          blocked: 0,
        },
      },
      isLoading: false,
      error: null,
    });

    // Mock tRPC getDepartmentTasksForUser query for DepartmentDashboard
    (trpc.task.getDepartmentTasksForUser.useQuery as jest.Mock).mockReturnValue(
      {
        data: [],
        isLoading: false,
        error: null,
      }
    );

    // Mock tRPC userProfile.getAll query for user info
    (trpc.userProfile.getAll.useQuery as jest.Mock).mockReturnValue({
      data: [
        {
          id: '123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'STAFF',
        },
      ],
      isLoading: false,
      error: null,
    });

    // Mock tRPC notification.getUnreadNotifications query
    (
      trpc.notification.getUnreadNotifications.useQuery as jest.Mock
    ).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    // Mock tRPC notification.getUnreadCount query
    (trpc.notification.getUnreadCount.useQuery as jest.Mock).mockReturnValue({
      data: { count: 0 },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    // Mock tRPC notification.getNotifications query (used by NotificationModal)
    (trpc.notification.getNotifications.useQuery as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    // Mock tRPC notification.markAsRead mutation (used by NotificationModal)
    (trpc.notification.markAsRead.useMutation as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
      isLoading: false,
      error: null,
    });

    // Mock tRPC useUtils for notification invalidation
    (trpc.useUtils as jest.Mock).mockReturnValue({
      notification: {
        getUnreadNotifications: {
          invalidate: jest.fn(),
        },
        getUnreadCount: {
          invalidate: jest.fn(),
        },
      },
    });
  });

  describe('Rendering', () => {
    it('should render logout button in navbar on personal dashboard', () => {
      render(<PersonalDashboard />, { wrapper: TestWrapper });

      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    it('should render logout button in navbar on department dashboard', () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuthenticatedUser,
        userProfile: { name: 'Manager User', role: 'MANAGER' },
      });

      render(<DepartmentDashboard />, { wrapper: TestWrapper });

      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    it('should render logout button in navbar on HR dashboard', () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuthenticatedUser,
        userProfile: { name: 'HR User', role: 'HR_ADMIN' },
      });

      render(<HRDashboard />, { wrapper: TestWrapper });

      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    // User name/email are no longer displayed persistently in the navbar.
    // The profile icon opens a modal with user details, so these assertions were removed.
  });

  describe('Logout Flow', () => {
    it('should call handleSecureLogout when logout button is clicked', async () => {
      mockHandleSecureLogout.mockResolvedValue(undefined);

      render(<PersonalDashboard />, { wrapper: TestWrapper });

      const logoutButton = screen.getByText('Sign Out');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockHandleSecureLogout).toHaveBeenCalledTimes(1);
      });
    });

    it('should show loading state during logout', async () => {
      (useSecureLogout as jest.Mock).mockReturnValue({
        handleSecureLogout: mockHandleSecureLogout,
        isLoggingOut: true,
      });

      render(<PersonalDashboard />, { wrapper: TestWrapper });

      expect(screen.getByText('Signing Out...')).toBeInTheDocument();
      const logoutButton = screen.getByText('Signing Out...');
      expect(logoutButton).toBeDisabled();
    });

    it('should logout from personal dashboard', async () => {
      mockHandleSecureLogout.mockResolvedValue(undefined);

      render(<PersonalDashboard />, { wrapper: TestWrapper });

      const logoutButton = screen.getByText('Sign Out');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockHandleSecureLogout).toHaveBeenCalledTimes(1);
      });
    });

    it('should logout from department dashboard', async () => {
      mockHandleSecureLogout.mockResolvedValue(undefined);
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuthenticatedUser,
        userProfile: { name: 'Manager User', role: 'MANAGER' },
      });

      render(<DepartmentDashboard />, { wrapper: TestWrapper });

      const logoutButton = screen.getByText('Sign Out');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockHandleSecureLogout).toHaveBeenCalledTimes(1);
      });
    });

    it('should logout from HR dashboard', async () => {
      mockHandleSecureLogout.mockResolvedValue(undefined);
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuthenticatedUser,
        userProfile: { name: 'HR User', role: 'HR_ADMIN' },
      });

      render(<HRDashboard />, { wrapper: TestWrapper });

      const logoutButton = screen.getByText('Sign Out');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockHandleSecureLogout).toHaveBeenCalledTimes(1);
      });
    });

    it('should prevent multiple logout clicks during logout process', async () => {
      // First click - start logging out
      (useSecureLogout as jest.Mock).mockReturnValue({
        handleSecureLogout: mockHandleSecureLogout,
        isLoggingOut: false,
      });

      const { rerender } = render(<PersonalDashboard />, {
        wrapper: TestWrapper,
      });

      const logoutButton = screen.getByText('Sign Out');
      fireEvent.click(logoutButton);

      // After first click, simulate loading state
      (useSecureLogout as jest.Mock).mockReturnValue({
        handleSecureLogout: mockHandleSecureLogout,
        isLoggingOut: true,
      });

      rerender(<PersonalDashboard />);

      const disabledButton = screen.getByText('Signing Out...');
      expect(disabledButton).toBeDisabled();

      // Try to click again - should be disabled
      fireEvent.click(disabledButton);

      // Should only be called once (from first click)
      expect(mockHandleSecureLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should call logout even when button is clicked rapidly', async () => {
      mockHandleSecureLogout.mockResolvedValue(undefined);

      render(<PersonalDashboard />, { wrapper: TestWrapper });

      const logoutButton = screen.getByText('Sign Out');

      // Simulate rapid clicks
      fireEvent.click(logoutButton);
      fireEvent.click(logoutButton);
      fireEvent.click(logoutButton);

      // Hook should still be called (useSecureLogout prevents duplicate calls internally)
      await waitFor(() => {
        expect(mockHandleSecureLogout).toHaveBeenCalled();
      });
    });

    it('should allow retry if logout hook is called again', async () => {
      mockHandleSecureLogout.mockResolvedValue(undefined);

      render(<PersonalDashboard />, { wrapper: TestWrapper });

      const logoutButton = screen.getByText('Sign Out');

      // First attempt
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockHandleSecureLogout).toHaveBeenCalledTimes(1);
      });

      // Button remains clickable (hook handles errors internally)
      expect(screen.getByText('Sign Out')).not.toBeDisabled();

      // Second attempt should work
      fireEvent.click(screen.getByText('Sign Out'));

      await waitFor(() => {
        expect(mockHandleSecureLogout).toHaveBeenCalledTimes(2);
      });
    });

    it('should maintain UI consistency during logout attempts', async () => {
      mockHandleSecureLogout.mockResolvedValue(undefined);

      render(<PersonalDashboard />, { wrapper: TestWrapper });

      // Dashboard content should be visible
      expect(screen.getByText('Personal Dashboard')).toBeInTheDocument();

      const logoutButton = screen.getByText('Sign Out');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockHandleSecureLogout).toHaveBeenCalledTimes(1);
      });

      // Dashboard content should still be visible after logout call
      // (actual redirect happens in the hook)
      expect(screen.getByText('Personal Dashboard')).toBeInTheDocument();
    });
  });

  describe('User Experience', () => {
    it('should show consistent logout button across all pages', () => {
      const { unmount: unmount1 } = render(<PersonalDashboard />, {
        wrapper: TestWrapper,
      });
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
      unmount1();

      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuthenticatedUser,
        userProfile: { name: 'Manager User', role: 'MANAGER' },
      });
      const { unmount: unmount2 } = render(<DepartmentDashboard />, {
        wrapper: TestWrapper,
      });
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
      unmount2();

      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuthenticatedUser,
        userProfile: { name: 'HR User', role: 'HR_ADMIN' },
      });
      const { unmount: unmount3 } = render(<HRDashboard />, {
        wrapper: TestWrapper,
      });
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
      unmount3();
    });

    it('should display loading indicator only on logout button during logout', async () => {
      (useSecureLogout as jest.Mock).mockReturnValue({
        handleSecureLogout: mockHandleSecureLogout,
        isLoggingOut: true,
      });

      render(<PersonalDashboard />, { wrapper: TestWrapper });

      // Logout button shows loading
      expect(screen.getByText('Signing Out...')).toBeInTheDocument();

      // Dashboard content should still be visible
      expect(screen.getByText('Personal Dashboard')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should have correct Personal link in navbar for STAFF', () => {
      render(<PersonalDashboard />, { wrapper: TestWrapper });

      const personalLink = screen.getByText('Personal').closest('a');
      expect(personalLink).toHaveAttribute('href', '/dashboard/personal');
    });

    it('should have correct Department link in navbar for MANAGER', () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuthenticatedUser,
        userProfile: { name: 'Manager User', role: 'MANAGER' },
      });

      render(<DepartmentDashboard />, { wrapper: TestWrapper });

      const deptLink = screen.getByText('Department').closest('a');
      expect(deptLink).toHaveAttribute('href', '/dashboard/department');
    });

    it('should have correct Personal link in navbar for HR_ADMIN', () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuthenticatedUser,
        userProfile: { name: 'HR User', role: 'HR_ADMIN' },
      });

      render(<HRDashboard />, { wrapper: TestWrapper });

      const personalLink = screen.getByText('Personal').closest('a');
      expect(personalLink).toHaveAttribute('href', '/dashboard/personal');
    });

    it('should have Projects section in navbar', () => {
      render(<PersonalDashboard />, { wrapper: TestWrapper });

      // Look for the Projects section header (not a navigation link)
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });
  });
});
