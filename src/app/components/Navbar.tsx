'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import { useSecureLogout } from '@/lib/hooks/useSecureLogout';
import { useUnreadNotificationCount } from '@/lib/hooks/useUnreadNotificationCount';
import { useNotifications } from '@/lib/context/NotificationContext';
import { NotificationModal } from './NotificationModal';
import { UserDetailsModal } from './UserDetailsModal';
import { ProjectSelection } from './ProjectSelection';
import { Bell, Home, Users, Building2, Shield, User } from 'lucide-react';

export default function Navbar() {
  const { user, userProfile } = useAuth();
  const { handleSecureLogout, isLoggingOut } = useSecureLogout();
  const { count: unreadCount } = useUnreadNotificationCount();
  const { dismissAll } = useNotifications();
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Get dashboard route - all users go to personal dashboard by default
  const getDashboardRoute = () => {
    // All users (including HR/Admin) use personal dashboard
    return '/dashboard/personal';
  };

  // Helper function to determine if a link is active
  const isActive = (href: string) => {
    if (href === '/dashboard/personal') {
      return pathname === '/dashboard/personal' || pathname === '/dashboard';
    }
    return pathname === href;
  };

  // Helper function to get link styles based on active state
  const getLinkStyles = (href: string) => {
    const isLinkActive = isActive(href);
    return {
      color: isLinkActive ? '#1976d2' : '#495057',
      backgroundColor: isLinkActive ? '#e3f2fd' : 'transparent',
      textDecoration: 'none',
      fontWeight: isLinkActive ? '600' : '500',
      fontSize: '1rem',
      padding: '0.75rem 1rem',
      borderRadius: '6px',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      borderLeft: isLinkActive ? '3px solid #1976d2' : '3px solid transparent',
    };
  };

  // Helper function to get mobile link styles based on active state
  const getMobileLinkStyles = (href: string) => {
    const isLinkActive = isActive(href);
    return {
      color: isLinkActive ? '#1976d2' : '#495057',
      textDecoration: 'none',
      fontWeight: isLinkActive ? '600' : '500',
      padding: '0.75rem',
      borderRadius: '4px',
      backgroundColor: isLinkActive ? '#e3f2fd' : '#fff',
      border: isLinkActive ? '1px solid #1976d2' : '1px solid #dee2e6',
      transition: 'all 0.2s ease',
    };
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
        {/* App Title and Notifications */}
        <div
          style={{
            padding: '0 1.5rem 0.5rem 1.5rem',
            borderBottom: '1px solid #dee2e6',
            marginBottom: '0.25rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
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

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {/* Profile Button */}
              <button
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  color: '#495057',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => setIsUserModalOpen(true)}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#e3f2fd';
                  e.currentTarget.style.color = '#1976d2';
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.boxShadow =
                    '0 2px 8px rgba(25, 118, 210, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#495057';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <User size={20} />
              </button>

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
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => {
                  setIsNotificationModalOpen(true);
                  dismissAll();
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#e3f2fd';
                  e.currentTarget.style.color = '#1976d2';
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.boxShadow =
                    '0 2px 8px rgba(25, 118, 210, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#495057';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '0.25rem',
                      right: '0.25rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      borderRadius: '50%',
                      width: '1.25rem',
                      height: '1.25rem',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            padding: '0.25rem 1rem 1rem 1rem',
          }}
        >
          <Link
            href={getDashboardRoute()}
            style={getLinkStyles(getDashboardRoute())}
            onMouseEnter={e => {
              if (!isActive(getDashboardRoute())) {
                e.currentTarget.style.backgroundColor = '#e3f2fd';
                e.currentTarget.style.color = '#1976d2';
                e.currentTarget.style.transform = 'translateX(4px)';
                e.currentTarget.style.boxShadow =
                  '0 2px 8px rgba(25, 118, 210, 0.15)';
              }
            }}
            onMouseLeave={e => {
              if (!isActive(getDashboardRoute())) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#495057';
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <span
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Home size={18} />
              <span>Personal</span>
            </span>
          </Link>

          <Link
            href='/dashboard/department'
            style={getLinkStyles('/dashboard/department')}
            onMouseEnter={e => {
              if (!isActive('/dashboard/department')) {
                e.currentTarget.style.backgroundColor = '#e3f2fd';
                e.currentTarget.style.color = '#1976d2';
                e.currentTarget.style.transform = 'translateX(4px)';
                e.currentTarget.style.boxShadow =
                  '0 2px 8px rgba(25, 118, 210, 0.15)';
              }
            }}
            onMouseLeave={e => {
              if (!isActive('/dashboard/department')) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#495057';
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <span
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Users size={18} />
              <span>Department</span>
            </span>
          </Link>

          {/* Company link - visible only to HR/Admin users */}
          {userProfile &&
            (userProfile.isHrAdmin || userProfile.role === 'HR_ADMIN') && (
              <Link
                href='/dashboard/company'
                style={getLinkStyles('/dashboard/company')}
                onMouseEnter={e => {
                  if (!isActive('/dashboard/company')) {
                    e.currentTarget.style.backgroundColor = '#e3f2fd';
                    e.currentTarget.style.color = '#1976d2';
                    e.currentTarget.style.transform = 'translateX(4px)';
                    e.currentTarget.style.boxShadow =
                      '0 2px 8px rgba(25, 118, 210, 0.15)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive('/dashboard/company')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#495057';
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Building2 size={18} />
                  <span>Company</span>
                </span>
              </Link>
            )}

          {/* Admin Dashboard link - visible only to HR/Admin users */}
          {userProfile &&
            (userProfile.isHrAdmin || userProfile.role === 'HR_ADMIN') && (
              <Link
                href='/dashboard/hr'
                style={getLinkStyles('/dashboard/hr')}
                onMouseEnter={e => {
                  if (!isActive('/dashboard/hr')) {
                    e.currentTarget.style.backgroundColor = '#e3f2fd';
                    e.currentTarget.style.color = '#1976d2';
                    e.currentTarget.style.transform = 'translateX(4px)';
                    e.currentTarget.style.boxShadow =
                      '0 2px 8px rgba(25, 118, 210, 0.15)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive('/dashboard/hr')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#495057';
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Shield size={18} />
                  <span>Admin</span>
                </span>
              </Link>
            )}
        </nav>

        {/* Project Selection */}
        <ProjectSelection />

        {/* Bottom Section - Sign Out Button */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid #dee2e6',
            marginTop: 'auto',
          }}
        >
          {/* Sign Out Button */}
          <button
            onClick={handleSecureLogout}
            disabled={isLoggingOut}
            data-testid='sign-out-button'
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
            onMouseEnter={e => {
              if (!isLoggingOut) {
                e.currentTarget.style.backgroundColor = '#c82333';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow =
                  '0 4px 12px rgba(220, 53, 69, 0.3)';
              }
            }}
            onMouseLeave={e => {
              if (!isLoggingOut) {
                e.currentTarget.style.backgroundColor = '#dc3545';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
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

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {/* Mobile Profile Button */}
              <button
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  color: '#495057',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => setIsUserModalOpen(true)}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#e3f2fd';
                  e.currentTarget.style.color = '#1976d2';
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.boxShadow =
                    '0 2px 8px rgba(25, 118, 210, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#495057';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <User size={20} />
              </button>

              {/* Mobile Notification Button */}
              <button
                style={{
                  position: 'relative',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  color: '#495057',
                  fontSize: '1.25rem',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => {
                  setIsNotificationModalOpen(true);
                  dismissAll();
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#e3f2fd';
                  e.currentTarget.style.color = '#1976d2';
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.boxShadow =
                    '0 2px 8px rgba(25, 118, 210, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#495057';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '0.25rem',
                      right: '0.25rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      borderRadius: '50%',
                      width: '1.25rem',
                      height: '1.25rem',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

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
              style={getMobileLinkStyles(getDashboardRoute())}
            >
              <span
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Home size={18} />
                <span>Personal</span>
              </span>
            </Link>
            <Link
              href='/dashboard/department'
              style={getMobileLinkStyles('/dashboard/department')}
            >
              <span
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Users size={18} />
                <span>Department</span>
              </span>
            </Link>
            {userProfile &&
              (userProfile.isHrAdmin || userProfile.role === 'HR_ADMIN') && (
                <>
                  <Link
                    href='/dashboard/company'
                    style={getMobileLinkStyles('/dashboard/company')}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Building2 size={18} />
                      <span>Company</span>
                    </span>
                  </Link>
                  <Link
                    href='/dashboard/hr'
                    style={getMobileLinkStyles('/dashboard/hr')}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Shield size={18} />
                      <span>Admin</span>
                    </span>
                  </Link>
                </>
              )}
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
              onClick={() => setIsUserModalOpen(true)}
              role='button'
              aria-label='Open user details'
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

      {/* User Details Modal */}
      <UserDetailsModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />

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
