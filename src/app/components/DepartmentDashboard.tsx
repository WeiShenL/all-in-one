'use client';

import { TaskTable } from './TaskTable';
import { trpc } from '../lib/trpc';

/**
 * Department Dashboard Component
 * Shows tasks from user's department hierarchy with role-based edit permissions
 * Matches structure of Personal Dashboard (StaffDashboard)
 */
export function DepartmentDashboard() {
  const { data, isLoading, error } =
    trpc.task.getDepartmentTasksForUser.useQuery();

  return (
    <TaskTable
      tasks={data || []}
      title='All Tasks'
      showCreateButton={true}
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
