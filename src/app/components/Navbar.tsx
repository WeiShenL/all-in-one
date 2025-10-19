'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { useSecureLogout } from '@/lib/hooks/useSecureLogout';
import { useUnreadNotificationCount } from '@/lib/hooks/useUnreadNotificationCount';
import { useNotifications } from '@/lib/context/NotificationContext';
import { NotificationModal } from './NotificationModal';

export default function Navbar() {
  const { user, userProfile } = useAuth();
  const { handleSecureLogout, isLoggingOut } = useSecureLogout();
  const { count: unreadCount } = useUnreadNotificationCount();
  const { dismissAll } = useNotifications();
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

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
          {/* Notification Button */}
          <button
            style={{
              position: 'relative',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: '#495057',
              fontSize: '1.25rem',
            }}
            onClick={() => {
              setIsNotificationModalOpen(true);
              dismissAll(); // Dismiss all toast notifications
            }}
          >
            🔔
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  borderRadius: '50%',
                  padding: '0.2em 0.5em',
                  fontSize: '0.75rem',
                  lineHeight: '1',
                  transform: 'translate(50%, -50%)',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

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

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
      />
    </nav>
  );
}
