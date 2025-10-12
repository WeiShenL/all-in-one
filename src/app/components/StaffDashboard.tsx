'use client';

import { trpc } from '../lib/trpc';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TaskEditCard } from './TaskEditCard';
import { TaskCard } from './TaskCard';
import departmentData from '@/../prisma/data/1_departments.json';
import { useAuth } from '@/lib/supabase/auth-context';

// --- CUSTOM HOOKS ---
const useUserInfo = (userIds: string[]) => {
  // Use a single query to fetch all users at once instead of multiple queries
  const { data: users, isLoading, error } = trpc.userProfile.getAll.useQuery();

  const userMap = useMemo(() => {
    // Ensure userIds is always an array to prevent undefined errors
    const safeUserIds = userIds || [];
    if (!users) {
      return new Map<string, { name: string; email: string }>();
    }

    const map = new Map<string, { name: string; email: string }>();
    safeUserIds.forEach(userId => {
      const user = users.find(u => u.id === userId);
      if (user) {
        map.set(userId, {
          name: user.name || 'Unknown',
          email: user.email || 'No email',
        });
      }
    });
    return map;
  }, [users, userIds]);

  return { userMap, isLoading, error };
};

// --- TYPE DEFINITIONS ---
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  priorityBucket: number;
  dueDate: string;
  assignments: string[]; // Array of user IDs
  departmentId: string;
  ownerId: string;
  projectId: string | null;
  parentTaskId: string | null;
  isRecurring: boolean;
  recurringInterval: number | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  comments: Array<{
    id: string;
    content: string;
    authorId: string;
    createdAt: string;
    updatedAt: string;
  }>;
  subtasks?: Task[]; // Subtasks for parent tasks
  hasSubtasks?: boolean; // Flag to indicate if task has subtasks
}

interface Filters {
  title: string;
  status: string;
  assignee: string;
  department: string;
}

type SortableColumn =
  | 'title'
  | 'status'
  | 'priority'
  | 'dueDate'
  | 'assignees'
  | 'department';

interface SortCriterion {
  key: SortableColumn;
  direction: 'asc' | 'desc';
}

// --- PILL COMPONENTS ---
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

const StatusPill = ({ status }: { status: Task['status'] }) => {
  const getStatusConfig = (status: Task['status']) => {
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

const PriorityPill = ({ priority }: { priority: number }) => {
  const getPriorityConfig = (priority: number) => {
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

const DatePill = ({ dueDate }: { dueDate: string }) => {
  const isOverdue = new Date(dueDate) < new Date();
  const backgroundColor = isOverdue ? '#fee2e2' : '#f3f4f6';
  const textColor = isOverdue ? '#dc2626' : '#6b7280';
  const text = new Date(dueDate).toLocaleDateString();

  return (
    <Pill backgroundColor={backgroundColor} textColor={textColor}>
      {text}
    </Pill>
  );
};

// --- STYLES ---
const styles = {
  card: {
    backgroundColor: '#ffffff',
    padding: '0 1.5rem 1.5rem',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    marginBottom: '1rem',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: {
    padding: '0.75rem 1rem',
    textAlign: 'center' as const,
    verticalAlign: 'middle' as const,
    borderBottom: '2px solid #e2e8f0',
  },
  thContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    alignItems: 'center',
  },
  thTitle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontWeight: 600,
    color: '#4a5568',
    fontSize: '0.875rem',
    textTransform: 'uppercase' as const,
    cursor: 'pointer' as const,
  },
  td: {
    padding: '1rem',
    color: '#2d3748',
    fontSize: '0.875rem',
    borderBottom: '1px solid #e2e8f0',
    textAlign: 'center' as const, // ← center rows
    verticalAlign: 'middle' as const, // optional for vertical centering
  },
  input: {
    display: 'block',
    width: 'calc(100% - 16px)',
    padding: '8px',
    fontSize: '0.875rem',
    border: '1px solid #cbd5e0',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
  },
  select: {
    display: 'block',
    width: '100%',
    padding: '8px',
    fontSize: '0.875rem',
    border: '1px solid #cbd5e0',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
  },
  button: {
    padding: '0.5rem 1rem',
    backgroundColor: '#3182ce',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer' as const,
    fontWeight: 600,
    fontSize: '0.875rem',
  },
  closeButton: {
    position: 'absolute' as const,
    top: '1rem',
    right: '1rem',
    padding: '0.5rem',
    backgroundColor: '#e2e8f0',
    color: '#4a5568',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer' as const,
    fontWeight: 600,
    fontSize: '1rem',
    lineHeight: 1,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    position: 'relative' as const,
    background: 'white',
    padding: '2rem',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '900px',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    // Fix scrollbar cutting off rounded corners
    backgroundClip: 'padding-box',
  },
  filterBar: {
    marginBottom: '1.5rem',
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  filterPill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#e2e8f0',
    color: '#2d3748',
    padding: '0.35rem 0.75rem',
    borderRadius: '16px',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  sortPill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#dbeafe',
    color: '#1e40af',
    padding: '0.35rem 0.75rem',
    borderRadius: '16px',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  filterRemoveBtn: {
    marginLeft: '0.5rem',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer' as const,
    color: '#718096',
    fontSize: '1rem',
    padding: 0,
  },
  assigneeCount: {
    display: 'inline-block',
    backgroundColor: '#3182ce',
    color: 'white',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    textAlign: 'center' as const,
    lineHeight: '24px',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer' as const,
  },
  popup: {
    position: 'fixed' as const,
    backgroundColor: '#2d3748',
    color: 'white',
    padding: '0.5rem',
    borderRadius: '6px',
    fontSize: '0.75rem',
    zIndex: 9999,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    maxWidth: '200px',
    whiteSpace: 'nowrap' as const,
    pointerEvents: 'none' as const,
  },
  popupItem: {
    marginBottom: '0.25rem',
  },
  popupItemLast: {
    marginBottom: 0,
  },
};

// --- SORTING LOGIC & DATA ---
const defaultSortOrder: SortCriterion[] = [
  { key: 'dueDate', direction: 'asc' },
  { key: 'priority', direction: 'desc' },
  { key: 'status', direction: 'asc' },
  { key: 'title', direction: 'asc' },
];

const statusSortOrder = { TO_DO: 1, IN_PROGRESS: 2, COMPLETED: 3, BLOCKED: 4 };

const departmentSortPaths = (() => {
  const deptMap = new Map(departmentData.map(d => [d.id, d]));
  const paths = new Map<string, string>();
  function getPath(deptId: string): string {
    if (paths.has(deptId)) {
      return paths.get(deptId)!;
    }
    const dept = deptMap.get(deptId);
    if (!dept) {
      return '';
    }
    const parentPath = dept.parentId ? getPath(dept.parentId) : '';
    const path = parentPath ? `${parentPath} > ${dept.name}` : dept.name;
    paths.set(deptId, path);
    return path;
  }
  departmentData.forEach(d => getPath(d.id));
  return paths;
})();

const getSortableValue = (task: Task, key: SortableColumn) => {
  switch (key) {
    case 'title':
      return task.title.toLowerCase();
    case 'status':
      return statusSortOrder[task.status];
    case 'priority':
      return task.priorityBucket;
    case 'dueDate':
      return task.dueDate;
    case 'department':
      return departmentSortPaths.get(task.departmentId) || '';
    case 'assignees':
      return task.assignments[0] || '';
    default:
      return '';
  }
};

const sortTasks = (tasks: Task[], criteria: SortCriterion[]) => {
  tasks.sort((a, b) => {
    for (const { key, direction } of criteria) {
      const valA = getSortableValue(a, key);
      const valB = getSortableValue(b, key);
      const comparison =
        typeof valA === 'string' && typeof valB === 'string'
          ? valA.localeCompare(valB)
          : valA < valB
            ? -1
            : valA > valB
              ? 1
              : 0;
      if (comparison !== 0) {
        return direction === 'asc' ? comparison : -comparison;
      }
    }
    return 0;
  });
};

// --- COMPONENTS ---
interface TaskRowProps {
  task: Task;
  index: number;
  userMap: Map<string, { name: string; email: string }>;
  isExpanded: boolean;
  onToggleExpansion: (taskId: string) => void;
  onEditTask: (taskId: string) => void;
  onViewTask: (taskId: string) => void;
  isSubtask?: boolean;
}

const TaskRow = ({
  task,
  index,
  userMap,
  isExpanded,
  onToggleExpansion,
  onEditTask,
  onViewTask,
  isSubtask = false,
}: TaskRowProps) => {
  return (
    <>
      <tr
        key={task.id}
        style={{
          backgroundColor: isSubtask
            ? '#f8fafc'
            : index % 2 === 0
              ? '#ffffff'
              : '#f7fafc',
          borderLeft: isSubtask ? '4px solid #e2e8f0' : 'none',
        }}
      >
        <td style={styles.td}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            {/* Left side: Dropdown arrow and number */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* Dropdown arrow for parent tasks with subtasks */}
              {task.hasSubtasks && (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <button
                    onClick={() => onToggleExpansion(task.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      color: '#3182ce',
                      transition: 'transform 0.2s ease',
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      borderRadius: '4px',
                      minWidth: '20px',
                      height: '20px',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = '#e2e8f0';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title={
                      isExpanded
                        ? `Collapse ${task.subtasks?.length || 0} subtasks`
                        : `Expand ${task.subtasks?.length || 0} subtasks`
                    }
                  >
                    ▶
                  </button>
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      fontWeight: '500',
                      backgroundColor: '#f3f4f6',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      minWidth: '18px',
                      textAlign: 'center',
                    }}
                    title={`${task.subtasks?.length || 0} subtasks`}
                  >
                    {task.subtasks?.length || 0}
                  </span>
                </div>
              )}

              {/* Indentation for subtasks */}
              {isSubtask && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginRight: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderLeft: '2px solid #cbd5e0',
                      borderBottom: '2px solid #cbd5e0',
                      marginRight: '8px',
                      borderRadius: '0 0 0 4px',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#9ca3af',
                      fontWeight: '600',
                      backgroundColor: '#f3f4f6',
                      padding: '2px 4px',
                      borderRadius: '3px',
                    }}
                  >
                    SUB
                  </span>
                </div>
              )}
            </div>

            {/* Center: Task title */}
            <button
              onClick={() => onViewTask(task.id)}
              style={{
                background: 'none',
                border: 'none',
                color: isSubtask ? '#4b5563' : '#1976d2',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: isSubtask ? '0.9em' : 'inherit',
                padding: 0,
                textAlign: 'center',
                flex: 1,
                fontStyle: isSubtask ? 'italic' : 'normal',
                opacity: isSubtask ? 0.9 : 1,
              }}
            >
              {isSubtask}
              {task.title}
            </button>

            {/* Right side: Empty space for balance */}
            <div style={{ width: '60px' }} />
          </div>
        </td>
        <td style={styles.td}>
          <StatusPill status={task.status} />
        </td>
        <td style={styles.td}>
          <PriorityPill priority={task.priorityBucket} />
        </td>
        <td style={styles.td}>
          <DatePill dueDate={task.dueDate} />
        </td>
        <td style={styles.td}>
          {task.assignments.length > 0 ? (
            <AssigneeCount userIds={task.assignments} userMap={userMap} />
          ) : (
            'N/A'
          )}
        </td>
        <td style={styles.td}>
          {departmentData.find(d => d.id === task.departmentId)?.name || 'N/A'}
        </td>
        <td style={styles.td}>
          <button onClick={() => onEditTask(task.id)} style={styles.button}>
            Edit
          </button>
        </td>
      </tr>

      {/* Render subtasks if expanded */}
      {isExpanded && task.subtasks && task.subtasks.length > 0 && (
        <>
          {/* Subtask header */}
          <tr style={{ backgroundColor: '#f8fafc' }}>
            <td
              colSpan={7}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                color: '#6b7280',
                fontWeight: '600',
                borderLeft: '4px solid #3182ce',
                backgroundColor: '#f0f9ff',
              }}
            >
              📋 Subtasks of &quot;{task.title}&quot; ({task.subtasks.length})
            </td>
          </tr>
          {task.subtasks.map((subtask, subtaskIndex) => (
            <TaskRow
              key={subtask.id}
              task={subtask}
              index={index + subtaskIndex + 1}
              userMap={userMap}
              isExpanded={false} // Subtasks don't expand further
              onToggleExpansion={() => {}} // No-op for subtasks
              onEditTask={onEditTask}
              onViewTask={onViewTask}
              isSubtask={true}
            />
          ))}
        </>
      )}
    </>
  );
};

interface AssigneeCountProps {
  userIds: string[];
  userMap: Map<string, { name: string; email: string }>;
}

const AssigneeCount = ({ userIds, userMap }: AssigneeCountProps) => {
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const countRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (countRef.current) {
      const rect = countRef.current.getBoundingClientRect();
      // Position tooltip above the element with some offset
      setPopupPosition({
        top: rect.top - 10,
        left: rect.left + rect.width / 2,
      });
      setShowPopup(true);
    }
  };

  const handleMouseLeave = () => {
    setShowPopup(false);
  };

  return (
    <>
      <div
        ref={countRef}
        style={styles.assigneeCount}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {userIds.length}
      </div>
      {showPopup && (
        <div
          style={{
            ...styles.popup,
            top: popupPosition.top,
            left: popupPosition.left,
            transform: 'translateX(-50%)',
          }}
        >
          {userIds.map((userId, index) => {
            const user = userMap.get(userId);
            return (
              <div
                key={userId}
                style={
                  index === userIds.length - 1
                    ? styles.popupItemLast
                    : styles.popupItem
                }
              >
                <div style={{ fontWeight: 600 }}>{user?.name || 'Unknown'}</div>
                <div style={{ color: '#a0aec0', fontSize: '0.7rem' }}>
                  {user?.email || 'No email'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

/**
 * Staff Dashboard Component
 */
export function StaffDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, isLoading, error } = trpc.task.getUserTasks.useQuery(
    { userId: user?.id || '', includeArchived: false },
    { enabled: !!user?.id }
  );
  const [filters, setFilters] = useState<Filters>({
    title: '',
    status: '',
    assignee: '',
    department: '',
  });
  const [userSort, setUserSort] = useState<SortCriterion[]>([]);
  const [userHasSorted, setUserHasSorted] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Get all unique user IDs from task assignments
  const allUserIds = useMemo(() => {
    if (!data) {
      return [];
    }
    const userIds = new Set<string>();
    data.forEach((task: Task) => {
      task.assignments.forEach(userId => userIds.add(userId));
    });
    return Array.from(userIds);
  }, [data]);

  // Fetch user information for all assignees
  const { userMap } = useUserInfo(allUserIds);

  // ESC key handler to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingTaskId) {
        setEditingTaskId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [editingTaskId]);

  const { departments, assignees } = useMemo(() => {
    if (!data) {
      return { departments: [], assignees: [] };
    }
    const departmentsSet = new Set<string>();
    const assigneesSet = new Set<string>();
    data.forEach((task: Task) => {
      // Get department name from department data
      const dept = departmentData.find(d => d.id === task.departmentId);
      if (dept) {
        departmentsSet.add(dept.name);
      }
      // Collect all assignee IDs
      task.assignments.forEach(userId => {
        assigneesSet.add(userId);
      });
    });
    return {
      departments: Array.from(departmentsSet).sort(),
      assignees: Array.from(assigneesSet)
        .map(id => {
          const user = userMap.get(id);
          return {
            id,
            name: user ? `${user.name} (${user.email})` : id,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [data, userMap]);

  const handleSortChange = (key: SortableColumn) => {
    if (!userHasSorted) {
      setUserHasSorted(true);
    }
    setUserSort(prev => {
      const existingSort = prev.find(s => s.key === key);
      if (existingSort) {
        if (existingSort.direction === 'asc') {
          return prev.map(s =>
            s.key === key ? { ...s, direction: 'desc' } : s
          );
        }
        return prev.filter(s => s.key !== key);
      } else {
        return [...prev, { key, direction: 'asc' }];
      }
    });
  };

  const removeSort = (key: SortableColumn) => {
    setUserSort(prev => prev.filter(s => s.key !== key));
  };

  // Organize tasks hierarchically (parent tasks with their subtasks)
  const organizeTasksHierarchically = (tasks: Task[]) => {
    const parentTasks = tasks.filter(task => !task.parentTaskId);
    const subtasks = tasks.filter(task => task.parentTaskId);

    // Group subtasks by parent ID
    const subtasksByParent = subtasks.reduce(
      (acc, subtask) => {
        const parentId = subtask.parentTaskId!;
        if (!acc[parentId]) {
          acc[parentId] = [];
        }
        acc[parentId].push(subtask);
        return acc;
      },
      {} as Record<string, Task[]>
    );

    // Add subtasks to parent tasks and mark which have subtasks
    return parentTasks.map(parent => ({
      ...parent,
      subtasks: subtasksByParent[parent.id] || [],
      hasSubtasks: (subtasksByParent[parent.id] || []).length > 0,
    }));
  };

  const filteredAndSortedTasks = useMemo(() => {
    if (!data) {
      return [];
    }
    const processedTasks = [...data].filter(task => {
      const titleMatch = task.title
        .toLowerCase()
        .includes(filters.title.toLowerCase());
      const statusMatch = filters.status
        ? task.status === filters.status
        : true;

      // Department filtering - find department name from ID
      const dept = departmentData.find(d => d.id === task.departmentId);
      const departmentMatch = filters.department
        ? dept?.name === filters.department
        : true;

      // Assignee filtering - check if user ID is in assignments array
      const assigneeMatch = filters.assignee
        ? task.assignments.includes(filters.assignee)
        : true;

      return titleMatch && statusMatch && departmentMatch && assigneeMatch;
    });

    const criteria =
      userHasSorted && userSort.length > 0 ? userSort : defaultSortOrder;
    sortTasks(processedTasks, criteria);

    // Organize tasks hierarchically
    return organizeTasksHierarchically(processedTasks);
  }, [data, filters, userSort, userHasSorted]);

  const handleFilterChange = (filterName: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const resetFilter = (filterName: keyof Filters) =>
    handleFilterChange(filterName, '');

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return <div>Loading dashboard...</div>;
  }
  if (error) {
    return <div>Error: {error.message}</div>;
  }
  if (!data) {
    return <div>No data available</div>;
  }

  const activeFilters = Object.entries(filters).filter(
    ([, value]) => value !== ''
  );

  const SortIndicator = ({ sortKey }: { sortKey: SortableColumn }) => {
    const sortInfo = userSort.find(s => s.key === sortKey);
    if (userHasSorted && sortInfo) {
      return (
        <span style={{ color: '#3182ce' }}>
          {sortInfo.direction === 'asc' ? '🔼' : '🔽'}
        </span>
      );
    }
    return <span style={{ color: '#cbd5e0' }}>🔽</span>;
  };

  return (
    <div>
      <div style={styles.card}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '1.5rem',
            marginBottom: '1rem',
          }}
        >
          <h2
            style={{
              margin: 0,
              color: '#2d3748',
              fontSize: '1.25rem',
              fontWeight: 600,
            }}
          >
            All Tasks ({filteredAndSortedTasks.length})
          </h2>
          <button
            onClick={() => router.push('/tasks/create')}
            style={{
              backgroundColor: '#3182ce',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            + Create Task
          </button>
        </div>

        {userHasSorted && userSort.length > 0 && (
          <div style={styles.filterBar}>
            <strong style={{ color: '#4a5568' }}>Sorting by:</strong>
            {userSort.map(({ key, direction }) => (
              <span key={key} style={styles.sortPill}>
                {key} ({direction})
                <button
                  onClick={() => removeSort(key)}
                  style={styles.filterRemoveBtn}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {activeFilters.length > 0 && (
          <div style={styles.filterBar}>
            <strong style={{ color: '#4a5568' }}>Filters:</strong>
            {activeFilters.map(([key, value]) => (
              <span key={key} style={styles.filterPill}>
                {key}:{' '}
                {key === 'assignee'
                  ? assignees.find(a => a.id === value)?.name || value
                  : value}
                <button
                  onClick={() => resetFilter(key as keyof Filters)}
                  style={styles.filterRemoveBtn}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {filteredAndSortedTasks.length === 0 ? (
          <div
            style={{
              padding: '2rem',
              backgroundColor: '#fff3cd',
              borderRadius: '12px',
              border: '1px solid #ffc107',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontWeight: '600', marginBottom: '8px' }}>
              📝 No tasks assigned to you yet
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              Create your first task or wait for a manager to assign one to you.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={{ backgroundColor: '#f7fafc' }}>
                  <th style={styles.th}>
                    <div style={styles.thContent}>
                      <div
                        style={styles.thTitle}
                        onClick={() => handleSortChange('title')}
                      >
                        <>Title</>
                        <SortIndicator sortKey='title' />
                      </div>
                      <input
                        type='text'
                        placeholder='Filter...'
                        value={filters.title}
                        onChange={e =>
                          handleFilterChange('title', e.target.value)
                        }
                        style={styles.input}
                      />
                    </div>
                  </th>
                  <th style={styles.th}>
                    <div style={styles.thContent}>
                      <div
                        style={styles.thTitle}
                        onClick={() => handleSortChange('status')}
                      >
                        <>Status</>
                        <SortIndicator sortKey='status' />
                      </div>
                      <select
                        value={filters.status}
                        onChange={e =>
                          handleFilterChange('status', e.target.value)
                        }
                        style={styles.select}
                      >
                        <option value=''>All</option>
                        <option value='TO_DO'>To Do</option>
                        <option value='IN_PROGRESS'>In Progress</option>
                        <option value='COMPLETED'>Completed</option>
                        <option value='BLOCKED'>Blocked</option>
                      </select>
                    </div>
                  </th>
                  <th style={styles.th}>
                    <div style={styles.thContent}>
                      <div
                        style={styles.thTitle}
                        onClick={() => handleSortChange('priority')}
                      >
                        <>Priority</>
                        <SortIndicator sortKey='priority' />
                      </div>
                      <div style={{ height: '38px' }}></div>
                    </div>
                  </th>
                  <th style={styles.th}>
                    <div style={styles.thContent}>
                      <div
                        style={styles.thTitle}
                        onClick={() => handleSortChange('dueDate')}
                      >
                        <>Due</>
                        <SortIndicator sortKey='dueDate' />
                      </div>
                      <div style={{ height: '38px' }}></div>
                    </div>
                  </th>
                  <th style={styles.th}>
                    <div style={styles.thContent}>
                      <div
                        style={styles.thTitle}
                        onClick={() => handleSortChange('assignees')}
                      >
                        <>Assignees</>
                        <SortIndicator sortKey='assignees' />
                      </div>
                      <select
                        value={filters.assignee}
                        onChange={e =>
                          handleFilterChange('assignee', e.target.value)
                        }
                        style={styles.select}
                      >
                        <option value=''>All</option>
                        {assignees.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th style={styles.th}>
                    <div style={styles.thContent}>
                      <div
                        style={styles.thTitle}
                        onClick={() => handleSortChange('department')}
                      >
                        <>Department</>
                        <SortIndicator sortKey='department' />
                      </div>
                      <select
                        value={filters.department}
                        onChange={e =>
                          handleFilterChange('department', e.target.value)
                        }
                        style={styles.select}
                      >
                        <option value=''>All</option>
                        {departments.map(d => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th style={styles.th}>
                    <div style={{ ...styles.thTitle, cursor: 'default' }}>
                      Actions
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTasks.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    index={index}
                    userMap={userMap}
                    isExpanded={expandedTasks.has(task.id)}
                    onToggleExpansion={toggleTaskExpansion}
                    onEditTask={setEditingTaskId}
                    onViewTask={setViewingTaskId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingTaskId && (
        <div
          style={styles.modalOverlay}
          onClick={e => {
            // Close modal if clicking outside the modal content
            if (e.target === e.currentTarget) {
              setEditingTaskId(null);
            }
          }}
        >
          <div style={styles.modalContent} ref={modalContentRef}>
            <button
              onClick={() => setEditingTaskId(null)}
              style={styles.closeButton}
            >
              ×
            </button>
            <TaskEditCard taskId={editingTaskId} />
          </div>
        </div>
      )}

      {viewingTaskId && (
        <div
          style={styles.modalOverlay}
          onClick={e => {
            // Close modal if clicking outside the modal content
            if (e.target === e.currentTarget) {
              setViewingTaskId(null);
            }
          }}
        >
          <div style={styles.modalContent} ref={modalContentRef}>
            <button
              onClick={() => setViewingTaskId(null)}
              style={styles.closeButton}
            >
              ×
            </button>
            <TaskCard
              taskId={viewingTaskId}
              onTaskChange={newTaskId => setViewingTaskId(newTaskId)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
