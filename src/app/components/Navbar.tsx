'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { useSecureLogout } from '@/lib/hooks/useSecureLogout';

export default function Navbar() {
  const { user, userProfile } = useAuth();
  const { handleSecureLogout, isLoggingOut } = useSecureLogout();

  // Get dashboard route - all users go to personal dashboard by default
  const getDashboardRoute = () => {
    // All users (including HR/Admin) use personal dashboard
    return '/dashboard/personal';
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
            href={getDashboardRoute()}
            style={{
              color: '#495057',
              textDecoration: 'none',
              fontWeight: '500',
            }}
          >
            Personal
          </a>
          {/* Department Dashboard link - visible to all authenticated users */}
          <a
            href='/dashboard/department'
            style={{
              color: '#495057',
              textDecoration: 'none',
              fontWeight: '500',
            }}
          >
            Department
          </a>
          {/* Company link - visible only to HR/Admin users */}
          {userProfile &&
            (userProfile.isHrAdmin || userProfile.role === 'HR_ADMIN') && (
              <a
                href='/dashboard/company'
                style={{
                  color: '#495057',
                  textDecoration: 'none',
                  fontWeight: '500',
                }}
              >
                Company
              </a>
            )}
          {/* Admin Dashboard link - visible only to HR/Admin users */}
          {userProfile &&
            (userProfile.isHrAdmin || userProfile.role === 'HR_ADMIN') && (
              <a
                href='/dashboard/hr'
                style={{
                  color: '#495057',
                  textDecoration: 'none',
                  fontWeight: '500',
                }}
              >
                Admin
              </a>
            )}
          <a
            href='/projects'
            style={{
              color: '#495057',
              textDecoration: 'none',
              fontWeight: '500',
            }}
          >
            Projects
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
            onClick={handleSecureLogout}
            disabled={isLoggingOut}
            data-testid='sign-out-button'
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
