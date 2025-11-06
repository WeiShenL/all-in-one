import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailInput } from '@/app/auth/components/EmailInput';

describe('EmailInput Component', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  const TestComponent = ({ initialValue = '' }: { initialValue?: string }) => {
    const [value, setValue] = React.useState(initialValue);
    return <EmailInput value={value} onChange={setValue} />;
  };

  describe('Basic functionality', () => {
    test('renders with default props', () => {
      render(<EmailInput value='' onChange={mockOnChange} />);

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Enter your email')
      ).toBeInTheDocument();
    });

    test('calls onChange when value changes', () => {
      render(<EmailInput value='' onChange={mockOnChange} />);

      const input = screen.getByLabelText('Email');
      fireEvent.change(input, { target: { value: 'test@example.com' } });

      expect(mockOnChange).toHaveBeenCalledWith('test@example.com');
    });

    test('displays current value', () => {
      render(<EmailInput value='test@example.com' onChange={mockOnChange} />);

      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    });
  });

  describe('Validation display', () => {
    test('shows error for invalid email after typing', () => {
      render(<TestComponent />);

      const input = screen.getByLabelText('Email');
      fireEvent.change(input, { target: { value: 'invalid' } });

      expect(
        screen.getByText('✗ Email must contain @ symbol')
      ).toBeInTheDocument();
    });

    test('shows success for valid email', () => {
      render(<TestComponent />);

      const input = screen.getByLabelText('Email');
      fireEvent.change(input, { target: { value: 'test@example.com' } });

      expect(screen.getByText('✓ Valid email format')).toBeInTheDocument();
    });

    test('does not show validation for empty input', () => {
      render(<EmailInput value='' onChange={mockOnChange} />);

      expect(
        screen.queryByText('✗ Email must contain @ symbol')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('✓ Valid email format')
      ).not.toBeInTheDocument();
    });

    test('hides validation when input is cleared', () => {
      render(<TestComponent />);

      const input = screen.getByLabelText('Email');
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.change(input, { target: { value: '' } });

      expect(
        screen.queryByText('✗ Email must contain @ symbol')
      ).not.toBeInTheDocument();
    });
  });

  describe('Props handling', () => {
    test('renders with custom props', () => {
      render(
        <EmailInput
          value=''
          onChange={mockOnChange}
          label='Work Email'
          placeholder='Enter work email'
          required={true}
        />
      );

      expect(screen.getByLabelText('Work Email')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Enter work email')
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Work Email')).toBeRequired();
    });
  });

  describe('Focus and blur behavior', () => {
    test('applies focus styles to input', () => {
      render(<TestComponent initialValue='test@example.com' />);

      const input = screen.getByLabelText('Email') as HTMLInputElement;

      // Trigger focus - just verify the focus event fires
      fireEvent.focus(input);

      // The style changes are applied via inline styles in onFocus
      expect(input.style.borderColor).toBeTruthy();
    });

    test('restores border color on blur for valid email', () => {
      render(<TestComponent initialValue='test@example.com' />);

      const input = screen.getByLabelText('Email') as HTMLInputElement;

      fireEvent.focus(input);
      fireEvent.blur(input);

      // Blur handler applies styles based on validation state
      expect(input.style.borderColor).toBeTruthy();
    });

    test('shows error state on blur for invalid email after user interaction', () => {
      render(<TestComponent />);

      const input = screen.getByLabelText('Email') as HTMLInputElement;

      // Type invalid email to trigger showValidation
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.focus(input);
      fireEvent.blur(input);

      // Error message should be visible after interaction
      expect(
        screen.getByText('✗ Email must contain @ symbol')
      ).toBeInTheDocument();
    });

    test('applies default border color on blur for empty email', () => {
      render(<TestComponent />);

      const input = screen.getByLabelText('Email') as HTMLInputElement;

      fireEvent.focus(input);
      fireEvent.blur(input);

      // Should apply default border color
      expect(input.style.borderColor).toBeTruthy();
    });
  });

  describe('Validation edge cases', () => {
    test('validates email with @ symbol correctly', () => {
      render(<TestComponent />);

      const input = screen.getByLabelText('Email');
      // The validation only checks for @ symbol presence
      fireEvent.change(input, { target: { value: '@example.com' } });

      // Has @ symbol so validation passes
      expect(screen.getByText('✓ Valid email format')).toBeInTheDocument();
    });

    test('validates email with @ at end', () => {
      render(<TestComponent />);

      const input = screen.getByLabelText('Email');
      fireEvent.change(input, { target: { value: 'test@' } });

      // Has @ symbol so validation passes (simple validation)
      expect(screen.getByText('✓ Valid email format')).toBeInTheDocument();
    });

    test('validates email with multiple @ symbols', () => {
      render(<TestComponent />);

      const input = screen.getByLabelText('Email');
      fireEvent.change(input, { target: { value: 'test@@example.com' } });

      // Has @ symbol so validation passes
      expect(screen.getByText('✓ Valid email format')).toBeInTheDocument();
    });

    test('handles valid email with subdomain', () => {
      render(<TestComponent />);

      const input = screen.getByLabelText('Email');
      fireEvent.change(input, { target: { value: 'test@mail.example.com' } });

      expect(screen.getByText('✓ Valid email format')).toBeInTheDocument();
    });

    test('handles valid email with plus sign', () => {
      render(<TestComponent />);

      const input = screen.getByLabelText('Email');
      fireEvent.change(input, { target: { value: 'test+tag@example.com' } });

      expect(screen.getByText('✓ Valid email format')).toBeInTheDocument();
    });
  });

  describe('Input ID generation', () => {
    test('generates unique IDs for multiple instances', () => {
      const { container } = render(
        <>
          <EmailInput value='' onChange={jest.fn()} />
          <EmailInput value='' onChange={jest.fn()} />
        </>
      );

      const inputs = container.querySelectorAll('input[type="email"]');
      const ids = Array.from(inputs).map(input => input.id);

      // IDs should exist and be unique
      expect(ids[0]).toBeTruthy();
      expect(ids[1]).toBeTruthy();
      expect(ids[0]).not.toBe(ids[1]);
    });
  });
});
