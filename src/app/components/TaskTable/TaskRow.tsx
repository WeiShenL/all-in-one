import { useState, useRef } from 'react';
import { Task } from './types';
import { StatusPill, PriorityPill } from './Pills';
import { TaskDatePill } from './TaskDatePill';
import { styles } from './styles';
import departmentData from '@/../prisma/data/1_departments.json';

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

interface AssigneeCountProps {
  userIds: string[];
  userMap: Map<string, { name: string; email: string }>;
}

interface TagsCountProps {
  tags: string[];
}

const AssigneeCount = ({ userIds, userMap }: AssigneeCountProps) => {
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const countRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (countRef.current) {
      const rect = countRef.current.getBoundingClientRect();
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

const TagsCount = ({ tags }: TagsCountProps) => {
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const countRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (countRef.current) {
      const rect = countRef.current.getBoundingClientRect();
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
        style={{
          ...styles.assigneeCount,
          backgroundColor: '#fef3c7',
          color: '#92400e',
          border: '1px solid #fbbf24',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {tags.length}
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
          {tags.map((tag, index) => (
            <div
              key={index}
              style={{
                ...(index === tags.length - 1
                  ? styles.popupItemLast
                  : styles.popupItem),
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: '1px solid #fbbf24',
                }}
              >
                {tag}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export const TaskRow = ({
  task,
  index,
  userMap,
  isExpanded,
  onToggleExpansion,
  onEditTask,
  onViewTask,
  isSubtask = false,
}: TaskRowProps) => {
  // Check if user can edit - defaults to true if not specified (backward compatibility)
  const canEdit = task.canEdit !== undefined ? task.canEdit : true;

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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

            <button
              data-testid={`view-task-button-${task.id}`}
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
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#3b82f6';
                e.currentTarget.style.backgroundColor = '#f0f9ff';
                e.currentTarget.style.padding = '2px 4px';
                e.currentTarget.style.borderRadius = '4px';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = isSubtask ? '#4b5563' : '#1976d2';
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.padding = '0';
                e.currentTarget.style.borderRadius = '0';
              }}
            >
              {task.title}
            </button>

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
          <TaskDatePill dueDate={task.dueDate} status={task.status} />
        </td>
        <td style={styles.td}>
          {task.assignments.length > 0 ? (
            <AssigneeCount
              userIds={task.assignments.map(a => a.userId)}
              userMap={userMap}
            />
          ) : (
            'N/A'
          )}
        </td>
        <td style={styles.td}>
          {task.tags && task.tags.length > 0 ? (
            <TagsCount tags={task.tags} />
          ) : (
            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>
              No tags
            </span>
          )}
        </td>
        <td style={styles.td} data-testid={`task-project-${task.id}`}>
          {task.project?.name || (
            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>
              No project assigned
            </span>
          )}
        </td>
        <td style={styles.td}>
          {departmentData.find(d => d.id === task.departmentId)?.name || 'N/A'}
        </td>
        <td style={styles.td}>
          {canEdit && (
            <button
              data-testid={`edit-task-button-${task.id}`}
              onClick={() => onEditTask(task.id)}
              style={styles.button}
            >
              Edit
            </button>
          )}
        </td>
      </tr>

      {isExpanded && task.subtasks && task.subtasks.length > 0 && (
        <>
          <tr style={{ backgroundColor: '#f8fafc' }}>
            <td
              colSpan={9}
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
              isExpanded={false}
              onToggleExpansion={() => {}}
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
