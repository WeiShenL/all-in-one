'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { TaskDatePill } from './TaskDatePill';

// --- PILL COMPONENTS (reused from StaffDashboard) ---
interface PillProps {
  children: React.ReactNode;
  backgroundColor: string;
  textColor?: string;
}

const Pill = ({
  children,
  backgroundColor,
  textColor = 'white',
}: PillProps) => (
  <span
    style={{
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '0.75rem',
      fontWeight: '600',
      backgroundColor,
      color: textColor,
      textTransform: 'uppercase',
      letterSpacing: '0.025em',
    }}
  >
    {children}
  </span>
);

const StatusPill = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'TO_DO':
        return { color: '#f3f4f6', textColor: '#6b7280', text: 'To Do' };
      case 'IN_PROGRESS':
        return { color: '#dbeafe', textColor: '#1e40af', text: 'In Progress' };
      case 'COMPLETED':
        return { color: '#dcfce7', textColor: '#166534', text: 'Completed' };
      case 'BLOCKED':
        return { color: '#fee2e2', textColor: '#dc2626', text: 'Blocked' };
      default:
        return { color: '#f3f4f6', textColor: '#6b7280', text: status };
    }
  };

  const config = getStatusConfig(status);
  return (
    <Pill backgroundColor={config.color} textColor={config.textColor}>
      {config.text}
    </Pill>
  );
};

const PriorityPill = ({ priority }: { priority: number | undefined }) => {
  const getPriorityConfig = (priority: number | undefined) => {
    // Handle undefined or invalid priority values
    if (priority === undefined || priority === null || isNaN(priority)) {
      return { color: '#f3f4f6', textColor: '#6b7280', text: 'N/A' };
    }

    if (priority >= 1 && priority <= 3) {
      return { color: '#dcfce7', textColor: '#166534', text: `${priority}` };
    } else if (priority >= 4 && priority <= 7) {
      return { color: '#fef3c7', textColor: '#d97706', text: `${priority}` };
    } else if (priority >= 8 && priority <= 10) {
      return { color: '#fee2e2', textColor: '#dc2626', text: `${priority}` };
    } else {
      return { color: '#f3f4f6', textColor: '#6b7280', text: `${priority}` };
    }
  };

  const config = getPriorityConfig(priority);
  return (
    <Pill backgroundColor={config.color} textColor={config.textColor}>
      {config.text}
    </Pill>
  );
};

// DatePill removed - now using shared TaskDatePill component which includes status check

// --- TYPES ---
interface ConnectedTask {
  id: string;
  title: string;
  status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  priorityBucket: number | undefined;
  dueDate: string;
  isParent: boolean;
  isSubtask: boolean;
  isCurrent: boolean;
}

interface TaskHierarchy {
  parentChain: Array<{
    id: string;
    title: string;
    status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
    priority: number | undefined;
    dueDate: string;
    parentTaskId: string | null;
  }>;
  currentTask: {
    id: string;
    title: string;
    status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
    priority: number | undefined;
    dueDate: string;
    parentTaskId: string | null;
  };
  subtaskTree: Array<{
    id: string;
    title: string;
    status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
    priority: number | undefined;
    dueDate: string;
    parentTaskId: string;
    subtasks: any[];
  }>;
}

// --- MAIN COMPONENT ---
export function ConnectedTasks({
  taskId,
  onTaskClick,
}: {
  taskId: string;
  onTaskClick?: (newTaskId: string) => void;
}) {
  const { userProfile } = useAuth();
  const [hierarchy, setHierarchy] = useState<TaskHierarchy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHierarchy = useCallback(async () => {
    if (!userProfile) {
      return;
    }

    try {
      setLoading(true);

      // Always fetch hierarchy from the current task's perspective
      const response = await fetch(
        `/api/trpc/task.getHierarchy?input=${encodeURIComponent(
          JSON.stringify({ taskId })
        )}`
      );
      const data = await response.json();

      if (data.result?.data) {
        setHierarchy(data.result.data);
      } else {
        setError('Failed to load connected tasks');
      }
    } catch {
      setError('Failed to load connected tasks');
    } finally {
      setLoading(false);
    }
  }, [userProfile, taskId]);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
        Loading connected tasks...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: '#dc3545' }}>
        ❌ {error}
      </div>
    );
  }

  if (!hierarchy) {
    return null;
  }

  // Build the connected tasks list
  const connectedTasks: ConnectedTask[] = [];

  // Determine if the current task is a parent or subtask
  const isCurrentTaskParent = hierarchy.currentTask.parentTaskId === null;

  if (isCurrentTaskParent) {
    // If current task is a parent, show: current task + all its subtasks
    connectedTasks.push({
      id: hierarchy.currentTask.id,
      title: hierarchy.currentTask.title,
      status: hierarchy.currentTask.status,
      priorityBucket: hierarchy.currentTask.priority,
      dueDate: hierarchy.currentTask.dueDate,
      isParent: true,
      isSubtask: false,
      isCurrent: true,
    });

    // Add all subtasks
    hierarchy.subtaskTree.forEach(subtask => {
      connectedTasks.push({
        id: subtask.id,
        title: subtask.title,
        status: subtask.status,
        priorityBucket: subtask.priority,
        dueDate: subtask.dueDate,
        isParent: false,
        isSubtask: true,
        isCurrent: false,
      });
    });
  } else {
    // If current task is a subtask, show: parent + current task + sibling subtasks

    // Add parent tasks from the parent chain
    hierarchy.parentChain.forEach(parent => {
      connectedTasks.push({
        id: parent.id,
        title: parent.title,
        status: parent.status,
        priorityBucket: parent.priority,
        dueDate: parent.dueDate,
        isParent: true,
        isSubtask: false,
        isCurrent: false,
      });
    });

    // Add current task
    connectedTasks.push({
      id: hierarchy.currentTask.id,
      title: hierarchy.currentTask.title,
      status: hierarchy.currentTask.status,
      priorityBucket: hierarchy.currentTask.priority,
      dueDate: hierarchy.currentTask.dueDate,
      isParent: false,
      isSubtask: true,
      isCurrent: true,
    });

    // Add sibling subtasks
    hierarchy.subtaskTree.forEach(subtask => {
      if (subtask.id !== hierarchy.currentTask.id) {
        connectedTasks.push({
          id: subtask.id,
          title: subtask.title,
          status: subtask.status,
          priorityBucket: subtask.priority,
          dueDate: subtask.dueDate,
          isParent: false,
          isSubtask: true,
          isCurrent: false,
        });
      }
    });
  }

  // If no connected tasks (no parents, no subtasks), show message
  if (connectedTasks.length <= 1) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
        📋 No connected tasks (this is a standalone task with no parent or
        subtasks)
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: '1.5rem',
        padding: '1rem',
        backgroundColor: '#f0f9ff',
        borderRadius: '8px',
        border: '1px solid #bae6fd',
      }}
    >
      <h3
        style={{
          fontSize: '0.875rem',
          fontWeight: '600',
          marginBottom: '12px',
          color: '#0369a1',
        }}
      >
        🔗 Connected Tasks ({connectedTasks.length})
      </h3>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.875rem',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#e0f2fe' }}>
              <th
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontWeight: '600',
                  color: '#0369a1',
                  borderBottom: '2px solid #bae6fd',
                }}
              >
                Task
              </th>
              <th
                style={{
                  padding: '8px 12px',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#0369a1',
                  borderBottom: '2px solid #bae6fd',
                }}
              >
                Type
              </th>
              <th
                style={{
                  padding: '8px 12px',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#0369a1',
                  borderBottom: '2px solid #bae6fd',
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: '8px 12px',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#0369a1',
                  borderBottom: '2px solid #bae6fd',
                }}
              >
                Priority
              </th>
              <th
                style={{
                  padding: '8px 12px',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#0369a1',
                  borderBottom: '2px solid #bae6fd',
                }}
              >
                Due Date
              </th>
            </tr>
          </thead>
          <tbody>
            {connectedTasks.map((task, index) => (
              <tr
                key={task.id}
                style={{
                  backgroundColor: task.isCurrent
                    ? '#fef3c7'
                    : index % 2 === 0
                      ? '#ffffff'
                      : '#f8fafc',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <td
                  style={{
                    padding: '12px',
                    borderLeft: task.isCurrent ? '4px solid #f59e0b' : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {/* Type indicator
                    {task.isParent && !task.isSubtask && (
                    //   <span
                    //     style={{
                    //       fontSize: '12px',
                    //       color: '#059669',
                    //       fontWeight: '600',
                    //       backgroundColor: '#d1fae5',
                    //       padding: '2px 6px',
                    //       borderRadius: '3px',
                    //     }}
                    //   >
                    //     PARENT
                    //   </span>
                    )}
                    {task.isSubtask && (
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#7c3aed',
                          fontWeight: '600',
                          backgroundColor: '#e9d5ff',
                          padding: '2px 6px',
                          borderRadius: '3px',
                        }}
                      >
                        SUBTASK
                      </span>
                    )} */}
                    {/* {task.isCurrent && (
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#d97706',
                          fontWeight: '600',
                          backgroundColor: '#fef3c7',
                          padding: '2px 6px',
                          borderRadius: '3px',
                        }}
                      >
                        CURRENT
                      </span>
                    )} */}

                    {/* Task title */}
                    <span
                      onClick={() => onTaskClick?.(task.id)}
                      style={{
                        fontWeight: task.isCurrent ? '600' : '500',
                        color: task.isCurrent ? '#92400e' : '#1f2937',
                        fontStyle: task.isSubtask ? 'italic' : 'normal',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = '#3b82f6';
                        e.currentTarget.style.backgroundColor = '#f0f9ff';
                        e.currentTarget.style.padding = '2px 4px';
                        e.currentTarget.style.borderRadius = '4px';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = task.isCurrent
                          ? '#92400e'
                          : '#1f2937';
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.padding = '0';
                        e.currentTarget.style.borderRadius = '0';
                      }}
                    >
                      {task.title}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: task.isParent
                        ? '#059669'
                        : task.isSubtask
                          ? '#7c3aed'
                          : '#d97706',
                    }}
                  >
                    {task.isParent && !task.isSubtask
                      ? '👑 Parent'
                      : task.isSubtask
                        ? '📋 Subtask'
                        : '📍 Current'}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <StatusPill status={task.status} />
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <PriorityPill priority={task.priorityBucket} />
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <TaskDatePill dueDate={task.dueDate} status={task.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: '12px',
          padding: '8px',
          backgroundColor: '#ffffff',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#6b7280',
        }}
      >
        <div style={{ fontWeight: '600', marginBottom: '4px' }}>Legend:</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <span>
            👑 <strong>Parent:</strong> Task that contains subtasks
          </span>
          <span>
            🟨 <strong>Current:</strong> The task you&apos;re viewing
          </span>
          <span>
            📋 <strong>Subtask:</strong> Child task of a parent
          </span>
        </div>
        {/* <div style={{ marginTop: '4px', fontSize: '10px', color: '#9ca3af' }}>
          <strong>Note:</strong> If viewing a subtask, you&apos;ll see its parent and sibling subtasks. If viewing a parent, you&apos;ll see all its subtasks.
        </div> */}
      </div>
    </div>
  );
}
