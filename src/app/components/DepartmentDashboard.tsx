'use client';

import { TaskTable } from './TaskTable';
import { TaskCalendar } from './Calendar/TaskCalendar';
import { DashboardTabs } from './DashboardTabs';
import { trpc } from '../lib/trpc';
import { useAuth } from '@/lib/supabase/auth-context';

/**
 * Department Dashboard Component
 * Shows tasks from user's department hierarchy with role-based edit permissions
 * Matches structure of Personal Dashboard (StaffDashboard)
 * Supports both Table and Calendar views via tabs
 */
export function DepartmentDashboard() {
  const { userProfile } = useAuth();

  // Try to get utils for query invalidation (may not be available in test environment)
  let utils;
  try {
    utils = trpc.useUtils();
  } catch {
    // useUtils not available (e.g., in test environment without provider)
    utils = null;
  }

  const { data, isLoading, error } =
    trpc.task.getDepartmentTasksForUser.useQuery();

  const handleTaskUpdated = utils
    ? () => {
        // Invalidate the query to trigger a refetch
        utils.task.getDepartmentTasksForUser.invalidate();
      }
    : undefined;

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
          onTaskUpdated={handleTaskUpdated}
        />
      }
      calendarView={
        <TaskCalendar
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
