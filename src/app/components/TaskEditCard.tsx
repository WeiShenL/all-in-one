'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  priorityBucket: number;
  dueDate: string;
  isRecurring: boolean;
  recurringInterval: number | null;
  assignments: string[];
  tags: string[];
  comments: Array<{
    id: string;
    content: string;
    authorId: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

interface UploadedFile {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedById: string;
  uploadedAt: string;
}

export function TaskEditCard({ taskId }: { taskId: string }) {
  const { userProfile } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit states
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [editingPriority, setEditingPriority] = useState(false);
  const [priorityValue, setPriorityValue] = useState(5);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState('');
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusValue, setStatusValue] = useState<Task['status']>('TO_DO');
  const [editingRecurring, setEditingRecurring] = useState(false);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<number | null>(
    null
  );
  const [newTag, setNewTag] = useState('');
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentValue, setEditCommentValue] = useState('');

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [totalSize, setTotalSize] = useState(0);

  // Assignee management states (AC7 - TM015: can add but NOT remove)
  const [newAssigneeEmail, setNewAssigneeEmail] = useState('');
  const [addingAssignee, setAddingAssignee] = useState(false);
  const [userDetailsMap, setUserDetailsMap] = useState<
    Map<string, { name: string; email: string }>
  >(new Map());

  useEffect(() => {
    fetchTask();
    fetchFiles();
    fetchDepartmentUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const fetchTask = async () => {
    if (!userProfile) {
      return;
    }

    try {
      const response = await fetch(
        `/api/trpc/task.getById?input=${encodeURIComponent(
          JSON.stringify({ taskId })
        )}`
      );
      const data = await response.json();

      if (data.result?.data) {
        setTask(data.result.data);
        setTitleValue(data.result.data.title);
        setDescriptionValue(data.result.data.description);
        setPriorityValue(data.result.data.priorityBucket);
        setDeadlineValue(data.result.data.dueDate.split('T')[0]);
        setStatusValue(data.result.data.status);
        setRecurringEnabled(data.result.data.isRecurring);
        setRecurringInterval(data.result.data.recurringInterval);
      }
    } catch {
      setError('Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    if (!userProfile) {
      return;
    }

    try {
      const response = await fetch(
        `/api/trpc/taskFile.getTaskFiles?input=${encodeURIComponent(
          JSON.stringify({
            taskId,
            userId: userProfile.id,
            userRole: userProfile.role,
            departmentId: userProfile.departmentId,
          })
        )}`
      );
      const data = await response.json();

      if (data.result?.data?.files) {
        setUploadedFiles(data.result.data.files);
        setTotalSize(data.result.data.totalSize || 0);
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchDepartmentUsers = async () => {
    if (!userProfile) {
      return;
    }

    try {
      const response = await fetch(
        `/api/trpc/userProfile.getByDepartment?input=${encodeURIComponent(
          JSON.stringify({ departmentId: userProfile.departmentId })
        )}`
      );
      const data = await response.json();

      if (data.result?.data) {
        const userMap = new Map<string, { name: string; email: string }>();
        data.result.data.forEach(
          (user: { id: string; name: string; email: string }) => {
            userMap.set(user.id, { name: user.name, email: user.email });
          }
        );
        setUserDetailsMap(userMap);
      }
    } catch (err) {
      console.error('Failed to fetch department users:', err);
    }
  };

  const updateTask = async (
    endpoint: string,
    payload: any,
    successMsg: string
  ) => {
    if (!userProfile) {
      return;
    }

    try {
      const response = await fetch(`/api/trpc/task.${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Update failed');
      }

      setSuccess(successMsg);
      await fetchTask();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleUpdateTitle = async () => {
    await updateTask(
      'updateTitle',
      { taskId, title: titleValue },
      '✅ Title updated'
    );
    setEditingTitle(false);
  };

  const handleUpdateDescription = async () => {
    await updateTask(
      'updateDescription',
      { taskId, description: descriptionValue },
      '✅ Description updated'
    );
    setEditingDescription(false);
  };

  const handleUpdatePriority = async () => {
    await updateTask(
      'updatePriority',
      { taskId, priority: priorityValue },
      '✅ Priority updated'
    );
    setEditingPriority(false);
  };

  const handleUpdateDeadline = async () => {
    await updateTask(
      'updateDeadline',
      { taskId, deadline: new Date(deadlineValue).toISOString() },
      '✅ Deadline updated'
    );
    setEditingDeadline(false);
  };

  const handleUpdateStatus = async () => {
    await updateTask(
      'updateStatus',
      { taskId, status: statusValue },
      '✅ Status updated'
    );
    setEditingStatus(false);
  };

  const handleUpdateRecurring = async () => {
    await updateTask(
      'updateRecurring',
      { taskId, enabled: recurringEnabled, recurringInterval },
      '✅ Recurring settings updated'
    );
    setEditingRecurring(false);
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) {
      return;
    }
    await updateTask('addTag', { taskId, tag: newTag }, '✅ Tag added');
    setNewTag('');
  };

  const handleRemoveTag = async (tag: string) => {
    await updateTask('removeTag', { taskId, tag }, '✅ Tag removed');
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      return;
    }
    await updateTask(
      'addComment',
      { taskId, content: newComment },
      '✅ Comment added'
    );
    setNewComment('');
  };

  const handleUpdateComment = async (commentId: string) => {
    await updateTask(
      'updateComment',
      { taskId, commentId, content: editCommentValue },
      '✅ Comment updated'
    );
    setEditingCommentId(null);
    setEditCommentValue('');
  };

  // AC7: Add assignee by email (max 5, cannot remove - TM015)
  const handleAddAssignee = async () => {
    if (!newAssigneeEmail.trim() || !userProfile) {
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAssigneeEmail.trim())) {
      setError('Invalid email format');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Check max 5 limit (TM023)
    if (task && task.assignments.length >= 5) {
      setError('Maximum 5 assignees allowed');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setAddingAssignee(true);
    setError(null);

    try {
      // Step 1: Look up user ID from email
      const lookupResponse = await fetch('/api/trpc/userProfile.findByEmails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: [newAssigneeEmail.trim()] }),
      });

      if (!lookupResponse.ok) {
        throw new Error('Failed to find user by email');
      }

      const lookupData = await lookupResponse.json();
      const userIds = lookupData.result?.data || [];

      if (userIds.length === 0) {
        setError(`User with email "${newAssigneeEmail.trim()}" not found`);
        setAddingAssignee(false);
        setTimeout(() => setError(null), 3000);
        return;
      }

      const newUserId = userIds[0];

      // Check if already assigned
      if (task && task.assignments.includes(newUserId)) {
        setError('User is already assigned to this task');
        setAddingAssignee(false);
        setTimeout(() => setError(null), 3000);
        return;
      }

      // Step 2: Add assignee via API
      const addResponse = await fetch('/api/trpc/task.addAssignee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          userId: newUserId,
        }),
      });

      if (!addResponse.ok) {
        const errorData = await addResponse.json();
        throw new Error(errorData.error?.message || 'Failed to add assignee');
      }

      setSuccess(`✅ Assignee "${newAssigneeEmail.trim()}" added`);
      setNewAssigneeEmail('');
      await fetchTask(); // Refresh task data

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add assignee');
      setTimeout(() => setError(null), 5000);
    } finally {
      setAddingAssignee(false);
    }
  };

  // File upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setError(null);

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(
        `File exceeds 10MB limit: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
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
      setError(`File type "${file.type}" not allowed`);
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !userProfile) {
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      setUploadProgress(20);

      const reader = new FileReader();
      reader.onload = async event => {
        try {
          const base64Data = event.target?.result as string;
          const base64Content = base64Data.split(',')[1];

          setUploadProgress(40);

          const response = await fetch('/api/trpc/taskFile.uploadFile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId,
              fileName: selectedFile.name,
              fileType: selectedFile.type,
              fileData: base64Content,
              userId: userProfile.id,
              userRole: userProfile.role,
              departmentId: userProfile.departmentId,
            }),
          });

          setUploadProgress(80);

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Upload failed');
          }

          setUploadProgress(100);
          setSuccess(`✅ File "${selectedFile.name}" uploaded`);
          setSelectedFile(null);
          setUploading(false);

          await fetchFiles();

          setTimeout(() => {
            setSuccess(null);
            setUploadProgress(0);
          }, 3000);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed');
          setUploading(false);
          setUploadProgress(0);
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setUploading(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!userProfile) {
      return;
    }
    if (!confirm(`Delete "${fileName}"?`)) {
      return;
    }

    try {
      const response = await fetch('/api/trpc/taskFile.deleteFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          userId: userProfile.id,
          userRole: userProfile.role,
          departmentId: userProfile.departmentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      setSuccess(`✅ File "${fileName}" deleted`);
      await fetchFiles();

      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Failed to delete file');
    }
  };

  const handleDownloadFile = async (fileId: string, _fileName: string) => {
    if (!userProfile) {
      return;
    }

    try {
      const response = await fetch(
        `/api/trpc/taskFile.getFileDownloadUrl?input=${encodeURIComponent(
          JSON.stringify({
            fileId,
            userId: userProfile.id,
            userRole: userProfile.role,
            departmentId: userProfile.departmentId,
          })
        )}`
      );
      const data = await response.json();

      if (data.result?.data?.downloadUrl) {
        window.open(data.result.data.downloadUrl, '_blank');
      }
    } catch {
      setError('Failed to download file');
    }
  };

  if (loading) {
    return <div className='p-4'>Loading task...</div>;
  }
  if (!task) {
    return <div className='p-4'>Task not found</div>;
  }
  if (!userProfile) {
    return <div className='p-4'>Please login</div>;
  }

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
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
          ❌ {error}
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
        {editingTitle ? (
          <div>
            <input
              type='text'
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '1.25rem',
                fontWeight: '600',
                border: '2px solid #4a90e2',
                borderRadius: '4px',
              }}
            />
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={handleUpdateTitle}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  marginRight: '8px',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingTitle(false)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                margin: 0,
                color: '#1a202c',
              }}
            >
              {task.title}
            </h2>
            <button
              data-testid='title-edit-button'
              onClick={() => setEditingTitle(true)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#e3f2fd',
                color: '#1976d2',
                border: '1px solid #1976d2',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ✏️ Edit
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600', margin: 0 }}>
            Description
          </h3>
          {!editingDescription && (
            <button
              data-testid='description-edit-button'
              onClick={() => setEditingDescription(true)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#e3f2fd',
                color: '#1976d2',
                border: '1px solid #1976d2',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ✏️ Edit
            </button>
          )}
        </div>
        {editingDescription ? (
          <div>
            <textarea
              value={descriptionValue}
              onChange={e => setDescriptionValue(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: '8px',
                border: '2px solid #4a90e2',
                borderRadius: '4px',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={handleUpdateDescription}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  marginRight: '8px',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingDescription(false)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p style={{ color: '#4a5568', whiteSpace: 'pre-wrap' }}>
            {task.description}
          </p>
        )}
      </div>

      {/* Status, Priority, Deadline - In a Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Status */}
        <div>
          <div
            style={{
              fontWeight: '600',
              fontSize: '0.875rem',
              marginBottom: '8px',
            }}
          >
            Status
          </div>
          {editingStatus ? (
            <div>
              <select
                value={statusValue}
                onChange={e => setStatusValue(e.target.value as Task['status'])}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '2px solid #4a90e2',
                  borderRadius: '4px',
                }}
              >
                <option value='TO_DO'>To Do</option>
                <option value='IN_PROGRESS'>In Progress</option>
                <option value='COMPLETED'>Completed</option>
                <option value='BLOCKED'>Blocked</option>
              </select>
              <div style={{ marginTop: '4px' }}>
                <button
                  onClick={handleUpdateStatus}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    marginRight: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingStatus(false)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <span
                style={{
                  padding: '4px 12px',
                  backgroundColor:
                    task.status === 'COMPLETED'
                      ? '#d4edda'
                      : task.status === 'IN_PROGRESS'
                        ? '#cce5ff'
                        : task.status === 'BLOCKED'
                          ? '#f8d7da'
                          : '#e2e3e5',
                  color:
                    task.status === 'COMPLETED'
                      ? '#155724'
                      : task.status === 'IN_PROGRESS'
                        ? '#004085'
                        : task.status === 'BLOCKED'
                          ? '#721c24'
                          : '#383d41',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                {task.status.replace('_', ' ')}
              </span>
              <button
                data-testid='status-edit-button'
                onClick={() => setEditingStatus(true)}
                style={{
                  marginLeft: '8px',
                  padding: '2px 6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✏️
              </button>
            </div>
          )}
        </div>

        {/* Priority */}
        <div>
          <div
            style={{
              fontWeight: '600',
              fontSize: '0.875rem',
              marginBottom: '8px',
            }}
          >
            Priority (1-10)
          </div>
          {editingPriority ? (
            <div>
              <input
                type='number'
                min='1'
                max='10'
                value={priorityValue}
                onChange={e => setPriorityValue(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '2px solid #4a90e2',
                  borderRadius: '4px',
                }}
              />
              <div style={{ marginTop: '4px' }}>
                <button
                  onClick={handleUpdatePriority}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    marginRight: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingPriority(false)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <span
                data-testid='priority-value'
                style={{
                  padding: '4px 12px',
                  backgroundColor:
                    task.priorityBucket >= 8
                      ? '#f8d7da'
                      : task.priorityBucket >= 5
                        ? '#fff3cd'
                        : '#d4edda',
                  color:
                    task.priorityBucket >= 8
                      ? '#721c24'
                      : task.priorityBucket >= 5
                        ? '#856404'
                        : '#155724',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                {task.priorityBucket}
              </span>
              <button
                data-testid='priority-edit-button'
                onClick={() => setEditingPriority(true)}
                style={{
                  marginLeft: '8px',
                  padding: '2px 6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✏️
              </button>
            </div>
          )}
        </div>

        {/* Deadline */}
        <div>
          <div
            style={{
              fontWeight: '600',
              fontSize: '0.875rem',
              marginBottom: '8px',
            }}
          >
            Deadline
          </div>
          {editingDeadline ? (
            <div>
              <input
                data-testid='deadline-input'
                type='date'
                value={deadlineValue}
                onChange={e => setDeadlineValue(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '2px solid #4a90e2',
                  borderRadius: '4px',
                }}
              />
              <div style={{ marginTop: '4px' }}>
                <button
                  onClick={handleUpdateDeadline}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    marginRight: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingDeadline(false)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <span style={{ fontSize: '0.875rem', color: '#4a5568' }}>
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
              <button
                data-testid='deadline-edit-button'
                onClick={() => setEditingDeadline(true)}
                style={{
                  marginLeft: '8px',
                  padding: '2px 6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✏️
              </button>
            </div>
          )}
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600', margin: 0 }}>
            🔄 Recurring Settings
          </h3>
          {!editingRecurring && (
            <button
              data-testid='recurring-edit-button'
              onClick={() => setEditingRecurring(true)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#0284c7',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ✏️ Edit
            </button>
          )}
        </div>
        {editingRecurring ? (
          <div>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              <input
                data-testid='recurring-checkbox'
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
                  data-testid='recurring-interval-input'
                  type='number'
                  min='1'
                  value={recurringInterval || ''}
                  onChange={e => setRecurringInterval(Number(e.target.value))}
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
            <button
              onClick={handleUpdateRecurring}
              style={{
                padding: '6px 12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                marginRight: '8px',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              onClick={() => setEditingRecurring(false)}
              style={{
                padding: '6px 12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '0.875rem', color: '#0369a1' }}>
            {task.isRecurring
              ? `✅ Enabled (every ${task.recurringInterval} days)`
              : '❌ Not recurring'}
          </div>
        )}
      </div>

      {/* Assignees - AC7 (TM015: can add but NOT remove) */}
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
          👥 Assigned Staff ({task.assignments.length}/5)
        </h3>

        {/* Current Assignees Display */}
        <div style={{ marginBottom: '1rem' }}>
          {task.assignments.length === 0 ? (
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
              {task.assignments.map(userId => {
                const userDetails = userDetailsMap.get(userId);
                return (
                  <div
                    key={userId}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#dcfce7',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      color: '#166534',
                    }}
                  >
                    <span>
                      👤{' '}
                      {userDetails
                        ? `${userDetails.name} (${userDetails.email})`
                        : 'Loading...'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Remember that max 5 assignees (TM023) and cannot remove once added (TM015) */}
        {/* Add Assignee Interface */}
        {task.assignments.length < 5 ? (
          <div>
            <div
              style={{
                fontSize: '12px',
                color: '#7c2d12',
                marginBottom: '8px',
              }}
            >
              💡 Add assignee by email • Max 5 total
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type='email'
                value={newAssigneeEmail}
                onChange={e => setNewAssigneeEmail(e.target.value)}
                placeholder='user@example.com'
                disabled={addingAssignee}
                style={{
                  flex: 1,
                  padding: '6px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
                data-testid='assignee-email-input'
              />
              <button
                onClick={handleAddAssignee}
                disabled={addingAssignee || !newAssigneeEmail.trim()}
                style={{
                  padding: '6px 12px',
                  backgroundColor:
                    addingAssignee || !newAssigneeEmail.trim()
                      ? '#9ca3af'
                      : '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor:
                    addingAssignee || !newAssigneeEmail.trim()
                      ? 'not-allowed'
                      : 'pointer',
                  fontSize: '0.875rem',
                }}
                data-testid='add-assignee-button'
              >
                {addingAssignee ? '⏳ Adding...' : '➕ Add'}
              </button>
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

      {/* Tags */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            marginBottom: '8px',
          }}
        >
          🏷️ Tags
        </h3>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '8px',
          }}
        >
          {task.tags.map(tag => (
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
            placeholder='Add tag...'
            style={{
              flex: 1,
              padding: '6px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
            }}
          />
          <button
            onClick={handleAddTag}
            style={{
              padding: '6px 12px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Add Tag
          </button>
        </div>
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
          📎 File Attachments
        </h3>

        {/* Upload Section */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor={`file-input-${taskId}`}
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
            id={`file-input-${taskId}`}
            type='file'
            onChange={handleFileSelect}
            disabled={uploading}
            accept='.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.zip'
            style={{ display: 'none' }}
          />
          {selectedFile && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              style={{
                marginLeft: '8px',
                padding: '8px 16px',
                backgroundColor: uploading ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {uploading ? '⏳ Uploading...' : '⬆️ Upload'}
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {uploading && (
          <div
            style={{
              width: '100%',
              height: '24px',
              backgroundColor: '#fff',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${uploadProgress}%`,
                backgroundColor: '#28a745',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                transition: 'width 0.3s ease',
              }}
            >
              {uploadProgress}%
            </div>
          </div>
        )}

        {/* Storage Usage */}
        {!loadingFiles && (
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
                  color: totalSize > 50 * 1024 * 1024 ? '#dc3545' : '#28a745',
                }}
              >
                {(totalSize / (1024 * 1024)).toFixed(2)} MB / 50 MB
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
                  width: `${Math.min((totalSize / (50 * 1024 * 1024)) * 100, 100)}%`,
                  height: '100%',
                  backgroundColor:
                    totalSize > 50 * 1024 * 1024
                      ? '#dc3545'
                      : totalSize > 40 * 1024 * 1024
                        ? '#ffc107'
                        : '#28a745',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Files List */}
        <div
          style={{ fontSize: '12px', color: '#92400e', marginBottom: '8px' }}
        >
          💡 Max 10MB per file • 50MB total • PDF, images, docs, spreadsheets
        </div>

        {loadingFiles ? (
          <p style={{ fontSize: '0.875rem', color: '#666' }}>
            Loading files...
          </p>
        ) : uploadedFiles.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#666' }}>
            No files uploaded yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {uploadedFiles.map(file => (
              <div
                key={file.id}
                data-testid={`file-entry-${file.fileName}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                    {file.fileName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {(file.fileSize / (1024 * 1024)).toFixed(2)} MB •{' '}
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    data-testid={`file-download-button-${file.fileName}`}
                    onClick={() => handleDownloadFile(file.id, file.fileName)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#0284c7',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    ⬇️
                  </button>
                  <button
                    data-testid={`file-delete-button-${file.fileName}`}
                    onClick={() => handleDeleteFile(file.id, file.fileName)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comments */}
      <div>
        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            marginBottom: '12px',
          }}
        >
          💬 Comments ({task.comments.length})
        </h3>

        {/* Comments List */}
        <div style={{ marginBottom: '1rem' }}>
          {task.comments.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              No comments yet.
            </p>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {task.comments.map(comment => (
                <div
                  key={comment.id}
                  style={{
                    padding: '12px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  {editingCommentId === comment.id ? (
                    <div>
                      <textarea
                        value={editCommentValue}
                        onChange={e => setEditCommentValue(e.target.value)}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '2px solid #4a90e2',
                          borderRadius: '4px',
                          fontFamily: 'inherit',
                          marginBottom: '8px',
                        }}
                      />
                      <button
                        data-testid={`comment-save-button-${comment.id}`}
                        onClick={() => handleUpdateComment(comment.id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          marginRight: '8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditCommentValue('');
                        }}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          color: '#1f2937',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {comment.content}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '8px',
                        }}
                      >
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {new Date(comment.createdAt).toLocaleString()}
                          {comment.updatedAt !== comment.createdAt &&
                            ' (edited)'}
                        </div>
                        {comment.authorId === userProfile.id && (
                          <button
                            data-testid={`comment-edit-button-${comment.id}`}
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setEditCommentValue(comment.content);
                            }}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: '#e3f2fd',
                              color: '#1976d2',
                              border: '1px solid #1976d2',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px',
                            }}
                          >
                            ✏️ Edit
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Comment */}
        <div>
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder='Add a comment...'
            rows={3}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              fontFamily: 'inherit',
              marginBottom: '8px',
            }}
          />
          <button
            onClick={handleAddComment}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Add Comment
          </button>
        </div>
      </div>
    </div>
  );
}
