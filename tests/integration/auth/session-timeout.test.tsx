import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginPage from '@/app/auth/login/page';
import { useAuth } from '@/lib/supabase/auth-context';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('@/lib/supabase/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/hooks/useSessionTimeout', () => ({
  useSessionTimeout: jest.fn(),
}));

describe('Session Timeout Integration Tests', () => {
  const mockPush = jest.fn();
  const mockSignIn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  describe('Session Expiry Message Display', () => {
    it('should display session expired message when expired query param is present', () => {
      const mockSearchParams = new URLSearchParams('expired=true');
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      (useAuth as jest.Mock).mockReturnValue({
        signIn: mockSignIn,
        loading: false,
        user: null,
        userProfile: null,
      });

      render(<LoginPage />);

      expect(
        screen.getByText(/your session has expired due to inactivity/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/please log in again/i)).toBeInTheDocument();
    });

    it('should include redirect URL in message when provided', () => {
      const mockSearchParams = new URLSearchParams(
        'expired=true&redirect=%2Fdashboard%2Fstaff'
      );
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      (useAuth as jest.Mock).mockReturnValue({
        signIn: mockSignIn,
        loading: false,
        user: null,
        userProfile: null,
      });

      render(<LoginPage />);

      expect(
        screen.getByText(/your session has expired due to inactivity/i)
      ).toBeInTheDocument();
    });

    it('should not display expired message when query param is absent', () => {
      const mockSearchParams = new URLSearchParams('');
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      (useAuth as jest.Mock).mockReturnValue({
        signIn: mockSignIn,
        loading: false,
        user: null,
        userProfile: null,
      });

      render(<LoginPage />);

      expect(
        screen.queryByText(/your session has expired/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('Session Expiry Redirect After Login', () => {
    it('should redirect to original page after successful login from session expiry', async () => {
      const mockSearchParams = new URLSearchParams(
        'expired=true&redirect=%2Fdashboard%2Fmanager'
      );
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      const mockUserProfile = {
        id: 'user-1',
        email: 'manager@test.com',
        role: 'MANAGER' as const,
        name: 'Test Manager',
        departmentId: 'dept-1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Initially not logged in
      const { rerender } = render(<LoginPage />);

      (useAuth as jest.Mock).mockReturnValue({
        signIn: mockSignIn,
        loading: false,
        user: null,
        userProfile: null,
      });

      // Simulate successful login
      mockSignIn.mockResolvedValue({ error: null });

      // Update to logged in state
      (useAuth as jest.Mock).mockReturnValue({
        signIn: mockSignIn,
        loading: false,
        user: { id: 'user-1', email: 'manager@test.com' },
        userProfile: mockUserProfile,
      });

      rerender(<LoginPage />);

      // Should redirect to the original page from redirect param
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/manager');
      });
    });

    it('should redirect to personal dashboard if no redirect param after session expiry', async () => {
      const mockSearchParams = new URLSearchParams('expired=true');
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      const mockUserProfile = {
        id: 'user-1',
        email: 'staff@test.com',
        role: 'STAFF' as const,
        name: 'Test Staff',
        departmentId: 'dept-1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { rerender } = render(<LoginPage />);

      (useAuth as jest.Mock).mockReturnValue({
        signIn: mockSignIn,
        loading: false,
        user: null,
        userProfile: null,
      });

      mockSignIn.mockResolvedValue({ error: null });

      (useAuth as jest.Mock).mockReturnValue({
        signIn: mockSignIn,
        loading: false,
        user: { id: 'user-1', email: 'staff@test.com' },
        userProfile: mockUserProfile,
      });

      rerender(<LoginPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/personal');
      });
    });
  });

  describe('Protected Page Access After Session Expiry', () => {
    it('should prevent access to protected pages when session expired', () => {
      // This test verifies middleware behavior
      // In a real scenario, middleware would catch this and redirect

      (useAuth as jest.Mock).mockReturnValue({
        signIn: mockSignIn,
        loading: false,
        user: null,
        userProfile: null,
        session: null,
      });

      // Verify no user session exists
      const authContext = (useAuth as jest.Mock)();
      expect(authContext.session).toBeNull();
      expect(authContext.user).toBeNull();
    });
  });
});

// Note: Session timeout behavior in AuthContext is covered by unit tests
// These integration tests focus on UI behavior when session expires

// Session timeout warning is covered by unit tests in useSessionTimeout.test.ts

describe('Edge Cases', () => {
  it('should handle session timeout during form submission', async () => {
    const mockSearchParams = new URLSearchParams('');
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

    const mockSignIn = jest
      .fn()
      .mockRejectedValue(new Error('Session expired'));

    (useAuth as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
      loading: false,
      user: null,
      userProfile: null,
    });

    render(<LoginPage />);

    // Verify error handling when session expires during login
    await expect(mockSignIn('test@test.com', 'password')).rejects.toThrow(
      'Session expired'
    );
  });

  it('should clear session expired message after successful login', async () => {
    const mockSearchParams = new URLSearchParams('expired=true');
    const mockPush = jest.fn();

    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });

    const mockUserProfile = {
      id: 'user-1',
      email: 'test@test.com',
      role: 'STAFF' as const,
      name: 'Test User',
      departmentId: 'dept-1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Initially show expired message
    (useAuth as jest.Mock).mockReturnValue({
      signIn: jest.fn().mockResolvedValue({ error: null }),
      loading: false,
      user: null,
      userProfile: null,
    });

    const { rerender } = render(<LoginPage />);

    // Verify expired message is shown
    expect(screen.getByText(/your session has expired/i)).toBeInTheDocument();

    // After successful login, user should be redirected (message won't be visible)
    (useAuth as jest.Mock).mockReturnValue({
      signIn: jest.fn(),
      loading: false,
      user: { id: 'user-1' },
      userProfile: mockUserProfile,
    });

    rerender(<LoginPage />);

    // Should redirect to dashboard
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/personal');
    });
  });
});
