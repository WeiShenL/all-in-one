import React from 'react';
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import AuthNavbar from '../AuthNavbar';
import { useAuth } from '@/lib/supabase/auth-context';

// Mock external dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/supabase/auth-context', () => ({
  useAuth: jest.fn(),
}));

describe('AuthNavbar Component', () => {
  const mockPush = jest.fn();
  const mockSignOut = jest.fn();

  const mockAuthContext = {
    user: { email: 'test@example.com' },
    userProfile: { name: 'Test User' },
    signOut: mockSignOut,
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useAuth as jest.Mock).mockReturnValue(mockAuthContext);
  });

  describe('Navigation and branding', () => {
    test('renders app branding and navigation links', () => {
      render(<AuthNavbar />);

      expect(screen.getByText('Task Manager')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    test('has correct navigation link URLs', () => {
      render(<AuthNavbar />);

      const dashboardLink = screen.getByText('Dashboard').closest('a');
      const profileLink = screen.getByText('Profile').closest('a');

      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
      expect(profileLink).toHaveAttribute('href', '/profile');
    });
  });

  describe('User information display', () => {
    test('displays user full name when available', () => {
      render(<AuthNavbar />);

      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    test('falls back to email when full name is not available', () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuthContext,
        userProfile: null,
      });

      render(<AuthNavbar />);

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    test('handles missing user profile gracefully', () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuthContext,
        userProfile: { name: null },
      });

      render(<AuthNavbar />);

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });
});
