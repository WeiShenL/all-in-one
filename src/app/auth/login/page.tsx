'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
// dummy commit
export default function LoginPage() {
  const router = useRouter();
  const { signIn, user, userProfile, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && userProfile) {
      const roleRoutes = {
        STAFF: '/dashboard/staff',
        MANAGER: '/dashboard/manager',
        HR_ADMIN: '/dashboard/hr',
      };
      router.push(roleRoutes[userProfile.role]);
    }
  }, [user, userProfile, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Add this validation check
    if (!formData.email || !formData.password) {
      setError('Email and password cannot be empty.');
      return; // Stop the function here
    }

    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await signIn(
        formData.email,
        formData.password
      );

      if (signInError) {
        setError(
          typeof signInError === 'string'
            ? signInError
            : (signInError as Error).message || 'Invalid email or password'
        );
        setLoading(false);
        return;
      }

      // On successful login, the useEffect hook will handle the redirect.
      // The component will unmount, so no need to setLoading(false) here.
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleCreateAccount = () => {
    router.push('/auth/signup');
  };

  const handlePasswordReset = () => {
    router.push('/auth/reset-password');
  };

  if (authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <p>Loading...</p>
      </div>
    );
  }

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
          maxWidth: '450px',
          width: '100%',
          padding: '2.5rem',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h1
          style={{
            textAlign: 'center',
            marginBottom: '0.5rem',
            color: '#1a202c',
            fontSize: '1.875rem',
            fontWeight: '700',
          }}
        >
          Welcome Back
        </h1>
        <p
          style={{
            textAlign: 'center',
            marginBottom: '2rem',
            color: '#718096',
            fontSize: '0.875rem',
          }}
        >
          Sign in to access your dashboard
        </p>

        {error && (
          <div
            style={{
              backgroundColor: '#fed7d7',
              border: '1px solid #fc8181',
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '1rem',
              color: '#c53030',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor='email'
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#2d3748',
                fontSize: '0.875rem',
              }}
            >
              Email
            </label>
            <input
              id='email'
              type='email'
              value={formData.email}
              onChange={e => {
                setFormData({ ...formData, email: e.target.value });
                setError('');
              }}
              placeholder='Enter your email'
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = '#3182ce')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor='password'
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#2d3748',
                fontSize: '0.875rem',
              }}
            >
              Password
            </label>
            <input
              id='password'
              type='password'
              value={formData.password}
              onChange={e => {
                setFormData({ ...formData, password: e.target.value });
                setError('');
              }}
              placeholder='Enter your password'
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = '#3182ce')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
            />
          </div>

          <button
            type='submit'
            disabled={!formData.email || !formData.password || loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              backgroundColor:
                formData.email && formData.password && !loading
                  ? '#3182ce'
                  : '#cbd5e0',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor:
                formData.email && formData.password && !loading
                  ? 'pointer'
                  : 'not-allowed',
              marginBottom: '1rem',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={e => {
              if (formData.email && formData.password && !loading) {
                e.currentTarget.style.backgroundColor = '#2c5282';
              }
            }}
            onMouseLeave={e => {
              if (formData.email && formData.password && !loading) {
                e.currentTarget.style.backgroundColor = '#3182ce';
              }
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '1.5rem 0',
          }}
        >
          <div
            style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}
          ></div>
          <span
            style={{
              padding: '0 0.75rem',
              color: '#a0aec0',
              fontSize: '0.875rem',
            }}
          >
            or
          </span>
          <div
            style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}
          ></div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <button
            onClick={handleCreateAccount}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#48bb78',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={e =>
              (e.currentTarget.style.backgroundColor = '#38a169')
            }
            onMouseLeave={e =>
              (e.currentTarget.style.backgroundColor = '#48bb78')
            }
          >
            Create Account
          </button>

          <button
            onClick={handlePasswordReset}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: 'transparent',
              color: '#3182ce',
              border: '1px solid #3182ce',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#ebf8ff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Reset Password
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link
            href='/'
            style={{
              color: '#3182ce',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
