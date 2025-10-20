'use client';

import React, { useEffect } from 'react';
import Navbar from '@/app/components/Navbar';
import { trpc } from '@/app/lib/trpc';
import { useAuth } from '@/lib/supabase/auth-context';
import { useUnreadNotificationCount } from '@/lib/hooks/useUnreadNotificationCount';
import { useNotifications } from '@/lib/context/NotificationContext';

export default function NotificationsPage() {
  const { user } = useAuth();
  const { resetCount } = useUnreadNotificationCount();
  const { lastNotificationTime } = useNotifications();
  const {
    data: notifications,
    isLoading,
    error,
    refetch,
  } = trpc.notification.getNotifications.useQuery(
    { userId: user?.id || '' },
    {
      enabled: !!user?.id,
      refetchInterval: 10000, // Refetch every 10 seconds
      refetchOnWindowFocus: true,
    }
  );

  // Reset unread count when user opens this page
  useEffect(() => {
    resetCount();
  }, [resetCount]);

  // Refetch when new real-time notification arrives
  useEffect(() => {
    if (lastNotificationTime > 0) {
      refetch();
    }
  }, [lastNotificationTime, refetch]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc' }}>
        <Navbar />
        <div
          style={{ padding: '2rem', marginLeft: '280px' }}
          className='main-content'
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h1
              style={{
                marginBottom: '2rem',
                color: '#1a202c',
                fontSize: '2rem',
                fontWeight: '700',
              }}
            >
              Your Notifications
            </h1>
            <p>Loading notifications...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc' }}>
        <Navbar />
        <div
          style={{ padding: '2rem', marginLeft: '280px' }}
          className='main-content'
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h1
              style={{
                marginBottom: '2rem',
                color: '#1a202c',
                fontSize: '2rem',
                fontWeight: '700',
              }}
            >
              Your Notifications
            </h1>
            <p>Error loading notifications: {error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc' }}>
      <Navbar />
      <div
        style={{ padding: '2rem', marginLeft: '280px' }}
        className='main-content'
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1
            style={{
              marginBottom: '2rem',
              color: '#1a202c',
              fontSize: '2rem',
              fontWeight: '700',
            }}
          >
            Your Notifications
          </h1>
          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '1.5rem',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
          >
            {notifications && notifications.length > 0 ? (
              <ul>
                {notifications.map(notification => (
                  <li
                    key={notification.id}
                    style={{
                      marginBottom: '1rem',
                      borderBottom: '1px solid #eee',
                      paddingBottom: '1rem',
                    }}
                  >
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                      {notification.title}
                    </h3>
                    <p style={{ margin: '0', color: '#555' }}>
                      {notification.message}
                    </p>
                    <small style={{ color: '#888' }}>
                      {new Date(notification.createdAt).toLocaleString()}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No notifications to display.</p>
            )}
          </div>
        </div>
      </div>

      {/* CSS for responsive behavior */}
      <style jsx>{`
        @media (max-width: 768px) {
          .main-content {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
