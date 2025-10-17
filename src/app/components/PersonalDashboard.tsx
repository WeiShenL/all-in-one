'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { TaskTable } from './TaskTable';
import { TaskCalendar } from './Calendar/TaskCalendar';
import { DashboardTabs } from './DashboardTabs';
import { trpc } from '../lib/trpc';

/**
 * Personal Dashboard Component (Personal Dashboard)
 * Shows only tasks assigned to the current user with full edit permissions
 * Supports both Table and Calendar views via tabs
 */
export function PersonalDashboard() {
  const { user } = useAuth();

  // Try to get utils for query invalidation (may not be available in test environment)
  let utils;
  try {
    utils = trpc.useUtils();
  } catch {
    // useUtils not available (e.g., in test environment without provider)
    utils = null;
  }

  const { data, isLoading, error } = trpc.task.getUserTasks.useQuery(
    { userId: user?.id || '', includeArchived: false },
    { enabled: !!user?.id }
  );

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
