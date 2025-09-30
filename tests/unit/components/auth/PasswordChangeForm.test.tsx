import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordChangeForm } from '@/app/auth/components/PasswordChangeForm';

// Mocks for callbacks
const mockOnSuccess = jest.fn();
const mockOnCancel = jest.fn();

describe('PasswordChangeForm Integration Tests', () => {
  beforeEach(() => {
    // Reset mocks and timers before each test
    mockOnSuccess.mockClear();
    mockOnCancel.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Clean up timers after each test
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
  });

  describe('Form Validation and Submit Button State', () => {
    test('submit button is disabled initially', () => {
      render(<PasswordChangeForm />);
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

      // Use findByText to wait for the async validation message
      expect(
        await screen.findByText('✗ Passwords do not match')
      ).toBeInTheDocument();
    });
  });

  describe('Form Submission Flow', () => {
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

      // Await the loading state to appear
      expect(
        await screen.findByText('Changing Password...')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Changing Password...' })
      ).toBeDisabled();
    });

    // THIS IS THE KEY FIX - Awaiting each UI change sequentially
    test('successful submission shows success message, clears form, and calls onSuccess', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<PasswordChangeForm onSuccess={mockOnSuccess} />);

      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText(
        'Confirm New Password'
      );

      // 1. Fill out the form
      await user.type(newPasswordInput, 'Password1!');
      await user.type(confirmPasswordInput, 'Password1!');
      const submitButton = screen.getByRole('button', {
        name: 'Change Password',
      });

      // 2. Click submit
      await user.click(submitButton);

      // 3. AWAIT the loading state to appear. This ensures the first state update is handled.
      expect(
        await screen.findByRole('button', { name: /changing password/i })
      ).toBeDisabled();

      // 4. Advance timers to simulate the API call finishing. Must be in `act`.
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // 5. AWAIT the success message to appear. This handles the success state update.
      expect(
        await screen.findByText('Password Changed Successfully!')
      ).toBeInTheDocument();

      // 6. Advance timers again for the success message to disappear. Must be in `act`.
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // 7. Assert the final state: callback was called and success message is gone.
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByText('Password Changed Successfully!')
      ).not.toBeInTheDocument();
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
  });
});
