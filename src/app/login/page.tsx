'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Login functionality will be connected to Supabase Auth later');
  };

  const handleCreateAccount = () => {
    // Redirect to signup page
    window.location.href = '/signup';
  };

  const handlePasswordReset = () => {
    alert(
      'Password reset functionality will be implemented to call Supabase Auth in the future.'
    );
  };

  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '2rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>
        Welcome Back
      </h1>

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
            }}
          >
            Email
          </label>
          <input
            type='email'
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            placeholder='Enter your email'
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
            }}
          >
            Password
          </label>
          <input
            type='password'
            value={formData.password}
            onChange={e =>
              setFormData({ ...formData, password: e.target.value })
            }
            placeholder='Enter your password'
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
            }}
          />
        </div>

        <button
          type='submit'
          disabled={!formData.email || !formData.password}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor:
              formData.email && formData.password ? '#007bff' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor:
              formData.email && formData.password ? 'pointer' : 'not-allowed',
            marginBottom: '1rem',
          }}
        >
          Sign In
        </button>
      </form>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginTop: '1.5rem',
        }}
      >
        <button
          onClick={handleCreateAccount}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Create Account
        </button>

        <button
          onClick={handlePasswordReset}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#ffc107',
            color: '#212529',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Reset Password
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <Link href='/' style={{ color: '#007bff', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
