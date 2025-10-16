'use client';

import { TaskTable } from './TaskTable';
import { TaskCalendar } from './Calendar/TaskCalendar';
import { DashboardTabs } from './DashboardTabs';
import { trpc } from '../lib/trpc';

/**
 * Department Dashboard Component
 * Shows tasks from user's department hierarchy with role-based edit permissions
 * Matches structure of Personal Dashboard (StaffDashboard)
 * Supports both Table and Calendar views via tabs
 */
export function DepartmentDashboard() {
  const { data, isLoading, error, refetch } =
    trpc.task.getDepartmentTasksForUser.useQuery();

  const emptyStateConfig = {
    icon: '📁',
    title: 'No tasks in your department yet',
    description:
      'Create your first task or wait for tasks to be added to your department.',
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
          onTaskUpdated={refetch}
        />
      }
      calendarView={
        <TaskCalendar
          tasks={data || []}
          title='Department Task Calendar'
          emptyStateConfig={emptyStateConfig}
          isLoading={isLoading}
          error={error ? new Error(error.message) : null}
        />
      }
      defaultTab='table'
    />
  );
}
