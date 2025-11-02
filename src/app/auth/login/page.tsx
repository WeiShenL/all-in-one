'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, user, userProfile, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showSessionExpired, setShowSessionExpired] = useState(false);

  // Check if session expired from localStorage or URL param
  const redirectUrl = searchParams.get('redirect');

  useEffect(() => {
    // Check localStorage first
    const expiredFromStorage = localStorage.getItem('sessionExpired');
    const redirectFromStorage = localStorage.getItem('sessionExpiredRedirect');

    if (expiredFromStorage === 'true') {
      setShowSessionExpired(true);
      // Clear the flag after reading
      localStorage.removeItem('sessionExpired');

      // Optionally use redirectFromStorage if needed
      if (redirectFromStorage) {
        localStorage.removeItem('sessionExpiredRedirect');
      }
    } else {
      // Fallback to URL param
      const expired = searchParams.get('expired');
      if (expired === 'true') {
        setShowSessionExpired(true);
      }
    }
  }, [searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && userProfile) {
      // If there's a redirect URL from session expiry, use it
      if (redirectUrl) {
        router.push(redirectUrl);
      } else {
        // All users (STAFF, MANAGER, HR/Admin) go to personal dashboard
        router.push('/dashboard/personal');
      }
    }
  }, [user, userProfile, authLoading, router, redirectUrl]);

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

        {showSessionExpired && (
          <div
            style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeeba',
              borderRadius: '4px',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              color: '#856404',
              fontSize: '0.8125rem',
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}
          >
            <svg
              width='16'
              height='16'
              viewBox='0 0 16 16'
              fill='#ffc107'
              style={{ flexShrink: 0, marginTop: '2px' }}
            >
              <path d='M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm.93 4.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 4.588zM9 12a1 1 0 1 0-2 0 1 1 0 0 0 2 0z' />
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                Session Expired
              </div>
              <div>
                Your session has expired due to inactivity. Please log in again.
              </div>
            </div>
            <button
              onClick={() => setShowSessionExpired(false)}
              style={{
                background: 'none',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                color: '#856404',
                opacity: 0.6,
                flexShrink: 0,
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '2px',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
              aria-label='Close notification'
            >
              <svg
                width='12'
                height='12'
                viewBox='0 0 12 12'
                fill='currentColor'
              >
                <path d='M6 4.586L9.293 1.293a1 1 0 011.414 1.414L7.414 6l3.293 3.293a1 1 0 01-1.414 1.414L6 7.414l-3.293 3.293a1 1 0 01-1.414-1.414L4.586 6 1.293 2.707a1 1 0 011.414-1.414L6 4.586z' />
              </svg>
            </button>
          </div>
        )}

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
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
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
      }
    >
      <LoginForm />
    </Suspense>
  );
}
