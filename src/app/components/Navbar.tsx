'use client';

import { useState } from 'react';
import Link from 'next/link';
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
    <>
      {/* Desktop Sidebar */}
      <aside
        className='desktop-sidebar'
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          width: '280px',
          backgroundColor: '#f8f9fa',
          borderRight: '1px solid #dee2e6',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem 0',
        }}
      >
        {/* App Title */}
        <div
          style={{
            padding: '0 1.5rem 2rem 1.5rem',
            borderBottom: '1px solid #dee2e6',
            marginBottom: '1.5rem',
          }}
        >
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#007bff',
              margin: 0,
            }}
          >
            Task Manager
          </h1>
        </div>

        {/* Navigation Links */}
        <nav
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            padding: '0 1rem',
          }}
        >
          <Link
            href={getDashboardRoute()}
            style={{
              color: '#495057',
              textDecoration: 'none',
              fontWeight: '500',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#e9ecef';
              e.currentTarget.style.color = '#007bff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#495057';
            }}
          >
            Personal
          </Link>

          <Link
            href='/dashboard/department'
            style={{
              color: '#495057',
              textDecoration: 'none',
              fontWeight: '500',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#e9ecef';
              e.currentTarget.style.color = '#007bff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#495057';
            }}
          >
            Department
          </Link>

          {/* Company link - visible only to HR/Admin users */}
          {userProfile &&
            (userProfile.isHrAdmin || userProfile.role === 'HR_ADMIN') && (
              <Link
                href='/dashboard/company'
                style={{
                  color: '#495057',
                  textDecoration: 'none',
                  fontWeight: '500',
                  fontSize: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#e9ecef';
                  e.currentTarget.style.color = '#007bff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#495057';
                }}
              >
                Company
              </Link>
            )}

          {/* Admin Dashboard link - visible only to HR/Admin users */}
          {userProfile &&
            (userProfile.isHrAdmin || userProfile.role === 'HR_ADMIN') && (
              <Link
                href='/dashboard/hr'
                style={{
                  color: '#495057',
                  textDecoration: 'none',
                  fontWeight: '500',
                  fontSize: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#e9ecef';
                  e.currentTarget.style.color = '#007bff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#495057';
                }}
              >
                Admin
              </Link>
            )}

          <Link
            href='/projects'
            style={{
              color: '#495057',
              textDecoration: 'none',
              fontWeight: '500',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#e9ecef';
              e.currentTarget.style.color = '#007bff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#495057';
            }}
          >
            Projects
          </Link>
        </nav>

        {/* Bottom Section - User Info and Actions */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid #dee2e6',
            marginTop: 'auto',
          }}
        >
          {/* Notification Button */}
          <button
            style={{
              position: 'relative',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.75rem',
              color: '#495057',
              fontSize: '1.25rem',
              width: '100%',
              borderRadius: '6px',
              marginBottom: '1rem',
              transition: 'all 0.2s ease',
            }}
            onClick={() => {
              setIsNotificationModalOpen(true);
              dismissAll();
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#e9ecef';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            🔔 Notifications
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  borderRadius: '50%',
                  padding: '0.2em 0.5em',
                  fontSize: '0.75rem',
                  lineHeight: '1',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Info */}
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: '#fff',
              borderRadius: '6px',
              border: '1px solid #dee2e6',
            }}
          >
            <div
              style={{
                color: '#6c757d',
                fontSize: '0.875rem',
                marginBottom: '0.25rem',
                fontWeight: '500',
              }}
            >
              {userProfile?.role?.toLowerCase() || 'staff'}
            </div>
            <div
              style={{
                color: '#495057',
                fontSize: '0.875rem',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {userProfile?.name || user?.email}
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleSecureLogout}
            disabled={isLoggingOut}
            style={{
              backgroundColor: isLoggingOut ? '#6c757d' : '#dc3545',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              cursor: isLoggingOut ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              opacity: isLoggingOut ? 0.7 : 1,
              width: '100%',
              transition: 'all 0.2s ease',
            }}
          >
            {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <nav
        className='mobile-header'
        style={{
          display: 'none',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #dee2e6',
          padding: '1rem',
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
          }}
        >
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: '#007bff',
              margin: 0,
            }}
          >
            Task Manager
          </h1>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
            }}
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
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: '#f8f9fa',
              borderTop: '1px solid #dee2e6',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <Link
              href={getDashboardRoute()}
              style={{
                color: '#495057',
                textDecoration: 'none',
                fontWeight: '500',
                padding: '0.75rem',
                borderRadius: '4px',
                backgroundColor: '#fff',
                border: '1px solid #dee2e6',
              }}
            >
              Personal
            </Link>
            <Link
              href='/dashboard/department'
              style={{
                color: '#495057',
                textDecoration: 'none',
                fontWeight: '500',
                padding: '0.75rem',
                borderRadius: '4px',
                backgroundColor: '#fff',
                border: '1px solid #dee2e6',
              }}
            >
              Department
            </Link>
            {userProfile &&
              (userProfile.isHrAdmin || userProfile.role === 'HR_ADMIN') && (
                <>
                  <Link
                    href='/dashboard/company'
                    style={{
                      color: '#495057',
                      textDecoration: 'none',
                      fontWeight: '500',
                      padding: '0.75rem',
                      borderRadius: '4px',
                      backgroundColor: '#fff',
                      border: '1px solid #dee2e6',
                    }}
                  >
                    Company
                  </Link>
                  <Link
                    href='/dashboard/hr'
                    style={{
                      color: '#495057',
                      textDecoration: 'none',
                      fontWeight: '500',
                      padding: '0.75rem',
                      borderRadius: '4px',
                      backgroundColor: '#fff',
                      border: '1px solid #dee2e6',
                    }}
                  >
                    Admin
                  </Link>
                </>
              )}
            <Link
              href='/projects'
              style={{
                color: '#495057',
                textDecoration: 'none',
                fontWeight: '500',
                padding: '0.75rem',
                borderRadius: '4px',
                backgroundColor: '#fff',
                border: '1px solid #dee2e6',
              }}
            >
              Projects
            </Link>

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
                setIsMobileMenuOpen(false);
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
                border: '1px solid #dee2e6',
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
      </nav>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
      />

      {/* CSS for responsive behavior */}
      <style jsx>{`
        @media (max-width: 768px) {
          .desktop-sidebar {
            display: none !important;
          }
          .mobile-header {
            display: block !important;
          }
        }
        @media (min-width: 769px) {
          .desktop-sidebar {
            display: flex !important;
          }
          .mobile-header {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
