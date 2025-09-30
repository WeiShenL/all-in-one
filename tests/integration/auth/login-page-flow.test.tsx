import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import LoginPage from '../../../../src/app/auth/login/page';
import { useAuth } from '../../../../src/lib/supabase/auth-context';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../../../../src/lib/supabase/auth-context', () => ({
  useAuth: jest.fn(),
}));

describe('LoginPage Component', () => {
  const mockPush = jest.fn();
  const mockSignIn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    (useAuth as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
      loading: false,
      user: null,
    });
  });

  describe('Rendering', () => {
    it('should render login form with all elements', () => {
      render(<LoginPage />);

      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /sign in/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /create account/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /reset password/i })
      ).toBeInTheDocument();
    });

    it('should render email input with correct attributes', () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('placeholder', 'Enter your email');
      expect(emailInput).toBeRequired();
    });

    it('should render password input with correct attributes', () => {
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute(
        'placeholder',
        'Enter your password'
      );
      expect(passwordInput).toBeRequired();
    });

    it('should render navigation links', () => {
      render(<LoginPage />);

      expect(screen.getByText('← Back to Home')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should disable submit button when email is empty', () => {
      render(<LoginPage />);

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when password is empty', () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email');
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when both fields are filled', () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Test123!@#' } });

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Form Input', () => {
    it('should update email input value on change', () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      expect(emailInput.value).toBe('test@example.com');
    });

    it('should update password input value on change', () => {
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText(
        'Password'
      ) as HTMLInputElement;
      fireEvent.change(passwordInput, { target: { value: 'Test123!@#' } });

      expect(passwordInput.value).toBe('Test123!@#');
    });

    it('should handle multiple input changes', () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;

      fireEvent.change(emailInput, { target: { value: 'first@example.com' } });
      expect(emailInput.value).toBe('first@example.com');

      fireEvent.change(emailInput, { target: { value: 'second@example.com' } });
      expect(emailInput.value).toBe('second@example.com');
    });
  });

  describe('Form Submission', () => {
    it('should call signIn on form submit with valid credentials', async () => {
      mockSignIn.mockResolvedValue({ error: null });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Test123!@#' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(
          'test@example.com',
          'Test123!@#'
        );
      });
    });

    it('should prevent form submission when fields are empty', () => {
      render(<LoginPage />);

      const form = screen
        .getByRole('button', { name: /sign in/i })
        .closest('form');
      const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true,
      });

      form?.dispatchEvent(submitEvent);

      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('should display error message on failed login', async () => {
      mockSignIn.mockResolvedValue({
        error: { message: 'Invalid credentials' },
      });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'WrongPassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });

    it('should clear error message on new input', async () => {
      mockSignIn.mockResolvedValue({
        error: { message: 'Invalid credentials' },
      });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Submit with error
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'WrongPassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });

      // Change input should clear error
      fireEvent.change(emailInput, {
        target: { value: 'newemail@example.com' },
      });

      await waitFor(() => {
        expect(
          screen.queryByText(/invalid credentials/i)
        ).not.toBeInTheDocument();
      });
    });

    it('should show loading state during submission', async () => {
      mockSignIn.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(() => resolve({ error: null }), 100)
          )
      );

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Test123!@#' } });
      fireEvent.click(submitButton);

      // Check for loading state
      expect(
        screen.getByRole('button', { name: /signing in/i })
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /sign in/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to signup page on Create Account click', () => {
      render(<LoginPage />);

      const createAccountButton = screen.getByRole('button', {
        name: /create account/i,
      });
      fireEvent.click(createAccountButton);

      expect(mockPush).toHaveBeenCalledWith('/auth/signup');
    });

    it('should navigate to reset password page on Reset Password click', () => {
      render(<LoginPage />);

      const resetPasswordButton = screen.getByRole('button', {
        name: /reset password/i,
      });
      fireEvent.click(resetPasswordButton);

      expect(mockPush).toHaveBeenCalledWith('/auth/reset-password');
    });
  });

  describe('Successful Login Redirect', () => {
    it('should redirect to STAFF dashboard after successful STAFF login', async () => {
      mockSignIn.mockResolvedValue({ error: null });
      (useAuth as jest.Mock).mockReturnValue({
        signIn: mockSignIn,
        loading: false,
        user: { id: '123' },
        userProfile: { role: 'STAFF' },
      });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'staff@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Test123!@#' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/staff');
      });
    });

    it('should redirect to MANAGER dashboard after successful MANAGER login', async () => {
      mockSignIn.mockResolvedValue({ error: null });
      (useAuth as jest.Mock).mockReturnValue({
        signIn: mockSignIn,
        loading: false,
        user: { id: '123' },
        userProfile: { role: 'MANAGER' },
      });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, {
        target: { value: 'manager@example.com' },
      });
      fireEvent.change(passwordInput, { target: { value: 'Test123!@#' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/manager');
      });
    });

    it('should redirect to HR_ADMIN dashboard after successful HR_ADMIN login', async () => {
      mockSignIn.mockResolvedValue({ error: null });
      (useAuth as jest.Mock).mockReturnValue({
        signIn: mockSignIn,
        loading: false,
        user: { id: '123' },
        userProfile: { role: 'HR_ADMIN' },
      });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'hr@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Test123!@#' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/hr');
      });
    });
  });
});
