'use client';

import { TaskTable } from './TaskTable';
import { TaskCalendar } from './Calendar/TaskCalendar';
import { DashboardTabs } from './DashboardTabs';
import { trpc } from '../lib/trpc';
import { useAuth } from '@/lib/supabase/auth-context';
import { useNotifications } from '@/lib/context/NotificationContext';
import { useEffect, useCallback, useState } from 'react';

/**
 * Department Dashboard Component
 * Shows tasks from user's department hierarchy with role-based edit permissions
 * Matches structure of Personal Dashboard (StaffDashboard)
 * Supports both Table and Calendar views via tabs with pagination
 */
export function DepartmentDashboard() {
  const { userProfile } = useAuth();
  const { lastNotificationTime } = useNotifications();
  const utils = trpc.useUtils();
  const [page, setPage] = useState(0);
  const limit = 100;

  const { data, isLoading, error, refetch } =
    trpc.task.getDepartmentTasksForUser.useQuery({
      limit,
      offset: page * limit,
    });

  // Refetch tasks when a real-time notification is received
  // (notifications are sent when tasks are assigned/updated)
  useEffect(() => {
    if (lastNotificationTime > 0) {
      refetch();
    }
  }, [lastNotificationTime, refetch]);

  // Memoize handleTaskUpdated to prevent unnecessary re-renders
  const handleTaskUpdated = useCallback(() => {
    // Invalidate the query to trigger a refetch
    utils.task.getDepartmentTasksForUser.invalidate();
    setPage(0); // Reset to first page
  }, [utils]);

  const emptyStateConfig = {
    icon: '📁',
    title: 'No tasks in your department yet',
    description:
      'Create your first task or wait for tasks to be added to your department.',
  };

  const hasMoreData = data && data.length === limit;
  const showingCount = data ? data.length : 0;

  return (
    <div>
      <DashboardTabs
        tableView={
          <TaskTable
            tasks={data || []}
            title='All Tasks'
            showCreateButton={true}
            emptyStateConfig={emptyStateConfig}
            isLoading={isLoading}
            error={error ? new Error(error.message) : null}
            onTaskCreated={handleTaskUpdated}
            onTaskUpdated={handleTaskUpdated}
            userRole={userProfile?.role}
          />
        }
        calendarView={
          <TaskCalendar
            key='department-calendar'
            tasks={data || []}
            title='Department Task Calendar'
            emptyStateConfig={emptyStateConfig}
            isLoading={isLoading}
            error={error ? new Error(error.message) : null}
            onTaskUpdated={handleTaskUpdated}
            showDepartmentFilter={userProfile?.role === 'MANAGER'}
          />
        }
        defaultTab='table'
      />

      {/* Pagination Controls */}
      {!isLoading && data && data.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem',
          marginTop: '1rem',
          borderTop: '1px solid #e2e8f0',
        }}>
          <div style={{ color: '#718096', fontSize: '0.875rem' }}>
            Showing {showingCount} tasks (page {page + 1})
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: page === 0 ? '#e2e8f0' : '#3b82f6',
                color: page === 0 ? '#a0aec0' : '#ffffff',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: page === 0 ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMoreData}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: !hasMoreData ? '#e2e8f0' : '#3b82f6',
                color: !hasMoreData ? '#a0aec0' : '#ffffff',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: !hasMoreData ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
