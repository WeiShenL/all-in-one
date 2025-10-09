import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginPage from '@/app/auth/login/page';
import { useAuth } from '@/lib/supabase/auth-context';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('@/lib/supabase/auth-context', () => ({
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
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
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

      // Use fireEvent.submit which is the correct way to test form submissions
      // and is properly wrapped in act() by the testing library.
      if (form) {
        fireEvent.submit(form);
      }

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

    it('should show loading state during a failed submission', async () => {
      // 1. Use fake timers
      jest.useFakeTimers();

      // 2. Mock a FAILED sign-in that takes 100ms
      mockSignIn.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () => resolve({ error: { message: 'Invalid credentials' } }),
              100
            )
          )
      );

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrong-password' } });
      fireEvent.click(submitButton);

      // 3. Assert that the button is in its loading state
      expect(
        screen.getByRole('button', { name: /signing in/i })
      ).toBeDisabled();

      // 4. Advance timers and flush promises within act
      await act(async () => {
        jest.advanceTimersByTime(100); // Fast-forward
        await Promise.resolve(); // Flush any pending promise microtasks
      });

      // 5. Assert that the button has reverted and the error message is shown
      const finalButton = await screen.findByRole('button', {
        name: /sign in/i,
      });
      expect(finalButton).not.toBeDisabled();
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();

      // 6. Restore real timers
      jest.useRealTimers();
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
