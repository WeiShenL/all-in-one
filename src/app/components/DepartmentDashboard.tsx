'use client';

import { TaskTable } from './TaskTable';
import { trpc } from '../lib/trpc';

/**
 * Department Dashboard Component
 * Shows tasks from user's department hierarchy with role-based edit permissions
 * Matches structure of Personal Dashboard (StaffDashboard)
 */
export function DepartmentDashboard() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } =
    trpc.task.getDepartmentTasksForUser.useQuery();

  const handleTaskCreated = () => {
    // Invalidate the query to trigger a refetch
    utils.task.getDepartmentTasksForUser.invalidate();
  };

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
