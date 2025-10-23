import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserDetailsModal } from '@/app/components/UserDetailsModal';
import { useAuth } from '@/lib/supabase/auth-context';

// Mock external dependencies
jest.mock('@/lib/supabase/auth-context', () => ({
  useAuth: jest.fn(),
}));

describe('UserDetailsModal', () => {
  const mockOnClose = jest.fn();

  // Mock user data
  const mockUser = {
    email: 'test@example.com',
    id: 'user-123',
  };

  const mockUserProfile = {
    name: 'John Doe',
    role: 'MANAGER',
    isHrAdmin: false,
  };

  const mockHrAdminProfile = {
    name: 'Jane Admin',
    role: 'HR_ADMIN',
    isHrAdmin: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={false} onClose={mockOnClose} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('User Details')).toBeInTheDocument();
    });

    it('should display user information correctly', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Name:')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Email:')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('Role:')).toBeInTheDocument();
      expect(screen.getByText('manager')).toBeInTheDocument();
    });

    it('should display fallback values when userProfile is missing', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: null,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Name:')).toBeInTheDocument();
      expect(screen.getByText('-')).toBeInTheDocument();
      expect(screen.getByText('Email:')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('Role:')).toBeInTheDocument();
      expect(screen.getByText('staff')).toBeInTheDocument();
    });

    it('should display fallback values when user is missing', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Name:')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Email:')).toBeInTheDocument();
      // Check that the email field exists but is empty
      const emailField = screen.getByText('Email:').nextSibling;
      expect(emailField).toHaveTextContent('');
      expect(screen.getByText('Role:')).toBeInTheDocument();
      expect(screen.getByText('manager')).toBeInTheDocument();
    });

    it('should handle HR_ADMIN role correctly', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockHrAdminProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Jane Admin')).toBeInTheDocument();
      expect(screen.getByText('hr_admin')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'User details');
    });

    it('should have proper heading structure', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('User Details');
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when Close button is clicked', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      const backdrop = screen.getByRole('dialog');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when modal content is clicked', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      const modalContent = screen.getByText('User Details').closest('div');
      fireEvent.click(modalContent!);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should handle multiple close button clicks', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeButton);
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('Styling and Layout', () => {
    it('should have proper modal styling', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveStyle({
        position: 'fixed',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: '2000',
      });
    });

    it('should have proper button styling', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button', { name: 'Close' });
      expect(closeButton).toHaveStyle({
        backgroundColor: '#e9ecef',
        color: '#212529',
        cursor: 'pointer',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty user email', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { email: '', id: 'user-123' },
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Email:')).toBeInTheDocument();
      // Check that the email field exists but is empty
      const emailField = screen.getByText('Email:').nextSibling;
      expect(emailField).toHaveTextContent('');
    });

    it('should handle undefined userProfile name', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: { name: undefined, role: 'STAFF' },
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Name:')).toBeInTheDocument();
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('should handle undefined userProfile role', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: { name: 'John Doe', role: undefined },
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Role:')).toBeInTheDocument();
      expect(screen.getByText('staff')).toBeInTheDocument();
    });

    it('should handle very long email addresses', () => {
      const longEmail =
        'very.long.email.address.that.might.cause.layout.issues@example.com';
      (useAuth as jest.Mock).mockReturnValue({
        user: { email: longEmail, id: 'user-123' },
        userProfile: mockUserProfile,
      });

      render(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText(longEmail)).toBeInTheDocument();
    });
  });

  describe('Component Props', () => {
    it('should handle onClose prop changes', () => {
      const newOnClose = jest.fn();
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockUserProfile,
      });

      const { rerender } = render(
        <UserDetailsModal isOpen={true} onClose={mockOnClose} />
      );

      const closeButton = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);

      rerender(<UserDetailsModal isOpen={true} onClose={newOnClose} />);
      fireEvent.click(closeButton);
      expect(newOnClose).toHaveBeenCalledTimes(1);
    });

    it('should handle isOpen prop changes', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        userProfile: mockUserProfile,
      });

      const { rerender } = render(
        <UserDetailsModal isOpen={false} onClose={mockOnClose} />
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      rerender(<UserDetailsModal isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
