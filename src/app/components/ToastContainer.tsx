'use client';

import React from 'react';
import { useNotifications } from '@/lib/context/NotificationContext';
import { Toast } from './Toast';

export const ToastContainer: React.FC = () => {
  const { notifications, removeNotification, isConnected } = useNotifications();

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
        className='fixed top-4 right-4 z-50 flex flex-col items-end'
        aria-live='polite'
        aria-atomic='true'
      >
        {notifications.map(notification => (
          <Toast
            key={notification.id}
            notification={notification}
            onClose={removeNotification}
          />
        ))}
      </div>
    </>
  );
};
