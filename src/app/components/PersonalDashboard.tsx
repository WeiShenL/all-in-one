'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { TaskTable } from './TaskTable/TaskTable';
import { trpc } from '../lib/trpc';

/**
 * Personal Dashboard Component (Personal Dashboard)
 * Shows only tasks assigned to the current user with full edit permissions
 */
export function PersonalDashboard() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.task.getUserTasks.useQuery(
    { userId: user?.id || '', includeArchived: false },
    { enabled: !!user?.id }
  );

  const handleTaskCreated = () => {
    // Invalidate the query to trigger a refetch
    utils.task.getUserTasks.invalidate();
  };

  return (
    <TaskTable
      tasks={data || []}
      title='All Tasks'
      showCreateButton={true}
      onTaskCreated={handleTaskCreated}
      emptyStateConfig={{
        icon: '📝',
        title: 'No tasks assigned to you yet',
        description:
          'Create your first task or wait for a manager to assign one to you.',
      }}
      isLoading={isLoading}
      error={error ? new Error(error.message) : null}
    />
  );
}
