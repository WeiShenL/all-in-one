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
  const inputId = `email-input-${Math.random().toString(36).substr(2, 9)}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (newValue.length > 0) {
      setShowValidation(true);
    } else {
      setShowValidation(false);
    }
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label
        htmlFor={inputId}
        style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontWeight: '600',
          color: '#2d3748',
          fontSize: '0.875rem',
        }}
      >
        {label}
      </label>

      <input
        id={inputId}
        type='email'
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: `1px solid ${
            validation.isValid && value.length > 0
              ? '#48bb78'
              : showValidation && validation.error
                ? '#fc8181'
                : '#e2e8f0'
          }`,
          borderRadius: '8px',
          fontSize: '1rem',
          transition: 'border-color 0.2s',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={e => {
          if (!showValidation || validation.isValid) {
            e.target.style.borderColor = '#3182ce';
          }
        }}
        onBlur={e => {
          if (validation.isValid && value.length > 0) {
            e.target.style.borderColor = '#48bb78';
          } else if (showValidation && validation.error) {
            e.target.style.borderColor = '#fc8181';
          } else {
            e.target.style.borderColor = '#e2e8f0';
          }
        }}
      />

      {showValidation && validation.error && (
        <div style={{ marginTop: '0.25rem' }}>
          <div
            style={{
              fontSize: '0.875rem',
              color: '#c53030',
            }}
          >
            ✗ {validation.error}
          </div>
        </div>
      )}

      {showValidation && validation.isValid && value.length > 0 && (
        <div style={{ marginTop: '0.25rem' }}>
          <div
            style={{
              fontSize: '0.875rem',
              color: '#38a169',
            }}
          >
            ✓ Valid email format
          </div>
        </div>
      )}
    </div>
  );
}
