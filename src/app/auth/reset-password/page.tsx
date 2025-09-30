'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PasswordChangeForm } from '../components/PasswordChangeForm';

export default function ResetPasswordPage() {
  const [showForm, setShowForm] = useState(true);

  const handleSuccess = () => {
    setShowForm(false);
  };

  const handleCancel = () => {
    window.history.back();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f7fafc',
        padding: '1rem',
      }}
    >
      <div
        style={{
          maxWidth: '500px',
          width: '100%',
          padding: '2.5rem',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        {showForm ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h1
                style={{
                  color: '#1a202c',
                  marginBottom: '0.5rem',
                  fontSize: '1.875rem',
                  fontWeight: '700',
                }}
              >
                Reset Your Password
              </h1>
              <p style={{ color: '#718096', fontSize: '0.875rem' }}>
                Enter your new password below. Make sure it meets all security
                requirements.
              </p>
            </div>

            <PasswordChangeForm
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                backgroundColor: '#c6f6d5',
                border: '1px solid #48bb78',
                borderRadius: '8px',
                padding: '2rem',
                marginBottom: '2rem',
                color: '#22543d',
              }}
            >
              <h2
                style={{
                  marginBottom: '1rem',
                  fontSize: '1.5rem',
                  fontWeight: '700',
                }}
              >
                Password Reset Complete!
              </h2>
              <p style={{ marginBottom: '1.5rem', color: '#2d3748' }}>
                Your password has been successfully changed. You can now use
                your new password to log in.
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Link
                  href='/auth/login'
                  style={{
                    backgroundColor: '#3182ce',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    display: 'inline-block',
                    fontWeight: '600',
                  }}
                >
                  Go to Login
                </Link>

                <Link
                  href='/'
                  style={{
                    backgroundColor: '#48bb78',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    display: 'inline-block',
                    fontWeight: '600',
                  }}
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link
            href='/auth/login'
            style={{
              color: '#3182ce',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
