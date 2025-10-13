// LogItem.tsx
'use client';
import { useEffect, useState } from 'react';

interface LogItemProps {
  log: {
    id: string;
    user: { name: string };
    timestamp: string;
    action: string;
    field: string;
    changes?: Record<string, any>;
    metadata?: any;
  };
}

const formatChangeValue = async (
  value: any,
  field: string
): Promise<string> => {
  // Handle date fields
  if (
    (field === 'Due Date' || field === 'dueDate') &&
    typeof value === 'string'
  ) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-GB');
      }
    } catch {}
  }

  // Handle recurring settings
  if (
    field === 'Recurring Settings' &&
    typeof value === 'object' &&
    value !== null
  ) {
    if (value.enabled === false) {
      return 'Disable';
    }
    if (value.enabled === true && value.interval) {
      return `Every ${value.interval} day${value.interval > 1 ? 's' : ''}`;
    }
    if (value.enabled === true) {
      return 'Enable';
    }
  }

  // Handle Assignees (fetch name)
  if (field === 'Asignees' && typeof value === 'string') {
    try {
      const response = await fetch(
        `/api/trpc/userProfile.getById?input=${encodeURIComponent(JSON.stringify({ id: value }))}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      const data = await response.json();
      return data?.result?.data?.name || 'Unknown User';
    } catch (error) {
      console.error('Error fetching assignee name:', error);
      return 'Unknown User';
    }
  }

  // Default
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

export default function LogItem({ log }: LogItemProps) {
  const [formattedChanges, setFormattedChanges] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!log.changes || Object.keys(log.changes).length === 0) {
      return;
    }

    const formatAllChanges = async () => {
      const formatted: Record<string, string> = {};
      for (const [key, value] of Object.entries(log.changes || {})) {
        formatted[key] = await formatChangeValue(value, log.field);
      }
      setFormattedChanges(formatted);
    };

    formatAllChanges();
  }, [log]);

  return (
    <div
      style={{
        padding: '12px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
      }}
    >
      {/* User and Timestamp */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div
          style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1f2937' }}
        >
          {log.user.name}
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          {new Date(log.timestamp).toLocaleDateString('en-GB')}{' '}
          {new Date(log.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {/* Action, Field, and Changes */}
      <div
        style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '8px' }}
      >
        <strong>{log.action}</strong> {log.field}
        {Object.keys(formattedChanges).length > 0 ? (
          <div style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
            {Object.entries(formattedChanges).map(([key, value]) => (
              <div key={key} style={{ marginBottom: '2px' }}>
                {key}: {value}
              </div>
            ))}
          </div>
        ) : log.changes && Object.keys(log.changes).length > 0 ? (
          <div
            style={{
              marginTop: '4px',
              fontSize: '12px',
              color: '#9ca3af',
              fontStyle: 'italic',
            }}
          >
            Loading changes...
          </div>
        ) : null}
      </div>

      {/* Optional metadata
      {log.metadata && (
        <div style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
          Source: {log.metadata.source || 'Unknown'}
        </div>
      )} */}
    </div>
  );
}
