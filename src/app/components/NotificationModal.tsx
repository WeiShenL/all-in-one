'use client';

import React, { useEffect } from 'react';
import { trpc } from '@/app/lib/trpc';
import { useAuth } from '@/lib/supabase/auth-context';
import { useNotifications } from '@/lib/context/NotificationContext';
import { useUnreadNotificationCount } from '@/lib/hooks/useUnreadNotificationCount';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const { lastNotificationTime } = useNotifications();
  const { resetCount } = useUnreadNotificationCount();
  const {
    data: notifications,
    isLoading,
    error,
    refetch,
  } = trpc.notification.getNotifications.useQuery(
    { userId: user?.id || '' },
    {
      enabled: !!user?.id && isOpen,
      refetchInterval: isOpen ? 10000 : false, // Only refetch when modal is open
      refetchOnWindowFocus: true,
    }
  );

  const markAsReadMutation = trpc.notification.markAsRead.useMutation({
    onSuccess: data => {
      // Reset the unread count in the badge (no DB query needed)
      if (data.count > 0) {
        resetCount();
      }
      // Refetch the notification list to update UI
      refetch();
    },
  });

  // Mark all unread notifications as read after modal has been open for 1 second
  // This gives users time to click away without marking as read
  useEffect(() => {
    if (isOpen && notifications && notifications.length > 0 && !isLoading) {
      const timer = setTimeout(() => {
        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);

        if (unreadIds.length > 0) {
          markAsReadMutation.mutate({ notificationIds: unreadIds });
        }
      }, 1000); // Wait 1 second before marking as read

      return () => clearTimeout(timer); // Cancel if modal closes early
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, notifications, isLoading]);

  // Refetch when new real-time notification arrives
  useEffect(() => {
    if (lastNotificationTime > 0 && isOpen) {
      refetch();
    }
  }, [lastNotificationTime, refetch, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 2000,
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'hidden',
          zIndex: 2100,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#1a202c',
            }}
          >
            Notifications
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#718096',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
            onMouseEnter={e =>
              (e.currentTarget.style.backgroundColor = '#f7fafc')
            }
            onMouseLeave={e =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
            aria-label='Close modal'
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
          }}
        >
          {isLoading && (
            <p style={{ color: '#718096' }}>Loading notifications...</p>
          )}

          {error && (
            <p style={{ color: '#e53e3e' }}>
              Error loading notifications: {error.message}
            </p>
          )}

          {!isLoading && !error && notifications && notifications.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {notifications.map((notification, index) => (
                <li
                  key={notification.id}
                  style={{
                    marginBottom: '1rem',
                    paddingBottom: '1rem',
                    borderBottom:
                      index < notifications.length - 1
                        ? '1px solid #e2e8f0'
                        : 'none',
                  }}
                >
                  <h3
                    style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#2d3748',
                    }}
                  >
                    {notification.title}
                  </h3>
                  <p
                    style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.875rem',
                      color: '#4a5568',
                      lineHeight: '1.5',
                    }}
                  >
                    {notification.message}
                  </p>
                  <small style={{ fontSize: '0.75rem', color: '#a0aec0' }}>
                    {new Date(notification.createdAt).toLocaleString()}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            !isLoading &&
            !error && (
              <p style={{ color: '#718096', textAlign: 'center' }}>
                No notifications to display.
              </p>
            )
          )}
        </div>
      </div>
    </>
  );
};
