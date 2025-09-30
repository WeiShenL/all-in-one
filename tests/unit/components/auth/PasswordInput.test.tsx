import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PasswordInput } from '@/app/auth/components/PasswordInput';

describe('PasswordInput Component', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Basic Rendering', () => {
    test('renders with default props', () => {
      render(<PasswordInput value='' onChange={mockOnChange} />);

      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
      expect(screen.getByDisplayValue('')).toBeInTheDocument();
    });

    test('renders with custom label and placeholder', () => {
      render(
        <PasswordInput
          value=''
          onChange={mockOnChange}
          label='Custom Password'
          placeholder='Enter your custom password'
        />
      );

      expect(screen.getByLabelText('Custom Password')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Enter your custom password')
      ).toBeInTheDocument();
    });

    test('renders input with password type', () => {
      render(<PasswordInput value='' onChange={mockOnChange} />);

      const input = screen.getByLabelText('Password');
      expect(input).toHaveAttribute('type', 'password');
    });
  });

  describe('Value and Change Handling', () => {
    test('displays current value', () => {
      render(<PasswordInput value='test123' onChange={mockOnChange} />);

      expect(screen.getByDisplayValue('test123')).toBeInTheDocument();
    });

    test('calls onChange when value changes', () => {
      render(<PasswordInput value='' onChange={mockOnChange} />);

      const input = screen.getByLabelText('Password');
      fireEvent.change(input, { target: { value: 'newvalue' } });

      expect(mockOnChange).toHaveBeenCalledWith('newvalue');
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Validation Display Logic', () => {
    test('does not show validation initially', () => {
      render(<PasswordInput value='' onChange={mockOnChange} />);

      expect(
        screen.queryByText('✗ Minimum 8 characters')
      ).not.toBeInTheDocument();
      expect(screen.queryByText('✓ Strong password')).not.toBeInTheDocument();
    });

    test('shows validation after user starts typing', () => {
      render(<PasswordInput value='' onChange={mockOnChange} />);

      const input = screen.getByLabelText('Password');
      fireEvent.change(input, { target: { value: 'weak' } });

      // Should show validation checklist for invalid password
      expect(screen.getByText('✗ Minimum 8 characters')).toBeInTheDocument();
      expect(
        screen.getByText('✗ At least one uppercase letter')
      ).toBeInTheDocument();
      expect(
        screen.getByText('✗ At least one lowercase letter')
      ).toBeInTheDocument();
      expect(screen.getByText('✗ At least one number')).toBeInTheDocument();
      expect(
        screen.getByText('✗ At least one special character')
      ).toBeInTheDocument();
    });
  });

  describe('Requirements Checklist Display', () => {
    test('shows red crosses for unmet requirements', () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('');
        return <PasswordInput value={value} onChange={setValue} />;
      };

      render(<TestComponent />);

      const input = screen.getByLabelText('Password');
      fireEvent.change(input, { target: { value: 'abc' } });

      expect(screen.getByText('✗ Minimum 8 characters')).toBeInTheDocument();
      expect(
        screen.getByText('✗ At least one uppercase letter')
      ).toBeInTheDocument();
      expect(screen.getByText('✗ At least one number')).toBeInTheDocument();
      expect(
        screen.getByText('✗ At least one special character')
      ).toBeInTheDocument();
    });

    test('shows green checkmarks for met requirements', () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('');
        return <PasswordInput value={value} onChange={setValue} />;
      };

      render(<TestComponent />);

      const input = screen.getByLabelText('Password');
      fireEvent.change(input, { target: { value: 'Pass1!ab' } }); // 8 chars = strong

      // All requirements should be met, so should show strength bar instead
      expect(screen.queryByText('✗')).not.toBeInTheDocument();
      expect(screen.getByText('✓ Strong password')).toBeInTheDocument();
    });

    test('shows mixed checkmarks and crosses for partially valid password', () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('');
        return <PasswordInput value={value} onChange={setValue} />;
      };

      render(<TestComponent />);

      const input = screen.getByLabelText('Password');
      fireEvent.change(input, { target: { value: 'Longenough' } }); // Missing number and special char

      expect(screen.getByText('✓ Minimum 8 characters')).toBeInTheDocument();
      expect(
        screen.getByText('✓ At least one uppercase letter')
      ).toBeInTheDocument();
      expect(
        screen.getByText('✓ At least one lowercase letter')
      ).toBeInTheDocument();
      expect(screen.getByText('✗ At least one number')).toBeInTheDocument();
      expect(
        screen.getByText('✗ At least one special character')
      ).toBeInTheDocument();
    });
  });

  describe('Strength Bar Display', () => {
    test('shows strength bar when password is valid', () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('');
        return <PasswordInput value={value} onChange={setValue} />;
      };

      render(<TestComponent />);

      const input = screen.getByLabelText('Password');
      fireEvent.change(input, { target: { value: 'Pass1!ab' } }); // 8 chars = strong

      expect(screen.getByText('✓ Strong password')).toBeInTheDocument();
      expect(screen.queryByText('✗')).not.toBeInTheDocument();
    });

    test('shows very strong password indication', () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('');
        return <PasswordInput value={value} onChange={setValue} />;
      };

      render(<TestComponent />);

      const input = screen.getByLabelText('Password');
      fireEvent.change(input, { target: { value: 'Password1!' } }); // 10 characters

      expect(screen.getByText('✓ Very strong password')).toBeInTheDocument();
    });

    test('shows excellent password indication', () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('');
        return <PasswordInput value={value} onChange={setValue} />;
      };

      render(<TestComponent />);

      const input = screen.getByLabelText('Password');
      fireEvent.change(input, { target: { value: 'Password123!' } }); // 12+ characters

      expect(screen.getByText('✓ Excellent password')).toBeInTheDocument();
    });
  });

  describe('Dynamic validation transitions', () => {
    test('re-validates when password changes from valid to invalid', () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('');
        return <PasswordInput value={value} onChange={setValue} />;
      };

      render(<TestComponent />);

      const input = screen.getByLabelText('Password');

      // Start with valid password
      fireEvent.change(input, { target: { value: 'Pass1!ab' } });
      expect(screen.getByText('✓ Strong password')).toBeInTheDocument();

      // Change to invalid password
      fireEvent.change(input, { target: { value: 'weak' } });
      expect(screen.queryByText('✓ Strong password')).not.toBeInTheDocument();
      expect(screen.getByText('✗ Minimum 8 characters')).toBeInTheDocument();
    });
  });
});
