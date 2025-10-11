'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { useSecureLogout } from '@/lib/hooks/useSecureLogout';

export default function Navbar() {
  const { user, userProfile } = useAuth();
  const { handleSecureLogout, isLoggingOut } = useSecureLogout();

  // Get dashboard route based on user role
  // Managers are staff, so they go to staff dashboard by default
  const getDashboardRoute = () => {
    if (!userProfile?.role) {
      return '/dashboard';
    }

    const roleRoutes = {
      STAFF: '/dashboard/staff',
      MANAGER: '/dashboard/staff', // Managers use staff dashboard as their main dashboard
      HR_ADMIN: '/dashboard/hr',
    };

    return roleRoutes[userProfile.role] || '/dashboard';
  };

  // Check if user is a manager (for showing manager dashboard link)
  const isManager = userProfile?.role === 'MANAGER';

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
            Tasks
          </a>
          {/* Manager Dashboard link - only visible to managers */}
          {isManager && (
            <a
              href='/dashboard/manager'
              style={{
                color: '#495057',
                textDecoration: 'none',
                fontWeight: '500',
              }}
            >
              Manage
            </a>
          )}
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
