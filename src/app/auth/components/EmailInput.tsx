'use client';

import { useState } from 'react';
import {
  validateEmail,
  EmailValidationResult,
} from '../../lib/emailValidation';

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export function EmailInput({
  value,
  onChange,
  placeholder = 'Enter your email',
  label = 'Email',
  required = false,
}: EmailInputProps) {
  const [showValidation, setShowValidation] = useState(false);
  const validation: EmailValidationResult = validateEmail(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (newValue.length > 0) {
      setShowValidation(true);
    }
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label
        style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
      >
        {label}
      </label>

      <input
        type='email'
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: `2px solid ${
            validation.isValid && value.length > 0
              ? 'green'
              : showValidation && validation.error
                ? 'red'
                : '#ccc'
          }`,
          borderRadius: '4px',
          fontSize: '1rem',
        }}
      />

      {showValidation && validation.error && (
        <div style={{ marginTop: '0.5rem' }}>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'red',
            }}
          >
            ✗ {validation.error}
          </div>
        </div>
      )}

      {showValidation && validation.isValid && value.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'green',
            }}
          >
            ✓ Valid email format
          </div>
        </div>
      )}
    </div>
  );
}
