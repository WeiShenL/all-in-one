'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';

export default function AuthNavbar() {
  const { user, userProfile, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      // Call Supabase signOut - this invalidates session token automatically
      const { error } = await signOut();

      if (error) {
        console.error('Logout error:', error);
        // Still redirect even if there's an error to be safe
      }

      // Redirect to login page
      router.push('/auth/login');
    } catch (error) {
      console.error('Unexpected logout error:', error);
      // Still redirect to login page for security
      router.push('/auth/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <nav
      style={{
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        padding: '1rem 2rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Left side - App name */}
        <div
          style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#007bff',
          }}
        >
          Task Manager
        </div>

        {/* Center - Navigation links */}
        <div
          style={{
            display: 'flex',
            gap: '2rem',
          }}
        >
          <a
            href='/dashboard'
            style={{
              color: '#495057',
              textDecoration: 'none',
              fontWeight: '500',
            }}
          >
            Dashboard
          </a>
          <a
            href='/profile'
            style={{
              color: '#495057',
              textDecoration: 'none',
              fontWeight: '500',
            }}
          >
            Profile
          </a>
        </div>

        {/* Right side - User info and logout */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <span
            style={{
              color: '#6c757d',
              fontSize: '0.875rem',
            }}
          >
            {userProfile?.name || user?.email}
          </span>
          <button
            onClick={handleSignOut}
            disabled={isLoggingOut}
            style={{
              backgroundColor: isLoggingOut ? '#6c757d' : '#dc3545',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: isLoggingOut ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              opacity: isLoggingOut ? 0.7 : 1,
            }}
          >
            {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </nav>
  );
}
