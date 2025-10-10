'use client';

import React from 'react';
import { useNotifications } from '@/lib/context/NotificationContext';
import { Toast } from './Toast';

export const ToastContainer: React.FC = () => {
  const { notifications, dismissNotification, isConnected } =
    useNotifications();

  return (
    <>
      {/* Connection status indicator (optional - remove if not needed) */}
      {process.env.NODE_ENV === 'development' && (
        <div className='fixed top-4 left-4 z-[9999]'>
          <div
            className={`
              px-3 py-1 rounded-full text-xs font-medium
              ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
            `}
          >
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div
        className='flex flex-col gap-2'
        style={{
          position: 'fixed',
          top: 'calc(1rem + 56px + 0.75rem)',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '1200px',
          width: '100%',
          paddingLeft: '2rem',
          paddingRight: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
        aria-live='polite'
        aria-atomic='true'
      >
        <div
          style={{
            maxWidth: '320px',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {notifications.map(notification => (
            <Toast
              key={notification.id}
              notification={notification}
              onClose={dismissNotification}
            />
          ))}
        </div>
      </div>
    </>
  );
};
