'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';

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

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(5);
  const [dueDate, setDueDate] = useState('');
  const [assigneeEmails, setAssigneeEmails] = useState<string>(''); // Comma-separated emails
  const [tags, setTags] = useState<string>(''); // Comma-separated tags
  const [projectId, setProjectId] = useState('');
  const [parentTaskId, setParentTaskId] = useState('');
  const [recurringInterval, setRecurringInterval] = useState<number | ''>('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!userProfile) {
      setError('User profile not loaded');
      return;
    }

    // Validate assignees (1-5)
    const assigneeList = assigneeEmails
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);

    if (assigneeList.length < 1) {
      setError('At least 1 assignee is required');
      return;
    }

    if (assigneeList.length > 5) {
      setError('Maximum 5 assignees allowed');
      return;
    }

    // Validate priority
    if (priority < 1 || priority > 10) {
      setError('Priority must be between 1 and 10');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Look up assignee user IDs from emails
      const assigneeIdsResponse = await fetch(
        '/api/trpc/userProfile.findByEmails',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: assigneeList }),
        }
      );

      if (!assigneeIdsResponse.ok) {
        throw new Error('Failed to lookup assignee emails');
      }

      const assigneeData = await assigneeIdsResponse.json();
      const assigneeIds = assigneeData.result?.data || [];

      if (assigneeIds.length !== assigneeList.length) {
        setError(
          `Some assignee emails not found. Found ${assigneeIds.length} out of ${assigneeList.length}`
        );
        setLoading(false);
        return;
      }

      // Step 2: Create task
      const tagList = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const taskData = {
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: new Date(dueDate),
        assigneeIds,
        ...(tagList.length > 0 && { tags: tagList }),
        ...(projectId && { projectId }),
        ...(parentTaskId && { parentTaskId }),
        ...(recurringInterval && {
          recurringInterval: Number(recurringInterval),
        }),
      };

      const response = await fetch('/api/trpc/task.create', {
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

      setSuccess(true);
      setError(null);

      // Reset form
      setTitle('');
      setDescription('');
      setPriority(5);
      setDueDate('');
      setAssigneeEmails('');
      setTags('');
      setProjectId('');
      setParentTaskId('');
      setRecurringInterval('');

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
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            Title <span style={{ color: 'red' }}>*</span>
          </label>
          <input
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
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            Description <span style={{ color: 'red' }}>*</span>
          </label>
          <textarea
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
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            Priority (1-10) <span style={{ color: 'red' }}>*</span>
          </label>
          <input
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
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            Deadline <span style={{ color: 'red' }}>*</span>
          </label>
          <input
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

        {/* Assignees - Mandatory (1-5) */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
            }}
          >
            Assignee Emails (1-5) <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type='text'
            value={assigneeEmails}
            onChange={e => setAssigneeEmails(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
            placeholder='user1@example.com, user2@example.com'
          />
          <small style={{ color: '#666', fontSize: '0.875rem' }}>
            Comma-separated emails (minimum 1, maximum 5)
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

        {/* Project - Optional */}
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
          <input
            type='text'
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
            placeholder='Project ID (leave empty for standalone task)'
          />
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
          <input
            type='text'
            value={parentTaskId}
            onChange={e => setParentTaskId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
            placeholder='Parent Task ID (max 2 levels)'
          />
          <small style={{ color: '#666', fontSize: '0.875rem' }}>
            Leave empty for top-level task. Maximum 2 levels of nesting.
          </small>
        </div>

        {/* Recurring Interval - Optional */}
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
            type='number'
            value={recurringInterval}
            onChange={e =>
              setRecurringInterval(e.target.value ? Number(e.target.value) : '')
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

      {/* Department Info */}
      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#f9f9f9',
          borderRadius: '4px',
          fontSize: '0.875rem',
          color: '#666',
        }}
      >
        <strong>Department:</strong> Task will be automatically associated with
        your department ({userProfile.departmentId})
      </div>

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
