'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { useNotifications } from '@/lib/context/NotificationContext';

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (taskId: string) => void;
}

/**
 * Task Creation Modal Component - SCRUM-31
 *
 * Reusable modal component for creating tasks with styling consistent with TaskCard modal.
 * Automatically assigns the current user as an assignee.
 * Matches TaskCard's UI patterns for inputs, assignees, tags, recurring settings, and file attachments.
 *
 * Features:
 * - Project dropdown for assignment (can select none or 1 project)
 * - Assignee dropdown showing user name and email
 * - Real-time notification on successful creation
 */
export function TaskCreateModal({
  isOpen,
  onClose,
  onSuccess,
}: TaskCreateModalProps) {
  const { user, userProfile } = useAuth();
  const { addNotification } = useNotifications();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(5);
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]); // Selected user IDs
  const [assigneeEmails, setAssigneeEmails] = useState<string[]>([]); // For backward compatibility
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [projectId, setProjectId] = useState('');
  const [parentTaskId, setParentTaskId] = useState('');
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<number | ''>('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  // Available projects for dropdown (SCRUM-31)
  const [availableProjects, setAvailableProjects] = useState<
    Array<{
      id: string;
      name: string;
    }>
  >([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Available users for assignee dropdown (SCRUM-31)
  const [availableUsers, setAvailableUsers] = useState<
    Array<{
      id: string;
      name: string;
      email: string;
    }>
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [totalSize, setTotalSize] = useState(0);

  // Auto-assign current user when modal opens
  useEffect(() => {
    if (isOpen && userProfile?.id && !assigneeIds.includes(userProfile.id)) {
      setAssigneeIds([userProfile.id]);
      // For backward compatibility
      if (userProfile?.email && !assigneeEmails.includes(userProfile.email)) {
        setAssigneeEmails([userProfile.email]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userProfile?.id]);

  // Fetch available projects (SCRUM-31)
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    async function fetchProjects() {
      setLoadingProjects(true);
      try {
        const response = await fetch('/api/trpc/project.getAll');
        const data = await response.json();

        if (data.result?.data) {
          setAvailableProjects(data.result.data);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoadingProjects(false);
      }
    }

    fetchProjects();
  }, [isOpen]);

  // Fetch available users for assignee dropdown (SCRUM-31)
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    async function fetchUsers() {
      setLoadingUsers(true);
      try {
        const response = await fetch('/api/trpc/userProfile.getAll');
        const data = await response.json();

        if (data.result?.data) {
          setAvailableUsers(data.result.data);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoadingUsers(false);
      }
    }

    fetchUsers();
  }, [isOpen]);

  // Fetch user's tasks for parent task selector
  useEffect(() => {
    async function fetchTasks() {
      if (!userProfile || !isOpen) {
        return;
      }

      try {
        const response = await fetch(
          `/api/trpc/task.getByOwner?input=${encodeURIComponent(JSON.stringify({ ownerId: userProfile.id }))}`
        );
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
          const parentTasks = tasks.filter((t: TaskData) => !t.parentTaskId);
          setAvailableTasks(
            parentTasks.map((t: TaskData) => ({
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

    if (isOpen) {
      fetchTasks();
    }
  }, [userProfile, isOpen]);

  // Helper function to remove assignee
  const handleRemoveAssignee = (userId: string) => {
    if (assigneeIds.length <= 1) {
      setError('❌ At least 1 assignee is required');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Remove from assignee IDs
    setAssigneeIds(assigneeIds.filter(id => id !== userId));

    // Update email list for backward compatibility
    const user = availableUsers.find(u => u.id === userId);
    if (user) {
      setAssigneeEmails(assigneeEmails.filter(e => e !== user.email));
    }

    setSuccess(`✅ Removed assignee`);
    setTimeout(() => setSuccess(null), 2000);
  };

  // Helper function to add tag
  const handleAddTag = () => {
    const tag = newTag.trim();
    if (!tag) {
      return;
    }

    if (tags.includes(tag)) {
      setError('❌ Tag already added');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setTags([...tags, tag]);
    setNewTag('');
  };

  // Helper function to remove tag
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  // File selection handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) {
      return;
    }

    const file = files[0];
    setSelectedFile(file);
    setError(null);

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      setError(
        `❌ File exceeds 10MB limit: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
      );
      setSelectedFile(null);
      return;
    }

    const ALLOWED_TYPES = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
    ];

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`❌ File type "${file.type}" not allowed`);
      setSelectedFile(null);
    }
  };

  const handleAddFile = () => {
    if (!selectedFile) {
      return;
    }

    const newTotalSize = totalSize + selectedFile.size;
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total

    if (newTotalSize > MAX_TOTAL_SIZE) {
      setError(
        `❌ Total file size would exceed 50MB limit. Current: ${(totalSize / (1024 * 1024)).toFixed(2)}MB, Adding: ${(selectedFile.size / (1024 * 1024)).toFixed(2)}MB`
      );
      setTimeout(() => setError(null), 5000);
      return;
    }

    setSelectedFiles([...selectedFiles, selectedFile]);
    setTotalSize(newTotalSize);
    setSelectedFile(null);
    setSuccess(`✅ File "${selectedFile.name}" added`);
    setTimeout(() => setSuccess(null), 2000);

    // Reset file input
    const fileInput = document.getElementById(
      'file-input-create-modal'
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    const fileName = selectedFiles[index].name;
    const fileSize = selectedFiles[index].size;
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    setTotalSize(totalSize - fileSize);
    setSuccess(`✅ File "${fileName}" removed`);
    setTimeout(() => setSuccess(null), 2000);
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setPriority(5);
      setDueDate('');
      setAssigneeIds(userProfile?.id ? [userProfile.id] : []);
      setAssigneeEmails(userProfile?.email ? [userProfile.email] : []);
      setTags([]);
      setNewTag('');
      setProjectId('');
      setParentTaskId('');
      setRecurringEnabled(false);
      setRecurringInterval('');
      setSelectedFile(null);
      setSelectedFiles([]);
      setTotalSize(0);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, userProfile?.email, userProfile?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!userProfile) {
      setError('❌ User profile not loaded');
      return;
    }

    // Validate assignees (1-5) - using assigneeIds now
    if (assigneeIds.length < 1) {
      setError('❌ At least 1 assignee is required');
      return;
    }

    if (assigneeIds.length > 5) {
      setError('❌ Maximum 5 assignees allowed');
      return;
    }

    // Validate subtask due date
    if (parentTaskId) {
      const parentTask = availableTasks.find(t => t.id === parentTaskId);
      if (parentTask) {
        const parentDueDate = new Date(parentTask.dueDate);
        const subtaskDueDate = new Date(dueDate);

        if (subtaskDueDate > parentDueDate) {
          setError(
            `❌ Subtask due date cannot be later than parent task due date (${parentDueDate.toLocaleDateString()})`
          );
          return;
        }
      }
    }

    // Validate priority
    if (priority < 1 || priority > 10) {
      setError('❌ Priority must be between 1 and 10');
      return;
    }

    setLoading(true);

    try {
      // Use assigneeIds directly from dropdown selection (SCRUM-31)
      // No need to look up emails anymore since we already have user IDs

      // Step 2: Create task or subtask
      const tagList = tags.filter(t => t.trim().length > 0);

      const isSubtask = !!parentTaskId;
      const endpoint = isSubtask
        ? '/api/trpc/task.createSubtask'
        : '/api/trpc/task.create';

      const taskData = isSubtask
        ? {
            title: title.trim(),
            description: description.trim(),
            priority,
            dueDate: new Date(dueDate).toISOString(),
            assigneeIds,
            parentTaskId,
            ...(tagList.length > 0 && { tags: tagList }),
          }
        : {
            title: title.trim(),
            description: description.trim(),
            priority,
            dueDate: new Date(dueDate).toISOString(),
            ownerId: userProfile.id,
            assigneeIds,
            ...(tagList.length > 0 && { tags: tagList }),
            ...(projectId && { projectId }),
            ...(recurringEnabled &&
              recurringInterval && {
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

      // Step 3: Upload files if any were selected
      if (selectedFiles.length > 0 && createdTask?.id) {
        for (const file of selectedFiles) {
          try {
            const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = e =>
                resolve((e.target?.result as string).split(',')[1]);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

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
          }
        }
      }

      setSuccess('✅ Task created successfully!');
      setError(null);

      // Show notification (SCRUM-31) - 5 second timeout
      addNotification(
        'success',
        'Task Created Successfully',
        `Task "${title}" has been created`,
        5000
      );

      if (onSuccess && createdTask?.id) {
        onSuccess(createdTask.id);
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Task creation error:', err);
      setError(
        err instanceof Error ? `❌ ${err.message}` : '❌ Failed to create task'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !user || !userProfile) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
          maxWidth: '900px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid #e5e7eb',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            padding: '0.5rem',
            backgroundColor: '#e2e8f0',
            color: '#4a5568',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '1.5rem',
            lineHeight: 1,
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>

        {/* Error/Success Messages */}
        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#fee',
              color: '#c00',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#efe',
              color: '#070',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            {success}
          </div>
        )}

        {/* Title */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              margin: '0 0 1rem 0',
              color: '#1a202c',
            }}
          >
            Create New Task
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Title - Mandatory */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                margin: '0 0 8px 0',
              }}
            >
              Title <span style={{ color: 'red' }}>*</span>
            </h3>
            <input
              type='text'
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '1rem',
                border: '2px solid #e5e7eb',
                borderRadius: '4px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              placeholder='e.g., Implement login feature'
            />
          </div>

          {/* Description - Mandatory */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                margin: '0 0 8px 0',
              }}
            >
              Description <span style={{ color: 'red' }}>*</span>
            </h3>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              rows={4}
              style={{
                width: '100%',
                padding: '8px',
                border: '2px solid #e5e7eb',
                borderRadius: '4px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              placeholder='Detailed description of the task...'
            />
          </div>

          {/* Priority and Deadline - Grid Layout */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2rem',
              marginBottom: '1.5rem',
            }}
          >
            {/* Priority */}
            <div>
              <div
                style={{
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  marginBottom: '8px',
                }}
              >
                Priority (1-10) <span style={{ color: 'red' }}>*</span>
              </div>
              <input
                type='number'
                value={priority}
                onChange={e => setPriority(Number(e.target.value))}
                min={1}
                max={10}
                required
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
              <small style={{ color: '#666', fontSize: '0.875rem' }}>
                1 = Low, 5 = Medium, 10 = High
              </small>
            </div>

            {/* Due Date */}
            <div>
              <div
                style={{
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  marginBottom: '8px',
                }}
              >
                Deadline <span style={{ color: 'red' }}>*</span>
              </div>
              <input
                type='date'
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Assignees - Mandatory (1-5) */}
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: '#fef2f2',
              borderRadius: '8px',
            }}
          >
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                marginBottom: '12px',
              }}
            >
              👥 Assigned Staff ({assigneeIds.length}/5){' '}
              <span style={{ color: 'red' }}>*</span>
            </h3>

            {/* Current Assignees Display */}
            <div style={{ marginBottom: '1rem' }}>
              {assigneeIds.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: '#666' }}>
                  No assignees yet.
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    marginBottom: '12px',
                  }}
                >
                  {assigneeIds.map(userId => {
                    const user = availableUsers.find(u => u.id === userId);
                    const isCurrentUser = userId === userProfile?.id;
                    return (
                      <div
                        key={userId}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: isCurrentUser
                            ? '#fef3c7'
                            : '#dcfce7',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          color: isCurrentUser ? '#92400e' : '#166534',
                          border: isCurrentUser ? '1px solid #f59e0b' : 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>
                          {isCurrentUser ? '👑' : '👤'}{' '}
                          {user?.name || 'Unknown'} ({user?.email || 'Unknown'})
                          {isCurrentUser && (
                            <span
                              style={{
                                marginLeft: '8px',
                                padding: '2px 6px',
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                borderRadius: '3px',
                                fontSize: '11px',
                                fontWeight: '600',
                              }}
                            >
                              YOU
                            </span>
                          )}
                        </span>
                        {assigneeIds.length > 1 && (
                          <button
                            onClick={() => handleRemoveAssignee(userId)}
                            type='button'
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '600',
                            }}
                            title='Remove assignee'
                          >
                            ✕ Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Assignee Interface - Dropdown */}
            {assigneeIds.length < 5 ? (
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#7c2d12',
                    marginBottom: '8px',
                  }}
                >
                  💡 Select user to add as assignee • Max 5 total
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value=''
                    onChange={e => {
                      const userId = e.target.value;
                      if (userId && !assigneeIds.includes(userId)) {
                        if (assigneeIds.length >= 5) {
                          alert('Maximum 5 assignees allowed per task');
                          return;
                        }
                        setAssigneeIds([...assigneeIds, userId]);
                        // Update email list for backward compatibility
                        const user = availableUsers.find(u => u.id === userId);
                        if (user) {
                          setAssigneeEmails([...assigneeEmails, user.email]);
                        }
                      }
                    }}
                    disabled={loadingUsers}
                    style={{
                      flex: 1,
                      padding: '6px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                      cursor: loadingUsers ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <option value=''>
                      {loadingUsers
                        ? 'Loading users...'
                        : '-- Select User to Add --'}
                    </option>
                    {availableUsers
                      .filter(user => !assigneeIds.includes(user.id))
                      .map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '8px',
                  backgroundColor: '#fee2e2',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  color: '#991b1b',
                  textAlign: 'center',
                }}
              >
                ⚠️ Maximum 5 assignees reached
              </div>
            )}
          </div>

          {/* Tags - Optional */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                marginBottom: '8px',
              }}
            >
              🏷️ Tags (Optional)
            </h3>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              {tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#e3f2fd',
                    color: '#1976d2',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {tag}
                  <button
                    type='button'
                    onClick={() => handleRemoveTag(tag)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#c00',
                      cursor: 'pointer',
                      padding: '0 2px',
                      fontSize: '14px',
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type='text'
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyPress={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder='Add tag...'
                style={{
                  flex: 1,
                  padding: '6px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '4px',
                }}
              />
              <button
                type='button'
                onClick={handleAddTag}
                disabled={!newTag.trim()}
                style={{
                  padding: '6px 12px',
                  backgroundColor: !newTag.trim() ? '#9ca3af' : '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: !newTag.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                Add Tag
              </button>
            </div>
          </div>

          {/* Project and Parent Task - Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2rem',
              marginBottom: '1.5rem',
            }}
          >
            {/* Project - Optional (SCRUM-31) */}
            <div>
              <div
                style={{
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  marginBottom: '8px',
                }}
              >
                🗂️ Project (Optional)
              </div>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                disabled={loadingProjects}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  cursor: loadingProjects ? 'not-allowed' : 'pointer',
                }}
              >
                <option value=''>
                  {loadingProjects
                    ? 'Loading projects...'
                    : '-- No Project (Standalone Task) --'}
                </option>
                {availableProjects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Parent Task - Optional */}
            <div>
              <div
                style={{
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  marginBottom: '8px',
                }}
              >
                Parent Task (Optional)
              </div>
              <select
                value={parentTaskId}
                onChange={e => setParentTaskId(e.target.value)}
                disabled={loadingTasks}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  backgroundColor: loadingTasks ? '#f5f5f5' : 'white',
                  cursor: loadingTasks ? 'not-allowed' : 'pointer',
                }}
              >
                <option value=''>-- Select Parent Task --</option>
                {availableTasks.map(task => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
              <small style={{ color: '#666', fontSize: '0.875rem' }}>
                {loadingTasks ? 'Loading...' : 'For subtasks only'}
              </small>
            </div>
          </div>

          {/* Recurring Settings */}
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
            }}
          >
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                margin: '0 0 8px 0',
              }}
            >
              🔄 Recurring Settings
            </h3>
            {!parentTaskId ? (
              <div>
                <label style={{ display: 'block', marginBottom: '8px' }}>
                  <input
                    type='checkbox'
                    checked={recurringEnabled}
                    onChange={e => setRecurringEnabled(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  Enable recurring task
                </label>
                {recurringEnabled && (
                  <div style={{ marginBottom: '8px' }}>
                    <label
                      style={{
                        fontSize: '0.875rem',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Repeat every (days):
                    </label>
                    <input
                      type='number'
                      min='1'
                      value={recurringInterval}
                      onChange={e =>
                        setRecurringInterval(
                          e.target.value ? Number(e.target.value) : ''
                        )
                      }
                      placeholder='e.g., 7'
                      style={{
                        padding: '6px',
                        border: '2px solid #0284c7',
                        borderRadius: '4px',
                        width: '150px',
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.875rem', color: '#0369a1' }}>
                ℹ️ Note: Subtasks cannot be set as recurring tasks.
              </div>
            )}
          </div>

          {/* File Attachments */}
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
            }}
          >
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                marginBottom: '12px',
              }}
            >
              📎 File Attachments (Optional)
            </h3>

            {/* Upload Section */}
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor='file-input-create-modal'
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  backgroundColor: selectedFile ? '#28a745' : '#f59e0b',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {selectedFile ? `✓ ${selectedFile.name}` : '📁 Choose File'}
              </label>
              <input
                id='file-input-create-modal'
                type='file'
                onChange={handleFileSelect}
                accept='.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.zip'
                style={{ display: 'none' }}
              />
              {selectedFile && (
                <button
                  type='button'
                  onClick={handleAddFile}
                  style={{
                    marginLeft: '8px',
                    padding: '8px 16px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  ➕ Add File
                </button>
              )}
            </div>

            {/* Storage Usage - Always Visible */}
            <div style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  marginBottom: '4px',
                }}
              >
                <span>Storage Usage:</span>
                <span
                  style={{
                    fontWeight: '600',
                    color:
                      selectedFiles.reduce((sum, f) => sum + f.size, 0) >
                      50 * 1024 * 1024
                        ? '#dc3545'
                        : '#28a745',
                  }}
                >
                  {(
                    selectedFiles.reduce((sum, f) => sum + f.size, 0) /
                    (1024 * 1024)
                  ).toFixed(2)}{' '}
                  MB / 50 MB
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min((selectedFiles.reduce((sum, f) => sum + f.size, 0) / (50 * 1024 * 1024)) * 100, 100)}%`,
                    height: '100%',
                    backgroundColor:
                      selectedFiles.reduce((sum, f) => sum + f.size, 0) >
                      50 * 1024 * 1024
                        ? '#dc3545'
                        : selectedFiles.reduce((sum, f) => sum + f.size, 0) >
                            40 * 1024 * 1024
                          ? '#ffc107'
                          : '#28a745',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {/* File List */}
            <div
              style={{
                fontSize: '12px',
                color: '#92400e',
                marginBottom: '8px',
              }}
            >
              💡 Max 10MB per file • 50MB total • PDF, images, docs,
              spreadsheets
            </div>

            {selectedFiles.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#666' }}>
                No files selected yet.
              </p>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px',
                      backgroundColor: '#fff',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span>
                      📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type='button'
                      onClick={() => handleRemoveFile(index)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px',
                      }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div
            style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}
          >
            <button
              type='button'
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '600',
              }}
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: loading ? '#9ca3af' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '600',
              }}
            >
              {loading ? '⏳ Creating...' : '✓ Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
