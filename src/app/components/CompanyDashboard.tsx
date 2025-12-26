'use client';

import { TaskTable } from './TaskTable';
import { TaskCalendar } from './Calendar/TaskCalendar';
import { DashboardTabs } from './DashboardTabs';
import { trpc } from '../lib/trpc';
import { useAuth } from '@/lib/supabase/auth-context';
import { useNotifications } from '@/lib/context/NotificationContext';
import { useEffect, useCallback, useState } from 'react';

/**
 * Company Dashboard Component
 * Shows all tasks across the organization for HR/Admin users
 * with role-based edit permissions
 * Table view has server-side pagination managed by TaskTable
 */
export function CompanyDashboard() {
  const { userProfile } = useAuth();
  const { lastNotificationTime } = useNotifications();
  const utils = trpc.useUtils();
  const [page, setPage] = useState(0);
  const limit = 100;

  const { data, isLoading, error, refetch } =
    trpc.task.getCompanyTasks.useQuery({
      limit,
      offset: page * limit,
    });

  // Refetch tasks when a real-time notification is received
  useEffect(() => {
    if (lastNotificationTime > 0) {
      refetch();
    }
  }, [lastNotificationTime, refetch]);

  // Memoize handleTaskCreated to prevent unnecessary re-renders
  const handleTaskCreated = useCallback(() => {
    utils.task.getCompanyTasks.invalidate();
  }, [utils]);

  const handleFetchPage = useCallback((newPage: number, _pageSize: number) => {
    setPage(newPage);
  }, []);

  return (
    <div>
      <DashboardTabs
        tableView={
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
            enablePagination={true}
            paginationMode='server'
            onFetchPage={handleFetchPage}
            pageSize={limit}
          />
        }
        calendarView={
          <TaskCalendar
            key='company-calendar'
            tasks={data || []}
            title='Company Task Calendar'
            emptyStateConfig={{
              icon: '🌐',
              title: 'No tasks found',
              description: 'There are no tasks in the company yet.',
            }}
            isLoading={isLoading}
            error={error ? new Error(error.message) : null}
            onTaskUpdated={handleTaskCreated}
            showDepartmentFilter={true}
          />
        }
        defaultTab='table'
      />
    </div>
  );
}
