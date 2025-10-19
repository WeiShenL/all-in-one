'use client';

import React, { useState, useEffect } from 'react';
import { useNotifications } from '@/lib/context/NotificationContext';
import { Toast } from './Toast';

export const ToastContainer: React.FC = () => {
  const { notifications, dismissNotification, isConnected } =
    useNotifications();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    // Set initial scroll position
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate dynamic top position
  // Original position: calc(1rem + 56px + 0.75rem) ≈ 72.75px
  // Sticky position: 1rem = 16px
  // Transition starts at 0px scroll, fully transitioned at 100px scroll
  const originalTop = 72.75; // in pixels
  const stickyTop = 16; // 1rem in pixels
  const transitionDistance = 100; // pixels of scroll to complete transition

  const getTopPosition = () => {
    if (scrollY === 0) {
      return `${originalTop}px`;
    }
    if (scrollY >= transitionDistance) {
      return `${stickyTop}px`;
    }
    // Linear interpolation between original and sticky position
    const progress = scrollY / transitionDistance;
    const currentTop = originalTop - (originalTop - stickyTop) * progress;
    return `${currentTop}px`;
  };

  return (
    <>
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

      <div
        className='flex flex-col gap-2'
        style={{
          position: 'fixed',
          top: getTopPosition(),
          right: 'clamp(1rem, 3vw, 2rem)',
          maxWidth: 'min(90vw, 320px)',
          width: '100%',
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
            width: '100%',
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
