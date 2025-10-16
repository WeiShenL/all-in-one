'use client';

import { TaskTable } from './TaskTable';
import { trpc } from '../lib/trpc';

/**
 * Company Dashboard Component
 * Shows all tasks across the organization for HR/Admin users
 * with role-based edit permissions
 */
export function CompanyDashboard() {
  // Try to get utils for query invalidation (may not be available in test environment)
  let utils;
  try {
    utils = trpc.useUtils();
  } catch {
    // useUtils not available (e.g., in test environment without provider)
    utils = null;
  }

  const { data, isLoading, error } = trpc.task.getCompanyTasks.useQuery({});

  const handleTaskCreated = utils
    ? () => {
        // Invalidate the query to trigger a refetch
        utils.task.getCompanyTasks.invalidate();
      }
    : undefined;

  return (
    <div>
      <TaskTable
        tasks={data || []}
        title='All Company Tasks'
        showCreateButton={true}
        onTaskCreated={handleTaskCreated}
        emptyStateConfig={{
          icon: '🌐',
          title: 'No tasks found',
          description: 'There are no tasks in the company yet.',
        }}
        isLoading={isLoading}
        error={error ? new Error(error.message) : null}
      />
    </div>
  );
}
