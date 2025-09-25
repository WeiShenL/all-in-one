'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { signIn, user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await signIn(formData.email, formData.password);

    if (error) {
      setError('Invalid email or password. Please try again.');
    } else {
      router.push('/dashboard');
    }

    setLoading(false);
  };

  const handleCreateAccount = () => {
    // Redirect to signup page
    window.location.href = '/auth/signup';
  };

  const handlePasswordReset = () => {
    window.location.href = '/auth/reset-password';
  };

  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '2rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>
        Welcome Back
      </h1>

      <form onSubmit={handleLogin}>
        {error && (
          <div
            style={{
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              padding: '0.75rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

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
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
              opacity: loading ? 0.6 : 1,
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
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
              opacity: loading ? 0.6 : 1,
            }}
          />
        </div>

        <button
          type='submit'
          disabled={!formData.email || !formData.password || loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor:
              formData.email && formData.password && !loading
                ? '#007bff'
                : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor:
              formData.email && formData.password && !loading
                ? 'pointer'
                : 'not-allowed',
            marginBottom: '1rem',
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
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
