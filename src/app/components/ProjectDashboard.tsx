'use client';

import React from 'react';
import { TaskTable } from './TaskTable';
import { TaskCalendar } from './Calendar/TaskCalendar';
import { DashboardTabs } from './DashboardTabs';
import { trpc } from '@/app/lib/trpc';
import { useAuth } from '@/lib/supabase/auth-context';

interface ProjectDashboardProps {
  projectId: string;
  title?: string;
}

export function ProjectDashboard({
  projectId,
  title = 'Project Tasks',
}: ProjectDashboardProps) {
  const { userProfile } = useAuth();

  const { data, isLoading, error } = trpc.task.getProjectTasksForUser.useQuery({
    projectId,
  });
  const utils = trpc.useUtils();

  const handleInvalidate = () => {
    void utils.task.getProjectTasksForUser.invalidate({ projectId });
  };

  const emptyStateConfig = {
    icon: '📁',
    title: 'No tasks in this project yet',
    description: 'Create a task for this project to get started.',
  };

  return (
    <DashboardTabs
      tableView={
        <TaskTable
          tasks={data || []}
          title={title}
          showCreateButton={true}
          onTaskCreated={handleInvalidate}
          onTaskUpdated={handleInvalidate}
          emptyStateConfig={emptyStateConfig}
          isLoading={isLoading}
          error={error ? new Error(error.message) : null}
        />
      }
      calendarView={
        <TaskCalendar
          tasks={data || []}
          title={`${title} Calendar`}
          emptyStateConfig={emptyStateConfig}
          isLoading={isLoading}
          error={error ? new Error(error.message) : null}
          onTaskUpdated={handleInvalidate}
          showDepartmentFilter={userProfile?.role === 'MANAGER'}
        />
      }
      defaultTab='table'
    />
  );
}
