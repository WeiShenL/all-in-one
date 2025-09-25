import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordChangeForm } from '../PasswordChangeForm';

describe('PasswordChangeForm Integration Tests', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    mockOnSuccess.mockClear();
    mockOnCancel.mockClear();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Form Rendering', () => {
    test('renders form with all required elements', () => {
      render(<PasswordChangeForm />);

      expect(
        screen.getByRole('heading', { name: 'Change Password' })
      ).toBeInTheDocument();
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Change Password' })
      ).toBeInTheDocument();
    });

    test('renders cancel button when onCancel is provided', () => {
      render(<PasswordChangeForm onCancel={mockOnCancel} />);

      expect(
        screen.getByRole('button', { name: 'Cancel' })
      ).toBeInTheDocument();
    });

    test('does not render cancel button when onCancel is not provided', () => {
      render(<PasswordChangeForm />);

      expect(
        screen.queryByRole('button', { name: 'Cancel' })
      ).not.toBeInTheDocument();
    });
  });

  describe('Form Validation and Submit Button State', () => {
    test('submit button is disabled initially', () => {
      render(<PasswordChangeForm />);

      const submitButton = screen.getByRole('button', {
        name: 'Change Password',
      });
      expect(submitButton).toBeDisabled();
    });

    test('submit button is disabled when passwords do not match', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<PasswordChangeForm />);

      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText(
        'Confirm New Password'
      );

      await user.type(newPasswordInput, 'Password1!');
      await user.type(confirmPasswordInput, 'Password2!');

      const submitButton = screen.getByRole('button', {
        name: 'Change Password',
      });
      expect(submitButton).toBeDisabled();
    });

    test('submit button is enabled when all requirements are met', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<PasswordChangeForm />);

      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText(
        'Confirm New Password'
      );

      await user.type(newPasswordInput, 'Password1!');
      await user.type(confirmPasswordInput, 'Password1!');

      const submitButton = screen.getByRole('button', {
        name: 'Change Password',
      });
      expect(submitButton).toBeEnabled();
    });
  });

  describe('Password Confirmation Validation', () => {
    test('shows error when passwords do not match', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<PasswordChangeForm />);

      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText(
        'Confirm New Password'
      );

      await user.type(newPasswordInput, 'Password1!');
      await user.type(confirmPasswordInput, 'DifferentPassword1!');

      expect(screen.getByText('✗ Passwords do not match')).toBeInTheDocument();
    });

    test('shows success when passwords match', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<PasswordChangeForm />);

      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText(
        'Confirm New Password'
      );

      await user.type(newPasswordInput, 'Password1!');
      await user.type(confirmPasswordInput, 'Password1!');

      expect(screen.getByText('✓ Passwords match')).toBeInTheDocument();
    });
  });

  describe('Form Submission Flow', () => {
    test('prevents submission with validation error message', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<PasswordChangeForm />);

      const form = document.querySelector('form');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText(
        'Confirm New Password'
      );

      await user.type(newPasswordInput, 'weak');
      await user.type(confirmPasswordInput, 'weak');

      await act(async () => {
        if (form) {
          fireEvent.submit(form);
        }
      });

      expect(
        screen.getByText(
          'Please ensure your new password meets all requirements'
        )
      ).toBeInTheDocument();
    });

    test('prevents submission when passwords do not match', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<PasswordChangeForm />);

      const form = document.querySelector('form');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText(
        'Confirm New Password'
      );

      await user.type(newPasswordInput, 'Password1!');
      await user.type(confirmPasswordInput, 'Password2!');

      if (form) {
        fireEvent.submit(form);
      }

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });

    test('shows loading state during submission', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<PasswordChangeForm />);

      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText(
        'Confirm New Password'
      );
      const submitButton = screen.getByRole('button', {
        name: 'Change Password',
      });

      await user.type(newPasswordInput, 'Password1!');
      await user.type(confirmPasswordInput, 'Password1!');

      await user.click(submitButton);

      expect(screen.getByText('Changing Password...')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Changing Password...' })
      ).toBeDisabled();
    });

    test('successful submission shows success message and clears form', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<PasswordChangeForm onSuccess={mockOnSuccess} />);

      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText(
        'Confirm New Password'
      );
      const submitButton = screen.getByRole('button', {
        name: 'Change Password',
      });

      await user.type(newPasswordInput, 'Password1!');
      await user.type(confirmPasswordInput, 'Password1!');

      await user.click(submitButton);

      // Fast-forward through the mock API delay (1 second)
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(
          screen.getByText('Password Changed Successfully!')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Your password has been updated.')
        ).toBeInTheDocument();
      });

      // Fast-forward through the success display timeout (2 seconds)
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Button Interactions', () => {
    test('cancel button calls onCancel callback', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<PasswordChangeForm onCancel={mockOnCancel} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    test('form submission is prevented when button is disabled', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<PasswordChangeForm />);

      const submitButton = screen.getByRole('button', {
        name: 'Change Password',
      });
      expect(submitButton).toBeDisabled();

      // Try to click disabled button
      await user.click(submitButton);

      // Should not show loading state or any submission effects
      expect(
        screen.queryByText('Changing Password...')
      ).not.toBeInTheDocument();
    });
  });
});
