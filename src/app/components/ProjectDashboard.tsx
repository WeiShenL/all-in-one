'use client';

import React from 'react';
import { TaskTable } from './TaskTable';
import { trpc } from '@/app/lib/trpc';

interface ProjectDashboardProps {
  projectId: string;
  title?: string;
}

export function ProjectDashboard({
  projectId,
  title = 'Project Tasks',
}: ProjectDashboardProps) {
  const { data, isLoading, error } = trpc.task.getProjectTasksForUser.useQuery({
    projectId,
  });
  const utils = trpc.useUtils();

  const handleInvalidate = () => {
    void utils.task.getProjectTasksForUser.invalidate({ projectId });
  };

  return (
    <TaskTable
      tasks={data || []}
      title={title}
      showCreateButton={true}
      onTaskCreated={handleInvalidate}
      onTaskUpdated={handleInvalidate}
      emptyStateConfig={{
        icon: '📁',
        title: 'No tasks in this project yet',
        description: 'Create a task for this project to get started.',
      }}
      isLoading={isLoading}
      error={error ? new Error(error.message) : null}
    />
  );
}
