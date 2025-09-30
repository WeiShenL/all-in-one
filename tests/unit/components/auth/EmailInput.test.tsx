import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailInput } from '../../../../src/app/auth/components/EmailInput';

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
});
