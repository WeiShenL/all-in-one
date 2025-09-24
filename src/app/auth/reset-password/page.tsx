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
        maxWidth: '500px',
        margin: '2rem auto',
        padding: '2rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      }}
    >
      {showForm ? (
        <div>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ color: '#333', marginBottom: '0.5rem' }}>
              Reset Your Password
            </h1>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
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
              backgroundColor: '#d4edda',
              border: '1px solid #c3e6cb',
              borderRadius: '4px',
              padding: '2rem',
              marginBottom: '2rem',
              color: '#155724',
            }}
          >
            <h2 style={{ marginBottom: '1rem' }}>
              🎉 Password Reset Complete!
            </h2>
            <p style={{ marginBottom: '1.5rem' }}>
              Your password has been successfully changed. You can now use your
              new password to log in.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'center',
              }}
            >
              <Link
                href='/auth/login'
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  display: 'inline-block',
                  fontWeight: '500',
                }}
              >
                Go to Login
              </Link>

              <Link
                href='/'
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  display: 'inline-block',
                  fontWeight: '500',
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
          style={{ color: '#007bff', textDecoration: 'none' }}
        >
          ← Back to Login
        </Link>
      </div>
    </div>
  );
}
