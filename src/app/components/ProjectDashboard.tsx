'use client';

import React, { useEffect, useMemo, useCallback } from 'react';
import { TaskTable } from './TaskTable';
import { TaskCalendar } from './Calendar/TaskCalendar';
import { DashboardTabs } from './DashboardTabs';
import { trpc } from '@/app/lib/trpc';
import { useAuth } from '@/lib/supabase/auth-context';
import { useNotifications } from '@/lib/context/NotificationContext';

interface ProjectDashboardProps {
  projectId: string;
  title?: string;
}

export function ProjectDashboard({
  projectId,
  title = 'Project Tasks',
}: ProjectDashboardProps) {
  const { userProfile } = useAuth();
  const { lastNotificationTime } = useNotifications();

  const { data, isLoading, error, refetch } =
    trpc.task.getProjectTasksForUser.useQuery({
      projectId,
    });
  const utils = trpc.useUtils();

  // Memoize handleInvalidate to prevent unnecessary re-renders
  const handleInvalidate = useCallback(() => {
    void utils.task.getProjectTasksForUser.invalidate({ projectId });
  }, [utils, projectId]);

  // Refetch tasks when a real-time notification is received
  // (notifications are sent when tasks are assigned/updated)
  useEffect(() => {
    if (lastNotificationTime > 0) {
      refetch();
    }
  }, [lastNotificationTime, refetch]);

  const emptyStateConfig = useMemo(
    () => ({
      icon: '📁',
      title: 'No tasks in this project yet',
      description: 'Create a task for this project to get started.',
    }),
    []
  );

  // Memoize views to prevent remounting when parent re-renders
  // This preserves calendar filter state when notifications trigger refetch
  const tableView = useMemo(
    () => (
      <TaskTable
        tasks={data || []}
        title={title}
        showCreateButton={true}
        onTaskCreated={handleInvalidate}
        onTaskUpdated={handleInvalidate}
        userRole={userProfile?.role}
        emptyStateConfig={emptyStateConfig}
        isLoading={isLoading}
        error={error ? new Error(error.message) : null}
      />
    ),
    [
      data,
      title,
      handleInvalidate,
      userProfile?.role,
      isLoading,
      error,
      emptyStateConfig,
    ]
  );

  const calendarView = useMemo(
    () => (
      <TaskCalendar
        key={`project-calendar-${projectId}`}
        tasks={data || []}
        title={`${title} Calendar`}
        emptyStateConfig={emptyStateConfig}
        isLoading={isLoading}
        error={error ? new Error(error.message) : null}
        onTaskUpdated={handleInvalidate}
        showDepartmentFilter={userProfile?.role === 'MANAGER'}
      />
    ),
    [
      data,
      title,
      handleInvalidate,
      userProfile?.role,
      isLoading,
      error,
      emptyStateConfig,
      projectId,
    ]
  );

  return (
    <DashboardTabs
      tableView={tableView}
      calendarView={calendarView}
      defaultTab='table'
    />
  );
}
