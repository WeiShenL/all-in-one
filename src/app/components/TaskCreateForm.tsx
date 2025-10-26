'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { useNotifications } from '@/lib/context/NotificationContext';
import { UserSelectOption } from './UserSelectOption';

interface TaskCreateFormProps {
  onSuccess?: (taskId: string) => void;
  onCancel?: () => void;
}

/**
 * Task Creation Form Component - SCRUM-12
 *
 * Implements all acceptance criteria:
 * - All mandatory fields (title, description, priority 1-10, deadline, assignees)
 * - 1-5 assignees
 * - Optional tags
 * - Optional project association
 * - Optional recurring interval
 * - Optional parent task (for subtasks)
 * - Automatic department association (from user profile)
 *
 * NOTE: File attachments are handled separately via TaskFileUpload component
 * after task creation (requires taskId).
 */
export function TaskCreateForm({ onSuccess, onCancel }: TaskCreateFormProps) {
  const { user, userProfile } = useAuth();
  const { addNotification } = useNotifications();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(5);
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]); // Selected assignee user IDs
  const [tags, setTags] = useState<string>(''); // Comma-separated tags
  const [projectId, setProjectId] = useState('');
  const [parentTaskId, setParentTaskId] = useState('');
  const [recurringInterval, setRecurringInterval] = useState<number | ''>('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Available tasks for parent selection
  const [availableTasks, setAvailableTasks] = useState<
    Array<{
      id: string;
      title: string;
      dueDate: string;
      parentTaskId: string | null;
    }>
  >([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Available projects for dropdown
  const [availableProjects, setAvailableProjects] = useState<
    Array<{
      id: string;
      name: string;
    }>
  >([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Available users for assignee dropdown
  const [availableUsers, setAvailableUsers] = useState<
    Array<{
      id: string;
      name: string;
      email: string;
      role?: string;
      isHrAdmin?: boolean;
      department?: {
        id: string;
        name: string;
      };
    }>
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Auto-assign current user's ID
  useEffect(() => {
    if (userProfile?.id) {
      setAssigneeIds([userProfile.id]);
    }
  }, [userProfile]);

  // Fetch available parent tasks based on user role
  useEffect(() => {
    async function fetchTasks() {
      if (!userProfile) {
        return;
      }

      try {
        const response = await fetch(`/api/trpc/task.getAvailableParentTasks`);
        const data = await response.json();

        if (data.result?.data) {
          interface TaskData {
            id: string;
            title: string;
            dueDate: string;
            parentTaskId: string | null;
          }
          const tasks = Array.isArray(data.result.data)
            ? data.result.data
            : [data.result.data];
          // Tasks are already filtered to parent tasks only by the backend
          setAvailableTasks(
            tasks.map((t: TaskData) => ({
              id: t.id,
              title: t.title,
              dueDate: t.dueDate,
              parentTaskId: t.parentTaskId,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
      } finally {
        setLoadingTasks(false);
      }
    }

    fetchTasks();
  }, [userProfile]);

  // Fetch all projects for dropdown
  useEffect(() => {
    async function fetchProjects() {
      if (!userProfile) {
        return;
      }

      setLoadingProjects(true);
      try {
        const response = await fetch(
          `/api/trpc/project.getAll?input=${encodeURIComponent(JSON.stringify({ isArchived: false }))}`
        );
        const data = await response.json();

        if (data.result?.data) {
          setAvailableProjects(
            data.result.data.map((p: any) => ({
              id: p.id,
              name: p.name,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    }

    fetchProjects();
  }, [userProfile]);

  // Fetch all active users for assignee dropdown
  useEffect(() => {
    async function fetchUsers() {
      if (!userProfile) {
        return;
      }

      setLoadingUsers(true);
      try {
        const response = await fetch('/api/trpc/userProfile.getAll');
        const data = await response.json();

        if (data.result?.data) {
          // Filter for active users only
          const activeUsers = data.result.data.filter((u: any) => u.isActive);
          setAvailableUsers(
            activeUsers.map((u: any) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              isHrAdmin: u.role === 'HR_ADMIN',
              department: u.department
                ? { id: u.department.id, name: u.department.name }
                : undefined,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoadingUsers(false);
      }
    }

    fetchUsers();
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!userProfile) {
      setError('User profile not loaded');
      return;
    }

    // Validate assignees (1-5) - now using dropdown selection
    if (assigneeIds.length < 1) {
      setError('At least 1 assignee is required');
      return;
    }

    if (assigneeIds.length > 5) {
      setError('Maximum 5 assignees allowed');
      return;
    }

    // Validate subtask due date doesn't exceed parent task due date
    if (parentTaskId) {
      const parentTask = availableTasks.find(t => t.id === parentTaskId);
      if (parentTask) {
        const parentDueDate = new Date(parentTask.dueDate);
        const subtaskDueDate = new Date(dueDate);

        if (subtaskDueDate > parentDueDate) {
          setError(
            `Subtask due date cannot be later than parent task due date (${parentDueDate.toLocaleDateString()})`
          );
          return;
        }
      }
    }

    // Validate priority
    if (priority < 1 || priority > 10) {
      setError('Priority must be between 1 and 10');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create task or subtask (assigneeIds already selected from dropdown)
      const tagList = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Determine endpoint based on whether this is a subtask
      const isSubtask = !!parentTaskId;
      const endpoint = isSubtask
        ? '/api/trpc/task.createSubtask'
        : '/api/trpc/task.create';

      const taskData = isSubtask
        ? {
            // Subtask-specific data (no projectId, ownerId, recurringInterval)
            title: title.trim(),
            description: description.trim(),
            priority,
            dueDate: new Date(dueDate).toISOString(),
            assigneeIds,
            parentTaskId,
            ...(tagList.length > 0 && { tags: tagList }),
          }
        : {
            // Regular task data
            title: title.trim(),
            description: description.trim(),
            priority,
            dueDate: new Date(dueDate).toISOString(),
            ownerId: userProfile.id,
            assigneeIds,
            ...(tagList.length > 0 && { tags: tagList }),
            ...(projectId && { projectId }),
            ...(recurringInterval && {
              recurringInterval: Number(recurringInterval),
            }),
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create task');
      }

      const result = await response.json();
      const createdTask = result.result?.data;

      // Step 2: Show success notification with task name
      addNotification(
        'success',
        'Task Created Successfully',
        `Task "${title.trim()}" created successfully`
      );

      // Step 3: Upload files if any were selected
      if (selectedFiles.length > 0 && createdTask?.id) {
        for (const file of selectedFiles) {
          try {
            // Read file as base64
            const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = e =>
                resolve((e.target?.result as string).split(',')[1]);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            // Upload file
            await fetch('/api/trpc/taskFile.uploadFile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                taskId: createdTask.id,
                fileName: file.name,
                fileType: file.type,
                fileData: base64Data,
                userId: userProfile.id,
                userRole: userProfile.role,
                departmentId: userProfile.departmentId,
              }),
            });
          } catch (fileErr) {
            console.error(`Failed to upload file ${file.name}:`, fileErr);
            // Continue with other files even if one fails
          }
        }
      }

      setSuccess(true);
      setError(null);

      // Reset form
      setTitle('');
      setDescription('');
      setPriority(5);
      setDueDate('');
      setTags('');
      setProjectId('');
      setParentTaskId('');
      setRecurringInterval('');
      setSelectedFiles([]);

      if (onSuccess && createdTask?.id) {
        onSuccess(createdTask.id);
      }
    } catch (err) {
      console.error('Task creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  if (!user || !userProfile) {
    return <div>Please log in to create tasks</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h2
        style={{
          marginBottom: '1.5rem',
          fontSize: '1.5rem',
          fontWeight: '600',
        }}
      >
        Create New Task
      </h2>

      <form onSubmit={handleSubmit}>
        {/* Title - Mandatory */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor='title'
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            Title <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            id='title'
            type='text'
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
            placeholder='e.g., Implement login feature'
          />
        </div>

        {/* Description - Mandatory */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor='description'
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            Description <span style={{ color: 'red' }}>*</span>
          </label>
          <textarea
            id='description'
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
            rows={4}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
            placeholder='Detailed description of the task...'
          />
        </div>

        {/* Priority - Mandatory (1-10 scale) */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor='priority'
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            Priority (1-10) <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            id='priority'
            type='number'
            value={priority}
            onChange={e => setPriority(Number(e.target.value))}
            min={1}
            max={10}
            required
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
          <small style={{ color: '#666', fontSize: '0.875rem' }}>
            1 = Low, 5 = Medium, 10 = High
          </small>
        </div>

        {/* Due Date - Mandatory */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor='date'
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            Deadline <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            id='date'
            type='date'
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        {/* Assignees - Mandatory (1-5) - Multi-select dropdown */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            Assigned Staff (1-5) <span style={{ color: 'red' }}>*</span>
          </label>
          <select
            data-testid='assignee-select'
            multiple
            value={assigneeIds}
            onChange={e => {
              const selected = Array.from(
                e.target.selectedOptions,
                option => option.value
              );
              if (selected.length > 5) {
                setError('Maximum 5 assignees allowed');
                return;
              }
              setAssigneeIds(selected);
              setError(null);
            }}
            required
            disabled={loadingUsers}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              minHeight: '120px',
              maxHeight: '200px',
              overflowY: 'auto',
              maxWidth: '100%',
              backgroundColor: loadingUsers ? '#f5f5f5' : 'white',
              cursor: loadingUsers ? 'not-allowed' : 'pointer',
            }}
          >
            {availableUsers
              .sort((a, b) => {
                // Sort by department name, then by user name
                const deptA = a.department?.name || '';
                const deptB = b.department?.name || '';
                if (deptA !== deptB) {
                  return deptA.localeCompare(deptB);
                }
                return a.name.localeCompare(b.name);
              })
              .map(user => (
                <option key={user.id} value={user.id}>
                  {UserSelectOption({ user })}
                </option>
              ))}
          </select>
          <small style={{ color: '#666', fontSize: '0.875rem' }}>
            {loadingUsers
              ? 'Loading users...'
              : `Hold Ctrl/Cmd to select multiple (${assigneeIds.length}/5 selected)`}
          </small>
        </div>

        {/* Tags - Optional */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            Tags (Optional)
          </label>
          <input
            data-testid='tags-input'
            type='text'
            value={tags}
            onChange={e => setTags(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
            placeholder='urgent, frontend, bug-fix'
          />
          <small style={{ color: '#666', fontSize: '0.875rem' }}>
            Comma-separated tags
          </small>
        </div>

        {/* Project - Optional - Dropdown */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            Project (Optional)
          </label>
          <select
            name='projectId'
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            disabled={loadingProjects}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: loadingProjects ? '#f5f5f5' : 'white',
              cursor: loadingProjects ? 'not-allowed' : 'pointer',
            }}
          >
            <option value=''>-- No Project (Standalone Task) --</option>
            {availableProjects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <small style={{ color: '#666', fontSize: '0.875rem' }}>
            {loadingProjects
              ? 'Loading projects...'
              : 'Select a project or leave empty for standalone task'}
          </small>
        </div>

        {/* Parent Task - Optional (for subtasks) */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            Parent Task (Optional - for subtasks)
          </label>
          <select
            name='parentTaskId'
            value={parentTaskId}
            onChange={e => setParentTaskId(e.target.value)}
            disabled={loadingTasks}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: loadingTasks ? '#f5f5f5' : 'white',
              cursor: loadingTasks ? 'not-allowed' : 'pointer',
            }}
          >
            <option value=''>-- Select Parent Task (Optional) --</option>
            {availableTasks.map(task => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
          <small style={{ color: '#666', fontSize: '0.875rem' }}>
            {loadingTasks
              ? 'Loading your tasks...'
              : 'Leave empty for top-level task. Maximum 2 levels of nesting.'}
          </small>
        </div>

        {/* Recurring Interval - Optional (hidden for subtasks) */}
        {!parentTaskId && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '500',
              }}
            >
              Recurring Interval (Optional)
            </label>
            <input
              data-testid='recurring-interval-input'
              type='number'
              value={recurringInterval}
              onChange={e =>
                setRecurringInterval(
                  e.target.value ? Number(e.target.value) : ''
                )
              }
              min={1}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
              placeholder='Number of days (e.g., 7 for weekly)'
            />
            <small style={{ color: '#666', fontSize: '0.875rem' }}>
              Leave empty for one-time task. Enter number of days for recurring
              tasks.
            </small>
          </div>
        )}
        {parentTaskId && (
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '0.75rem',
              backgroundColor: '#e3f2fd',
              border: '1px solid #2196f3',
              borderRadius: '4px',
            }}
          >
            <small style={{ color: '#1976d2', fontSize: '0.875rem' }}>
              ℹ️ Note: Subtasks cannot be set as recurring tasks.
            </small>
          </div>
        )}

        {/* File Attachments - Optional */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            File Attachments (Optional)
          </label>
          <input
            type='file'
            multiple
            onChange={e => {
              const files = Array.from(e.target.files || []);
              // Validate file sizes and types
              const validFiles = files.filter(file => {
                const MAX_SIZE = 10 * 1024 * 1024; // 10MB
                if (file.size > MAX_SIZE) {
                  setError(`File ${file.name} exceeds 10MB limit`);
                  return false;
                }
                return true;
              });
              setSelectedFiles(validFiles);
              setError(null);
            }}
            accept='.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.txt,.zip'
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
          <small style={{ color: '#666', fontSize: '0.875rem' }}>
            Max 10MB per file. Allowed: PDF, images, Word, Excel, text, ZIP
          </small>
          {selectedFiles.length > 0 && (
            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.875rem',
                color: '#4a5568',
              }}
            >
              {selectedFiles.length} file(s) selected:{' '}
              {selectedFiles.map(f => f.name).join(', ')}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: '1rem',
              marginBottom: '1rem',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c00',
            }}
          >
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div
            style={{
              padding: '1rem',
              marginBottom: '1rem',
              backgroundColor: '#efe',
              border: '1px solid #cfc',
              borderRadius: '4px',
              color: '#0c0',
            }}
          >
            Task created successfully! It will appear in your dashboard
            immediately.
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            data-testid='create-task-submit-button'
            type='submit'
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Creating...' : 'Create Task'}
          </button>

          {onCancel && (
            <button
              data-testid='create-task-cancel-button'
              type='button'
              onClick={onCancel}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'white',
                color: '#666',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* File Upload Note */}
      <div
        style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#f0f8ff',
          borderRadius: '4px',
          fontSize: '0.875rem',
          color: '#0066cc',
        }}
      >
        <strong>📎 File Attachments:</strong> After creating the task, you can
        upload files using the file upload section on the task detail page.
      </div>
    </div>
  );
}
