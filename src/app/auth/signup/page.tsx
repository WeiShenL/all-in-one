'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PasswordInput } from '../components/PasswordInput';
import { EmailInput } from '../components/EmailInput';
import { validatePassword } from '../../lib/passwordValidation';
import { validateEmail } from '../../lib/emailValidation';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
  });

  const passwordValidation = validatePassword(formData.password);
  const emailValidation = validateEmail(formData.email);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailValidation.isValid) {
      alert('Please enter a valid email address');
      return;
    }

    if (!passwordValidation.isValid) {
      alert('Please fix password validation errors before submitting');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    alert(
      'Password validation passed! (Supabase integration will be added later)'
    );
  };

  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '2rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>
        Create Account
      </h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
            }}
          >
            Name
          </label>
          <input
            type='text'
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder='Enter your name'
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
            }}
          />
        </div>

        <EmailInput
          value={formData.email}
          onChange={value => setFormData({ ...formData, email: value })}
          label='Email'
          placeholder='Enter your email'
          required
        />

        <PasswordInput
          value={formData.password}
          onChange={value => setFormData({ ...formData, password: value })}
          label='Password'
          placeholder='Create a password'
        />

        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
            }}
          >
            Confirm Password
          </label>
          <input
            type='password'
            value={formData.confirmPassword}
            onChange={e =>
              setFormData({ ...formData, confirmPassword: e.target.value })
            }
            placeholder='Confirm your password'
            style={{
              width: '100%',
              padding: '0.75rem',
              border: `2px solid ${
                formData.confirmPassword &&
                formData.password === formData.confirmPassword
                  ? 'green'
                  : formData.confirmPassword &&
                      formData.password !== formData.confirmPassword
                    ? 'red'
                    : '#ccc'
              }`,
              borderRadius: '4px',
              fontSize: '1rem',
            }}
          />
          {formData.confirmPassword &&
            formData.password !== formData.confirmPassword && (
              <div
                style={{
                  fontSize: '0.875rem',
                  color: 'red',
                  marginTop: '0.25rem',
                }}
              >
                Passwords do not match
              </div>
            )}
        </div>

        <button
          type='submit'
          disabled={
            !emailValidation.isValid ||
            !passwordValidation.isValid ||
            formData.password !== formData.confirmPassword
          }
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor:
              emailValidation.isValid &&
              passwordValidation.isValid &&
              formData.password === formData.confirmPassword
                ? '#007bff'
                : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor:
              emailValidation.isValid &&
              passwordValidation.isValid &&
              formData.password === formData.confirmPassword
                ? 'pointer'
                : 'not-allowed',
          }}
        >
          Create Account
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <Link href='/' style={{ color: '#007bff', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
