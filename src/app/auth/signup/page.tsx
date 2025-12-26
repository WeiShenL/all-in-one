'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PasswordInput } from '../components/PasswordInput';
import { EmailInput } from '../components/EmailInput';
import { DepartmentSelect } from '../components/DepartmentSelect';
import { validatePassword } from '../../lib/passwordValidation';
import { validateEmail } from '../../lib/emailValidation';
import { useAuth } from '@/lib/supabase/auth-context';
import { trpc } from '@/app/lib/trpc';

export default function SignupPage() {
  const router = useRouter();
  const { signUp, signIn, user, userProfile, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: 'STAFF' as 'STAFF' | 'MANAGER',
    isHrAdmin: false,
    departmentId: '',
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const passwordValidation = validatePassword(formData.password);
  const emailValidation = validateEmail(formData.email);

  // Load departments using tRPC
  const utils = trpc.useUtils();
  useEffect(() => {
    utils.department.getAll.prefetch().catch(() => {});
  }, [utils]);
  const { data: departments = [] } = trpc.department.getAll.useQuery(
    undefined,
    {
      staleTime: 5 * 60 * 1000,
    }
  );

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && userProfile) {
      // All users (STAFF, MANAGER, HR/Admin) go to personal dashboard
      router.push('/dashboard/personal');
    }
  }, [user, userProfile, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.warn('🔍 Starting sign up...');
    setError('');

    if (!emailValidation.isValid) {
      setError('Please enter a valid email address');
      return;
    }

    if (!passwordValidation.isValid) {
      setError('Please fix password validation errors before submitting');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!formData.departmentId) {
      setError('Please select a department');
      return;
    }

    if (!formData.name || formData.name.trim() === '') {
      setError('Name is required');
      return;
    }

    setLoading(true);
    console.warn('🔍 About to call signUp function');

    try {
      console.warn('🔍 Calling signUp with:', {
        email: formData.email,
        role: formData.role,
        isHrAdmin: formData.isHrAdmin,
      });
      const { error: signUpError } = await signUp(
        formData.email,
        formData.password,
        {
          name: formData.name,
          role: formData.role,
          isHrAdmin: formData.isHrAdmin,
          departmentId: formData.departmentId,
        }
      );
      console.warn('🔍 SignUp response:', { error: signUpError });
      if (signUpError) {
        setError(
          typeof signUpError === 'string'
            ? signUpError
            : (signUpError as Error).message || 'Failed to create account'
        );
        setLoading(false);
        return;
      }
      console.warn('🔍 SignUp successful, now signing in...');

      // With auto-confirm enabled, signUp doesn't always create a session
      // So we need to explicitly sign in after successful signup
      const { error: signInError } = await signIn(
        formData.email,
        formData.password
      );

      if (signInError) {
        console.error('🔍 SignIn after signup failed:', signInError);
        setError(
          'Account created but login failed. Please try logging in manually.'
        );
        setLoading(false);
        return;
      }

      console.warn('🔍 SignIn successful, auth context will handle redirect');
      // Success - auth context will handle redirect
    } catch (err) {
      console.error('🔍 SignUp error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
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
          Create Account
        </h1>
        <p
          style={{
            textAlign: 'center',
            marginBottom: '2rem',
            color: '#718096',
            fontSize: '0.875rem',
          }}
        >
          Sign up to get started
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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor='name'
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#2d3748',
                fontSize: '0.875rem',
              }}
            >
              Name <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <input
              id='name'
              type='text'
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder='Enter your name'
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

          <EmailInput
            value={formData.email}
            onChange={value => {
              setFormData({ ...formData, email: value });
              setError('');
            }}
            label='Email'
            placeholder='Enter your email'
            required
          />

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor='role'
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#2d3748',
                fontSize: '0.875rem',
              }}
            >
              Role
            </label>
            <div style={{ position: 'relative' }}>
              <select
                id='role'
                value={formData.role}
                onChange={e =>
                  setFormData({
                    ...formData,
                    role: e.target.value as 'STAFF' | 'MANAGER',
                  })
                }
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '2.5rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  cursor: 'pointer',
                }}
                onFocus={e => (e.target.style.borderColor = '#3182ce')}
                onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
              >
                <option value='STAFF'>Staff</option>
                <option value='MANAGER'>Manager</option>
              </select>
              <span
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '0.75rem',
                  color: '#718096',
                  pointerEvents: 'none',
                }}
              >
                ▼
              </span>
            </div>
          </div>

          {/* HR/Admin checkbox commented out to prevent email address exposure */}
          {/* <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: formData.isHrAdmin ? '#ebf8ff' : '#ffffff',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                if (!formData.isHrAdmin) {
                  e.currentTarget.style.backgroundColor = '#f7fafc';
                }
              }}
              onMouseLeave={e => {
                if (!formData.isHrAdmin) {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }
              }}
            >
              <input
                id='isHrAdmin'
                type='checkbox'
                checked={formData.isHrAdmin}
                onChange={e =>
                  setFormData({ ...formData, isHrAdmin: e.target.checked })
                }
                style={{
                  width: '1.25rem',
                  height: '1.25rem',
                  marginRight: '0.75rem',
                  cursor: 'pointer',
                  accentColor: '#3182ce',
                }}
              />
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    fontWeight: '600',
                    color: '#2d3748',
                    fontSize: '0.875rem',
                  }}
                >
                  HR/Admin
                </span>
                <p
                  style={{
                    margin: '0.25rem 0 0 0',
                    fontSize: '0.75rem',
                    color: '#718096',
                  }}
                >
                  Check this if the user has HR or Admin responsibilities
                </p>
              </div>
            </label>
          </div> */}

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor='department'
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#2d3748',
                fontSize: '0.875rem',
              }}
            >
              Department
            </label>
            <DepartmentSelect
              departments={departments}
              value={formData.departmentId}
              onChange={value =>
                setFormData({ ...formData, departmentId: value })
              }
              required
            />
          </div>

          <PasswordInput
            value={formData.password}
            onChange={value => {
              setFormData({ ...formData, password: value });
              setError('');
            }}
            label='Password'
            placeholder='Create a password'
          />

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor='confirmPassword'
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#2d3748',
                fontSize: '0.875rem',
              }}
            >
              Confirm Password
            </label>
            <input
              id='confirmPassword'
              type='password'
              value={formData.confirmPassword}
              onChange={e =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              placeholder='Confirm your password'
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `1px solid ${
                  formData.confirmPassword &&
                  formData.password === formData.confirmPassword
                    ? '#48bb78'
                    : formData.confirmPassword &&
                        formData.password !== formData.confirmPassword
                      ? '#fc8181'
                      : '#e2e8f0'
                }`,
                borderRadius: '8px',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => {
                if (
                  !formData.confirmPassword ||
                  formData.password === formData.confirmPassword
                ) {
                  e.target.style.borderColor = '#3182ce';
                }
              }}
              onBlur={e => {
                if (
                  formData.confirmPassword &&
                  formData.password === formData.confirmPassword
                ) {
                  e.target.style.borderColor = '#48bb78';
                } else if (formData.confirmPassword) {
                  e.target.style.borderColor = '#fc8181';
                } else {
                  e.target.style.borderColor = '#e2e8f0';
                }
              }}
            />
            {formData.confirmPassword &&
              formData.password !== formData.confirmPassword && (
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: '#c53030',
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
              formData.password !== formData.confirmPassword ||
              !formData.departmentId ||
              !formData.name ||
              formData.name.trim() === '' ||
              loading
            }
            style={{
              width: '100%',
              padding: '0.875rem',
              backgroundColor:
                emailValidation.isValid &&
                passwordValidation.isValid &&
                formData.password === formData.confirmPassword &&
                formData.departmentId &&
                formData.name &&
                formData.name.trim() !== '' &&
                !loading
                  ? '#48bb78'
                  : '#cbd5e0',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor:
                emailValidation.isValid &&
                passwordValidation.isValid &&
                formData.password === formData.confirmPassword &&
                formData.departmentId &&
                formData.name &&
                formData.name.trim() !== '' &&
                !loading
                  ? 'pointer'
                  : 'not-allowed',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={e => {
              if (
                emailValidation.isValid &&
                passwordValidation.isValid &&
                formData.password === formData.confirmPassword &&
                formData.departmentId &&
                formData.name &&
                formData.name.trim() !== '' &&
                !loading
              ) {
                e.currentTarget.style.backgroundColor = '#38a169';
              }
            }}
            onMouseLeave={e => {
              if (
                emailValidation.isValid &&
                passwordValidation.isValid &&
                formData.password === formData.confirmPassword &&
                formData.departmentId &&
                formData.name &&
                formData.name.trim() !== '' &&
                !loading
              ) {
                e.currentTarget.style.backgroundColor = '#48bb78';
              }
            }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div
          style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            color: '#718096',
            fontSize: '0.875rem',
          }}
        >
          Already have an account?{' '}
          <Link
            href='/auth/login'
            style={{
              color: '#3182ce',
              textDecoration: 'none',
              fontWeight: '600',
            }}
          >
            Sign In
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
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
