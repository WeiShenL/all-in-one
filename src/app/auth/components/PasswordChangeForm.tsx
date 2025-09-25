'use client';

import { useState, useEffect } from 'react';
import { validatePassword } from '../../lib/passwordValidation';
import { PasswordInput } from './PasswordInput';

interface PasswordChangeFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PasswordChangeForm({
  onSuccess,
  onCancel,
}: PasswordChangeFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const newPasswordValidation = validatePassword(newPassword);
  const passwordsMatch =
    newPassword === confirmPassword && confirmPassword.length > 0;

  const canSubmit =
    newPasswordValidation.isValid && passwordsMatch && !isSubmitting;

  // Clear errors when validation conditions are met
  useEffect(() => {
    if (error && newPasswordValidation.isValid && passwordsMatch) {
      setError('');
    }
  }, [error, newPasswordValidation.isValid, passwordsMatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPasswordValidation.isValid) {
      setError('Please ensure your new password meets all requirements');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock implementation - will be connected to Supabase later
      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccess(false);
        onSuccess?.();
      }, 2000);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '2rem',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '4px',
          color: '#155724',
        }}
      >
        <h3>Password Changed Successfully!</h3>
        <p>Your password has been updated.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '400px' }}>
      <h3 style={{ marginBottom: '1.5rem', color: '#333' }}>Change Password</h3>

      <PasswordInput
        value={newPassword}
        onChange={setNewPassword}
        placeholder='Enter new password'
        label='New Password'
      />

      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor='confirm-password-input'
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: 'bold',
          }}
        >
          Confirm New Password
        </label>
        <input
          id='confirm-password-input'
          type='password'
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder='Confirm new password'
          style={{
            width: '100%',
            padding: '0.75rem',
            border: `2px solid ${
              passwordsMatch && confirmPassword.length > 0
                ? 'green'
                : confirmPassword.length > 0 && !passwordsMatch
                  ? 'red'
                  : '#ccc'
            }`,
            borderRadius: '4px',
            fontSize: '1rem',
          }}
        />
        {confirmPassword.length > 0 && !passwordsMatch && (
          <div
            style={{
              color: 'red',
              fontSize: '0.875rem',
              marginTop: '0.25rem',
            }}
          >
            ✗ Passwords do not match
          </div>
        )}
        {passwordsMatch && confirmPassword.length > 0 && (
          <div
            style={{
              color: 'green',
              fontSize: '0.875rem',
              marginTop: '0.25rem',
            }}
          >
            ✓ Passwords match
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            color: '#721c24',
            padding: '0.75rem',
            borderRadius: '4px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          marginTop: '1.5rem',
        }}
      >
        <button
          type='submit'
          disabled={!canSubmit}
          style={{
            flex: 1,
            padding: '0.75rem',
            backgroundColor: canSubmit ? '#007bff' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {isSubmitting ? 'Changing Password...' : 'Change Password'}
        </button>

        {onCancel && (
          <button
            type='button'
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
