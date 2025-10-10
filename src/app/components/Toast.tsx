'use client';

import React, { useEffect, useState } from 'react';
import type { Notification } from '@/types/notification';

interface ToastProps {
  notification: Notification;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);

    // Pre-animate exit before removal
    const exitDelay = 59000; // Start exit animation 1 second before removal (at 59s)
    const exitTimer = setTimeout(() => {
      onClose(notification.id);
    }, exitDelay);

    return () => clearTimeout(exitTimer);
  }, [notification.id, onClose]);

  const handleClose = () => {
    onClose(notification.id);
  };

  const isLeaving = notification.isDismissing || false;

  const getStyles = () => {
    switch (notification.type) {
      case 'success':
        return {
          bg: '#d4edda',
          border: '#c3e6cb',
          text: '#155724',
          icon: '#28a745',
        };
      case 'error':
        return {
          bg: '#f8d7da',
          border: '#f5c6cb',
          text: '#721c24',
          icon: '#dc3545',
        };
      case 'warning':
        return {
          bg: '#fff3cd',
          border: '#ffeeba',
          text: '#856404',
          icon: '#ffc107',
        };
      case 'info':
      default:
        return {
          bg: '#d1ecf1',
          border: '#bee5eb',
          text: '#0c5460',
          icon: '#17a2b8',
        };
    }
  };

  const getIcon = () => {
    const styles = getStyles();
    switch (notification.type) {
      case 'success':
        return (
          <svg width='16' height='16' viewBox='0 0 16 16' fill={styles.icon}>
            <path d='M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm3.97 4.97a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z' />
          </svg>
        );
      case 'error':
        return (
          <svg width='16' height='16' viewBox='0 0 16 16' fill={styles.icon}>
            <path d='M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM4.646 4.646a.5.5 0 0 0 0 .708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646a.5.5 0 0 0-.708 0z' />
          </svg>
        );
      case 'warning':
        return (
          <svg width='16' height='16' viewBox='0 0 16 16' fill={styles.icon}>
            <path d='M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm.93 4.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 4.588zM9 12a1 1 0 1 0-2 0 1 1 0 0 0 2 0z' />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg width='16' height='16' viewBox='0 0 16 16' fill={styles.icon}>
            <path d='M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm.93 4.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 4.588zM9 12a1 1 0 1 0-2 0 1 1 0 0 0 2 0z' />
          </svg>
        );
    }
  };

  const styles = getStyles();

  return (
    <div
      style={{
        backgroundColor: styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: '4px',
        padding: '0.75rem 1rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        fontSize: '0.875rem',
        color: styles.text,
        transform:
          isVisible && !isLeaving ? 'translateX(0)' : 'translateX(120%)',
        opacity: isVisible && !isLeaving ? 1 : 0,
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
      }}
      role='alert'
    >
      <div style={{ flexShrink: 0, marginTop: '2px' }}>{getIcon()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            marginBottom: '0.25rem',
            fontSize: '0.8125rem',
          }}
        >
          {notification.title}
        </div>
        <div style={{ fontSize: '0.8125rem', lineHeight: '1.4' }}>
          {notification.message}
        </div>
      </div>
      <button
        onClick={handleClose}
        style={{
          background: 'none',
          border: 'none',
          padding: '0',
          cursor: 'pointer',
          color: styles.text,
          opacity: 0.6,
          flexShrink: 0,
          width: '16px',
          height: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '2px',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
        aria-label='Close notification'
      >
        <svg width='12' height='12' viewBox='0 0 12 12' fill='currentColor'>
          <path d='M6 4.586L9.293 1.293a1 1 0 011.414 1.414L7.414 6l3.293 3.293a1 1 0 01-1.414 1.414L6 7.414l-3.293 3.293a1 1 0 01-1.414-1.414L4.586 6 1.293 2.707a1 1 0 011.414-1.414L6 4.586z' />
        </svg>
      </button>
    </div>
  );
};
