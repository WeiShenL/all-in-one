'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { useNotifications } from '@/lib/context/NotificationContext';
import { TaskTable } from './TaskTable';
import { TaskCalendar } from './Calendar/TaskCalendar';
import { DashboardTabs } from './DashboardTabs';
import { trpc } from '../lib/trpc';
import { useEffect, useMemo, useCallback } from 'react';

/**
 * Personal Dashboard Component (Personal Dashboard)
 * Shows only tasks assigned to the current user with full edit permissions
 * Supports both Table and Calendar views via tabs
 */
export function PersonalDashboard() {
  const { user, userProfile } = useAuth();
  const { lastNotificationTime } = useNotifications();
  const utils = trpc.useUtils();

  const { data, isLoading, error, refetch } = trpc.task.getUserTasks.useQuery(
    { userId: user?.id || '', includeArchived: false },
    { enabled: !!user?.id }
  );

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
    utils.task.getUserTasks.invalidate();
  }, [utils]);

  const emptyStateConfig = useMemo(
    () => ({
      icon: '📝',
      title: 'No tasks assigned to you yet',
      description:
        'Create your first task or wait for a manager to assign one to you.',
    }),
    []
  );

  // Memoize views to prevent remounting when parent re-renders
  // This preserves calendar filter state when notifications trigger refetch
  const tableView = useMemo(
    () => (
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
    ),
    [
      data,
      isLoading,
      error,
      handleTaskUpdated,
      userProfile?.role,
      emptyStateConfig,
    ]
  );

  const calendarView = useMemo(
    () => (
      <TaskCalendar
        key='personal-calendar'
        tasks={data || []}
        title='Task Calendar'
        emptyStateConfig={emptyStateConfig}
        isLoading={isLoading}
        error={error ? new Error(error.message) : null}
        onTaskUpdated={handleTaskUpdated}
      />
    ),
    [data, isLoading, error, handleTaskUpdated, emptyStateConfig]
  );

  return (
    <DashboardTabs
      tableView={tableView}
      calendarView={calendarView}
      defaultTab='table'
    />
  );
}
