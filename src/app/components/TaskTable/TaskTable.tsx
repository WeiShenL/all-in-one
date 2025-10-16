'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { TaskCard } from '../TaskCard';
import { TaskCreateModal } from '../TaskCreateModal';
import { trpc } from '@/app/lib/trpc';
import departmentData from '@/../prisma/data/1_departments.json';
import {
  Task,
  Filters,
  SortableColumn,
  SortCriterion,
  TaskTableProps,
} from './types';
import { TaskRow } from './TaskRow';
import { styles } from './styles';
import {
  defaultSortOrder,
  sortTasks,
  organizeTasksHierarchically,
} from './utils';

// --- CUSTOM HOOKS ---
const useUserInfo = (userIds: string[]) => {
  const { data: users } = trpc.userProfile.getAll.useQuery();

  const userMap = useMemo(() => {
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

  return { userMap };
};

/**
 * Reusable TaskTable Component
 * Displays tasks with filtering, sorting, hierarchical subtasks, and conditional edit permissions
 */
export function TaskTable({
  tasks,
  title = 'All Tasks',
  showCreateButton = true,
  onCreateTask,
  onTaskCreated,
  emptyStateConfig = {
    icon: '📝',
    title: 'No tasks assigned to you yet',
    description:
      'Create your first task or wait for a manager to assign one to you.',
  },
  isLoading = false,
  error = null,
}: TaskTableProps) {
  const [filters, setFilters] = useState<Filters>({
    title: '',
    status: [],
    assignee: [],
    department: [],
    project: [],
  });
  const [userSort, setUserSort] = useState<SortCriterion[]>([]);
  const [userHasSorted, setUserHasSorted] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Get all unique user IDs from task assignments
  const allUserIds = useMemo(() => {
    if (!tasks) {
      return [];
    }
    const userIds = new Set<string>();
    tasks.forEach((task: Task) => {
      task.assignments.forEach(assignment => userIds.add(assignment.userId));
    });
    return Array.from(userIds);
  }, [tasks]);

  // Fetch user information for all assignees
  const { userMap } = useUserInfo(allUserIds);

  // ESC key handler to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingTaskId) {
          setEditingTaskId(null);
        }
        if (viewingTaskId) {
          setViewingTaskId(null);
        }
        if (isCreateModalOpen) {
          setCreateModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [editingTaskId, viewingTaskId, isCreateModalOpen]);

  const { departments, assignees, projects } = useMemo(() => {
    if (!tasks) {
      return { departments: [], assignees: [], projects: [] };
    }
    const departmentsSet = new Set<string>();
    const assigneesMap = new Map<string, { id: string; name: string }>();
    const projectsMap = new Map<string, { id: string; name: string }>();

    tasks.forEach((task: Task) => {
      const dept = departmentData.find(d => d.id === task.departmentId);
      if (dept) {
        departmentsSet.add(dept.name);
      }

      task.assignments.forEach(assignment => {
        const userName =
          assignment.user?.name || assignment.user?.email || assignment.userId;
        assigneesMap.set(assignment.userId, {
          id: assignment.userId,
          name: userName,
        });
      });

      // Collect projects
      if (task.project) {
        projectsMap.set(task.project.id, {
          id: task.project.id,
          name: task.project.name,
        });
      }
    });

    return {
      departments: Array.from(departmentsSet).sort(),
      assignees: Array.from(assigneesMap.values()).sort((a, b) => {
        const nameA = String(a.name || '');
        const nameB = String(b.name || '');
        return nameA.localeCompare(nameB);
      }),
      projects: Array.from(projectsMap.values()).sort((a, b) => {
        const nameA = String(a.name || '');
        const nameB = String(b.name || '');
        return nameA.localeCompare(nameB);
      }),
    };
  }, [tasks]);

  const handleSortChange = (key: SortableColumn) => {
    if (!userHasSorted) {
      setUserHasSorted(true);
    }
    setUserSort(prev => {
      const existingSort = prev.find(s => s.key === key);
      if (existingSort) {
        // Toggle between asc and desc only (don't remove)
        return prev.map(s =>
          s.key === key
            ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' }
            : s
        );
      } else {
        // Add new sort criterion starting with asc
        return [...prev, { key, direction: 'asc' }];
      }
    });
  };

  const removeSort = (key: SortableColumn) => {
    setUserSort(prev => prev.filter(s => s.key !== key));
  };

  const filteredAndSortedTasks = useMemo(() => {
    if (!tasks) {
      return [];
    }
    const processedTasks = [...tasks].filter(task => {
      const titleMatch = task.title
        .toLowerCase()
        .includes(filters.title.toLowerCase());

      const statusMatch =
        filters.status.length === 0 || filters.status.includes(task.status);

      const dept = departmentData.find(d => d.id === task.departmentId);
      const departmentMatch =
        filters.department.length === 0 ||
        (dept && filters.department.includes(dept.name));

      const assigneeMatch =
        filters.assignee.length === 0 ||
        task.assignments.some(a => filters.assignee.includes(a.userId));

      const projectMatch =
        filters.project.length === 0 ||
        (task.project && filters.project.includes(task.project.id));

      return (
        titleMatch &&
        statusMatch &&
        departmentMatch &&
        assigneeMatch &&
        projectMatch
      );
    });

    const criteria =
      userHasSorted && userSort.length > 0 ? userSort : defaultSortOrder;
    sortTasks(processedTasks, criteria);

    // Check if tasks already have subtasks nested (e.g., from getDepartmentTasksForUser)
    // If so, just mark hasSubtasks flag; otherwise organize hierarchically
    const hasNestedSubtasks = processedTasks.some(
      task => task.subtasks && task.subtasks.length > 0
    );

    if (hasNestedSubtasks) {
      // Tasks already have nested subtasks, just add hasSubtasks flag
      return processedTasks.map(task => ({
        ...task,
        hasSubtasks: task.subtasks && task.subtasks.length > 0,
      }));
    } else {
      // Tasks are flat, organize hierarchically
      return organizeTasksHierarchically(processedTasks);
    }
  }, [tasks, filters, userSort, userHasSorted]);

  const handleFilterChange = (filterName: keyof Filters, value: string) => {
    if (filterName === 'title') {
      setFilters(prev => ({ ...prev, [filterName]: value }));
    } else {
      // For array filters (status, assignee, department, project)
      setFilters(prev => {
        const currentValues = prev[filterName] as string[];
        const newValues = currentValues.includes(value)
          ? currentValues.filter(v => v !== value) // Remove if exists
          : [...currentValues, value]; // Add if doesn't exist
        return { ...prev, [filterName]: newValues };
      });
    }
  };

  const resetFilter = (filterName: keyof Filters) => {
    if (filterName === 'title') {
      setFilters(prev => ({ ...prev, [filterName]: '' }));
    } else {
      setFilters(prev => ({ ...prev, [filterName]: [] }));
    }
  };

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

  const activeFilters = Object.entries(filters).filter(([key, value]) => {
    if (key === 'title') {
      return value !== '';
    }
    return Array.isArray(value) && value.length > 0;
  });

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

  const handleCreateTask = () => {
    if (onCreateTask) {
      onCreateTask();
    } else {
      setCreateModalOpen(true);
    }
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
            {title} ({filteredAndSortedTasks.length})
          </h2>
          {showCreateButton && (
            <button
              onClick={handleCreateTask}
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
          )}
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
            {activeFilters.map(([key, value]) => {
              if (key === 'title') {
                return (
                  <span key={key} style={styles.filterPill}>
                    {key}: {value as string}
                    <button
                      onClick={() => resetFilter(key as keyof Filters)}
                      style={styles.filterRemoveBtn}
                    >
                      ×
                    </button>
                  </span>
                );
              }

              // For array filters
              const values = value as string[];
              return values.map(v => {
                let displayValue = v;
                if (key === 'assignee') {
                  displayValue = assignees.find(a => a.id === v)?.name || v;
                } else if (key === 'project') {
                  displayValue = projects.find(p => p.id === v)?.name || v;
                }

                return (
                  <span key={`${key}-${v}`} style={styles.filterPill}>
                    {key}: {displayValue}
                    <button
                      onClick={() =>
                        handleFilterChange(key as keyof Filters, v)
                      }
                      style={styles.filterRemoveBtn}
                    >
                      ×
                    </button>
                  </span>
                );
              });
            })}
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
              {emptyStateConfig.icon} {emptyStateConfig.title}
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              {emptyStateConfig.description}
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
                      <div style={{ position: 'relative' }}>
                        <select
                          value=''
                          onChange={e => {
                            if (e.target.value) {
                              handleFilterChange('status', e.target.value);
                            }
                          }}
                          style={{
                            ...styles.select,
                            backgroundColor:
                              filters.status.length > 0 ? '#ebf8ff' : 'white',
                          }}
                        >
                          <option value=''>
                            {filters.status.length > 0
                              ? `${filters.status.length} selected`
                              : 'All'}
                          </option>
                          <option value='TO_DO'>
                            {filters.status.includes('TO_DO') ? '✓ ' : ''}To Do
                          </option>
                          <option value='IN_PROGRESS'>
                            {filters.status.includes('IN_PROGRESS') ? '✓ ' : ''}
                            In Progress
                          </option>
                          <option value='COMPLETED'>
                            {filters.status.includes('COMPLETED') ? '✓ ' : ''}
                            Completed
                          </option>
                          <option value='BLOCKED'>
                            {filters.status.includes('BLOCKED') ? '✓ ' : ''}
                            Blocked
                          </option>
                        </select>
                      </div>
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
                        value=''
                        onChange={e => {
                          if (e.target.value) {
                            handleFilterChange('assignee', e.target.value);
                          }
                        }}
                        style={{
                          ...styles.select,
                          backgroundColor:
                            filters.assignee.length > 0 ? '#ebf8ff' : 'white',
                        }}
                      >
                        <option value=''>
                          {filters.assignee.length > 0
                            ? `${filters.assignee.length} selected`
                            : 'All'}
                        </option>
                        {assignees.map(a => (
                          <option key={a.id} value={a.id}>
                            {filters.assignee.includes(a.id) ? '✓ ' : ''}
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
                        onClick={() => handleSortChange('project')}
                      >
                        <>Project</>
                        <SortIndicator sortKey='project' />
                      </div>
                      <select
                        value=''
                        onChange={e => {
                          if (e.target.value) {
                            handleFilterChange('project', e.target.value);
                          }
                        }}
                        style={{
                          ...styles.select,
                          backgroundColor:
                            filters.project.length > 0 ? '#ebf8ff' : 'white',
                        }}
                      >
                        <option value=''>
                          {filters.project.length > 0
                            ? `${filters.project.length} selected`
                            : 'All'}
                        </option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>
                            {filters.project.includes(p.id) ? '✓ ' : ''}
                            {p.name}
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
                        value=''
                        onChange={e => {
                          if (e.target.value) {
                            handleFilterChange('department', e.target.value);
                          }
                        }}
                        style={{
                          ...styles.select,
                          backgroundColor:
                            filters.department.length > 0 ? '#ebf8ff' : 'white',
                        }}
                      >
                        <option value=''>
                          {filters.department.length > 0
                            ? `${filters.department.length} selected`
                            : 'All'}
                        </option>
                        {departments.map(d => (
                          <option key={d} value={d}>
                            {filters.department.includes(d) ? '✓ ' : ''}
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
            <TaskCard
              taskId={editingTaskId}
              onTaskChange={newTaskId => setEditingTaskId(newTaskId)}
            />
          </div>
        </div>
      )}

      {viewingTaskId && (
        <div
          style={styles.modalOverlay}
          onClick={e => {
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

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <TaskCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            setCreateModalOpen(false);
            // Trigger refetch of tasks
            if (onTaskCreated) {
              onTaskCreated();
            }
          }}
        />
      )}
    </div>
  );
}
