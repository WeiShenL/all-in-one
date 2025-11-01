'use client';

import { TaskTable } from './TaskTable';
import { TaskCalendar } from './Calendar/TaskCalendar';
import { DashboardTabs } from './DashboardTabs';
import { trpc } from '../lib/trpc';
import { useAuth } from '@/lib/supabase/auth-context';
import { useNotifications } from '@/lib/context/NotificationContext';
import { useEffect, useCallback } from 'react';

/**
 * Department Dashboard Component
 * Shows tasks from user's department hierarchy with role-based edit permissions
 * Matches structure of Personal Dashboard (StaffDashboard)
 * Supports both Table and Calendar views via tabs
 */
export function DepartmentDashboard() {
  const { userProfile } = useAuth();
  const { lastNotificationTime } = useNotifications();
  const utils = trpc.useUtils();

  const { data, isLoading, error, refetch } =
    trpc.task.getDepartmentTasksForUser.useQuery();

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
  }, [utils]);

  const emptyStateConfig = {
    icon: '📁',
    title: 'No tasks in your department yet',
    description:
      'Create your first task or wait for tasks to be added to your department.',
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
  );
}
