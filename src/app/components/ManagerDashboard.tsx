'use client';

import { trpc } from '../lib/trpc';
import { useMemo, useState, useEffect, useRef } from 'react';
import { TaskCard } from './TaskCard';
import departmentData from '@/../prisma/data/1_departments.json';
import { TaskDatePill } from './TaskDatePill';

// --- TYPE DEFINITIONS ---
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  priority: number;
  dueDate: string;
  assignments: {
    user: { id: string; name: string | null; email: string | null };
  }[];
  department: { id: string; name: string };
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
    textAlign: 'left' as const,
    verticalAlign: 'middle' as const,
    borderBottom: '2px solid #e2e8f0',
  },
  thContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  thTitle: {
    display: 'flex',
    alignItems: 'center',
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
      return task.priority;
    case 'dueDate':
      return task.dueDate;
    case 'department':
      return departmentSortPaths.get(task.department.id) || '';
    case 'assignees':
      return task.assignments[0]?.user.name?.toLowerCase() || '';
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

/**
 * Manager Dashboard Component
 */
export function ManagerDashboard() {
  const { data, isLoading, error, refetch } =
    trpc.task.getDashboardTasks.useQuery();
  const [filters, setFilters] = useState<Filters>({
    title: '',
    status: '',
    assignee: '',
    department: '',
  });
  const [userSort, setUserSort] = useState<SortCriterion[]>([]);
  const [userHasSorted, setUserHasSorted] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

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
    if (!data?.tasks) {
      return { departments: [], assignees: [] };
    }
    const departmentsSet = new Set<string>();
    const assigneesMap = new Map<string, string>();
    data.tasks.forEach((task: Task) => {
      departmentsSet.add(task.department.name);
      task.assignments.forEach(a => {
        if (a.user.name) {
          assigneesMap.set(a.user.id, a.user.name);
        }
      });
    });
    return {
      departments: Array.from(departmentsSet).sort(),
      assignees: Array.from(assigneesMap.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [data?.tasks]);

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

  const filteredAndSortedTasks = useMemo(() => {
    if (!data?.tasks) {
      return [];
    }
    const processedTasks = [...data.tasks].filter(
      task =>
        task.title.toLowerCase().includes(filters.title.toLowerCase()) &&
        (filters.status ? task.status === filters.status : true) &&
        (filters.department
          ? task.department.name === filters.department
          : true) &&
        (filters.assignee
          ? task.assignments.some(a => a.user.id === filters.assignee)
          : true)
    );

    const criteria =
      userHasSorted && userSort.length > 0 ? userSort : defaultSortOrder;
    sortTasks(processedTasks, criteria);

    return processedTasks;
  }, [data?.tasks, filters, userSort, userHasSorted]);

  const handleFilterChange = (filterName: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const resetFilter = (filterName: keyof Filters) =>
    handleFilterChange(filterName, '');

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
        <h2
          style={{
            paddingTop: '1.5rem',
            marginBottom: '1rem',
            color: '#2d3748',
            fontSize: '1.25rem',
            fontWeight: 600,
          }}
        >
          All Tasks ({filteredAndSortedTasks.length})
        </h2>

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
                {key}: {assignees.find(a => a.id === value)?.name || value}
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
                <tr
                  key={task.id}
                  style={{
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f7fafc',
                  }}
                >
                  <td style={styles.td}>{task.title}</td>
                  <td style={styles.td}>{task.status.replace('_', ' ')}</td>
                  <td style={styles.td}>{task.priority}</td>
                  <td style={styles.td}>
                    <TaskDatePill dueDate={task.dueDate} status={task.status} />
                  </td>
                  <td style={styles.td}>
                    {task.assignments.map(a => a.user.name).join(', ') || 'N/A'}
                  </td>
                  <td style={styles.td}>{task.department.name}</td>
                  <td style={styles.td}>
                    <button
                      onClick={() => setEditingTaskId(task.id)}
                      style={styles.button}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            <TaskCard
              taskId={editingTaskId}
              onTaskChange={newTaskId => setEditingTaskId(newTaskId)}
              onTaskUpdated={() => refetch()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
