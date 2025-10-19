import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/app/components/Navbar';
import { useAuth } from '@/lib/supabase/auth-context';

// Mock external dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/supabase/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/context/NotificationContext', () => ({
  useNotifications: jest.fn(() => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    dismissAll: jest.fn(),
    lastNotificationTime: 0,
    dismissNotification: jest.fn(),
    removeNotification: jest.fn(),
    clearAll: jest.fn(),
    isConnected: true,
    error: null,
  })),
}));

jest.mock('@/lib/hooks/useUnreadNotificationCount', () => ({
  useUnreadNotificationCount: jest.fn(() => ({
    count: 0,
    resetCount: jest.fn(),
  })),
}));

// Mock tRPC
jest.mock('@/app/lib/trpc', () => ({
  trpc: {
    useUtils: jest.fn(() => ({
      notification: {
        getUnreadCount: {
          invalidate: jest.fn(),
        },
      },
    })),
    notification: {
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
        })),
      },
    },
  },
}));

describe('Logout Functionality', () => {
  const mockPush = jest.fn();
  const mockSignOut = jest.fn();

  // Mock authenticated user state
  const mockLoggedInUser = {
    user: { email: 'test@example.com', id: '123' },
    userProfile: { name: 'Test User' },
    signOut: mockSignOut,
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock user login
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useAuth as jest.Mock).mockReturnValue(mockLoggedInUser);
  });

  describe('Core logout acceptance criteria', () => {
    test('logout button is accessible and calls signOut when clicked', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      render(<Navbar />);

      // click the logout button
      const logoutButton = screen.getByText('Sign Out');
      expect(logoutButton).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(logoutButton);
      });

      // Wait for all async operations to complete
      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledTimes(1);
      });
    });

    test('user is redirected to login page after successful logout', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      render(<Navbar />);

      const logoutButton = screen.getByText('Sign Out');

      await act(async () => {
        fireEvent.click(logoutButton);
      });

      // Wait for redirect to happen
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/login');
      });
    });

    test('session token invalidation happens immediately (signOut called)', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      render(<Navbar />);

      const logoutButton = screen.getByText('Sign Out');

      await act(async () => {
        fireEvent.click(logoutButton);
      });

      // Wait for async operations to complete
      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Error handling and edge cases', () => {
    test('redirects to login even when signOut fails (security)', async () => {
      mockSignOut.mockResolvedValue({ error: 'Network error' });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<Navbar />);

      const logoutButton = screen.getByText('Sign Out');

      await act(async () => {
        fireEvent.click(logoutButton);
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/login');
        expect(consoleSpy).toHaveBeenCalledWith(
          'Logout error:',
          'Network error'
        );
      });

      consoleSpy.mockRestore();
    });

    test('handles unexpected logout errors gracefully', async () => {
      mockSignOut.mockRejectedValue(new Error('Unexpected error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<Navbar />);

      const logoutButton = screen.getByText('Sign Out');

      await act(async () => {
        fireEvent.click(logoutButton);
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/login');
        expect(consoleSpy).toHaveBeenCalledWith(
          'Unexpected logout error:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });
});
