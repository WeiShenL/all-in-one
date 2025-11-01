'use client';

import { TaskTable } from './TaskTable';
import { trpc } from '../lib/trpc';
import { useAuth } from '@/lib/supabase/auth-context';
import { useNotifications } from '@/lib/context/NotificationContext';
import { useEffect, useCallback } from 'react';

/**
 * Company Dashboard Component
 * Shows all tasks across the organization for HR/Admin users
 * with role-based edit permissions
 */
export function CompanyDashboard() {
  const { userProfile } = useAuth();
  const { lastNotificationTime } = useNotifications();
  const utils = trpc.useUtils();

  const { data, isLoading, error, refetch } =
    trpc.task.getCompanyTasks.useQuery({});

  // Refetch tasks when a real-time notification is received
  // (notifications are sent when tasks are assigned/updated)
  useEffect(() => {
    if (lastNotificationTime > 0) {
      refetch();
    }
  }, [lastNotificationTime, refetch]);

  // Memoize handleTaskCreated to prevent unnecessary re-renders
  const handleTaskCreated = useCallback(() => {
    // Invalidate the query to trigger a refetch
    utils.task.getCompanyTasks.invalidate();
  }, [utils]);

  return (
    <div>
      <TaskTable
        tasks={data || []}
        title='All Company Tasks'
        showCreateButton={true}
        onTaskCreated={handleTaskCreated}
        onTaskUpdated={handleTaskCreated}
        userRole={userProfile?.role}
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
