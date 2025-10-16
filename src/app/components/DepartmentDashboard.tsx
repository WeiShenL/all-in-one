'use client';

import { TaskTable } from './TaskTable';
import { trpc } from '../lib/trpc';

/**
 * Department Dashboard Component
 * Shows tasks from user's department hierarchy with role-based edit permissions
 * Matches structure of Personal Dashboard (StaffDashboard)
 */
export function DepartmentDashboard() {
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

  const handleTaskCreated = utils
    ? () => {
        // Invalidate the query to trigger a refetch
        utils.task.getDepartmentTasksForUser.invalidate();
      }
    : undefined;

  return (
    <TaskTable
      tasks={data || []}
      title='All Tasks'
      showCreateButton={true}
      onTaskCreated={handleTaskCreated}
      emptyStateConfig={{
        icon: '📁',
        title: 'No tasks in your department yet',
        description:
          'Create your first task or wait for tasks to be added to your department.',
      }}
      isLoading={isLoading}
      error={error ? new Error(error.message) : null}
    />
  );
}
