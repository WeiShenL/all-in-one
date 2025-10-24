'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { useNotifications } from '@/lib/context/NotificationContext';
import { TaskTable } from './TaskTable';
import { TaskCalendar } from './Calendar/TaskCalendar';
import { DashboardTabs } from './DashboardTabs';
import { trpc } from '../lib/trpc';
import { useEffect } from 'react';

/**
 * Personal Dashboard Component (Personal Dashboard)
 * Shows only tasks assigned to the current user with full edit permissions
 * Supports both Table and Calendar views via tabs
 */
export function PersonalDashboard() {
  const { user } = useAuth();
  const { lastNotificationTime } = useNotifications();

  // Try to get utils for query invalidation (may not be available in test environment)
  let utils;
  try {
    utils = trpc.useUtils();
  } catch {
    // useUtils not available (e.g., in test environment without provider)
    utils = null;
  }

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

  const handleTaskUpdated = utils
    ? () => {
        // Invalidate the query to trigger a refetch
        utils.task.getUserTasks.invalidate();
      }
    : undefined;

  const emptyStateConfig = {
    icon: '📝',
    title: 'No tasks assigned to you yet',
    description:
      'Create your first task or wait for a manager to assign one to you.',
  };

  return (
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
        />
      }
      calendarView={
        <TaskCalendar
          tasks={data || []}
          title='Task Calendar'
          emptyStateConfig={emptyStateConfig}
          isLoading={isLoading}
          error={error ? new Error(error.message) : null}
          onTaskUpdated={handleTaskUpdated}
        />
      }
      defaultTab='table'
    />
  );
}
