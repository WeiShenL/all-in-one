'use client';

import { useState } from 'react';
import {
  validatePassword,
  PasswordValidationResult,
} from '../../lib/passwordValidation';
import { PasswordStrengthBar } from './PasswordStrengthBar';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function PasswordInput({
  value,
  onChange,
  placeholder = 'Enter password',
  label = 'Password',
}: PasswordInputProps) {
  const [showValidation, setShowValidation] = useState(false);
  const validation: PasswordValidationResult = validatePassword(value);
  const inputId = `password-input-${Math.random().toString(36).substr(2, 9)}`;

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
        htmlFor={inputId}
        style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
      >
        {label}
      </label>

      <input
        id={inputId}
        type='password'
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: `2px solid ${validation.isValid && value.length > 0 ? 'green' : showValidation && !validation.isValid ? 'red' : '#ccc'}`,
          borderRadius: '4px',
          fontSize: '1rem',
        }}
      />

      {showValidation && (
        <div style={{ marginTop: '0.5rem' }}>
          {validation.isValid ? (
            /* Show only strength indicator when all requirements are met */
            <PasswordStrengthBar
              strengthLevel={validation.strengthLevel}
              strength={validation.strength}
            />
          ) : (
            /* Show requirements checklist when not all requirements are met */
            <>
              <div
                style={{
                  fontSize: '0.875rem',
                  color: validation.minLength ? 'green' : 'red',
                }}
              >
                {validation.minLength ? '✓' : '✗'} Minimum 8 characters
              </div>

              <div
                style={{
                  fontSize: '0.875rem',
                  color: validation.hasUppercase ? 'green' : 'red',
                }}
              >
                {validation.hasUppercase ? '✓' : '✗'} At least one uppercase
                letter
              </div>

              <div
                style={{
                  fontSize: '0.875rem',
                  color: validation.hasLowercase ? 'green' : 'red',
                }}
              >
                {validation.hasLowercase ? '✓' : '✗'} At least one lowercase
                letter
              </div>

              <div
                style={{
                  fontSize: '0.875rem',
                  color: validation.hasNumber ? 'green' : 'red',
                }}
              >
                {validation.hasNumber ? '✓' : '✗'} At least one number
              </div>

              <div
                style={{
                  fontSize: '0.875rem',
                  color: validation.hasSpecialChar ? 'green' : 'red',
                }}
              >
                {validation.hasSpecialChar ? '✓' : '✗'} At least one special
                character
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
