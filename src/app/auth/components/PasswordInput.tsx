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
        type='password'
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: `1px solid ${validation.isValid && value.length > 0 ? '#48bb78' : showValidation && !validation.isValid ? '#fc8181' : '#e2e8f0'}`,
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
          } else if (showValidation && !validation.isValid) {
            e.target.style.borderColor = '#fc8181';
          } else {
            e.target.style.borderColor = '#e2e8f0';
          }
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
                  color: validation.minLength ? '#38a169' : '#c53030',
                }}
              >
                {validation.minLength ? '✓' : '✗'} Minimum 8 characters
              </div>

              <div
                style={{
                  fontSize: '0.875rem',
                  color: validation.hasUppercase ? '#38a169' : '#c53030',
                }}
              >
                {validation.hasUppercase ? '✓' : '✗'} At least one uppercase
                letter
              </div>

              <div
                style={{
                  fontSize: '0.875rem',
                  color: validation.hasLowercase ? '#38a169' : '#c53030',
                }}
              >
                {validation.hasLowercase ? '✓' : '✗'} At least one lowercase
                letter
              </div>

              <div
                style={{
                  fontSize: '0.875rem',
                  color: validation.hasNumber ? '#38a169' : '#c53030',
                }}
              >
                {validation.hasNumber ? '✓' : '✗'} At least one number
              </div>

              <div
                style={{
                  fontSize: '0.875rem',
                  color: validation.hasSpecialChar ? '#38a169' : '#c53030',
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
