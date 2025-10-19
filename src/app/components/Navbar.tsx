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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        padding: 'clamp(0.75rem, 2vw, 1rem) clamp(1rem, 3vw, 2rem)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: 'min(100%, 1600px)',
          margin: '0 auto',
        }}
      >
        {/* Left side - App name */}
        <div
          style={{
            fontSize: 'clamp(1rem, 3vw, 1.25rem)',
            fontWeight: 'bold',
            color: '#007bff',
          }}
        >
          Task Manager
        </div>

        {/* Hamburger menu button for mobile */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={{
            display: 'none',
            flexDirection: 'column',
            gap: '4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
          }}
          className='mobile-menu-toggle'
        >
          <span
            style={{
              width: '24px',
              height: '3px',
              backgroundColor: '#495057',
              borderRadius: '2px',
            }}
          ></span>
          <span
            style={{
              width: '24px',
              height: '3px',
              backgroundColor: '#495057',
              borderRadius: '2px',
            }}
          ></span>
          <span
            style={{
              width: '24px',
              height: '3px',
              backgroundColor: '#495057',
              borderRadius: '2px',
            }}
          ></span>
        </button>

        {/* Desktop Navigation */}
        <div
          className='desktop-nav'
          style={{
            display: 'flex',
            gap: 'clamp(1rem, 2vw, 2rem)',
            alignItems: 'center',
          }}
        >
          {/* Center - Navigation links */}
          <div
            style={{
              display: 'flex',
              gap: 'clamp(1rem, 2vw, 2rem)',
            }}
          >
            <a
              href={getDashboardRoute()}
              style={{
                color: '#495057',
                textDecoration: 'none',
                fontWeight: '500',
                fontSize: 'clamp(0.875rem, 2vw, 1rem)',
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
                fontSize: 'clamp(0.875rem, 2vw, 1rem)',
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
                    fontSize: 'clamp(0.875rem, 2vw, 1rem)',
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
                    fontSize: 'clamp(0.875rem, 2vw, 1rem)',
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
                fontSize: 'clamp(0.875rem, 2vw, 1rem)',
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
                fontSize: 'clamp(0.875rem, 2vw, 1rem)',
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
                fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '150px',
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
                padding: 'clamp(0.4rem, 1vw, 0.5rem) clamp(0.75rem, 2vw, 1rem)',
                borderRadius: '4px',
                cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                fontWeight: '500',
                opacity: isLoggingOut ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div
            className='mobile-nav'
            style={{
              display: 'none',
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: '#f8f9fa',
              borderTop: '1px solid #dee2e6',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              padding: '1rem',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <a
              href={getDashboardRoute()}
              style={{
                color: '#495057',
                textDecoration: 'none',
                fontWeight: '500',
                padding: '0.75rem',
                borderRadius: '4px',
                backgroundColor: '#fff',
              }}
            >
              Personal
            </a>
            <a
              href='/dashboard/department'
              style={{
                color: '#495057',
                textDecoration: 'none',
                fontWeight: '500',
                padding: '0.75rem',
                borderRadius: '4px',
                backgroundColor: '#fff',
              }}
            >
              Department
            </a>
            {userProfile &&
              (userProfile.isHrAdmin || userProfile.role === 'HR_ADMIN') && (
                <>
                  <a
                    href='/dashboard/company'
                    style={{
                      color: '#495057',
                      textDecoration: 'none',
                      fontWeight: '500',
                      padding: '0.75rem',
                      borderRadius: '4px',
                      backgroundColor: '#fff',
                    }}
                  >
                    Company
                  </a>
                  <a
                    href='/dashboard/hr'
                    style={{
                      color: '#495057',
                      textDecoration: 'none',
                      fontWeight: '500',
                      padding: '0.75rem',
                      borderRadius: '4px',
                      backgroundColor: '#fff',
                    }}
                  >
                    Admin
                  </a>
                </>
              )}
            <a
              href='/projects'
              style={{
                color: '#495057',
                textDecoration: 'none',
                fontWeight: '500',
                padding: '0.75rem',
                borderRadius: '4px',
                backgroundColor: '#fff',
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
                padding: '0.75rem',
                borderRadius: '4px',
                backgroundColor: '#fff',
              }}
            >
              Profile
            </a>

            {/* Notification Button in Mobile Menu */}
            <button
              style={{
                position: 'relative',
                backgroundColor: '#fff',
                border: '1px solid #dee2e6',
                cursor: 'pointer',
                padding: '0.75rem',
                borderRadius: '4px',
                color: '#495057',
                fontSize: '1rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
              onClick={() => {
                setIsNotificationModalOpen(true);
                dismissAll();
                setIsMobileMenuOpen(false); // Close mobile menu
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>🔔</span>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#dc3545',
                    color: 'white',
                    borderRadius: '50%',
                    padding: '0.2em 0.6em',
                    fontSize: '0.75rem',
                    lineHeight: '1',
                    marginLeft: 'auto',
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '0.75rem',
                backgroundColor: '#fff',
                borderRadius: '4px',
              }}
            >
              <span style={{ color: '#6c757d', fontSize: '0.875rem' }}>
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
        )}
      </div>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
      />

      {/* CSS for responsive behavior */}
      <style jsx>{`
        @media (max-width: 768px) {
          .mobile-menu-toggle {
            display: flex !important;
          }
          .desktop-nav {
            display: none !important;
          }
          .mobile-nav {
            display: flex !important;
          }
        }
      `}</style>
    </nav>
  );
}
