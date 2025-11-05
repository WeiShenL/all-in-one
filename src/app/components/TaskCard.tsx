'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import LogItem from './LogItem';
import { ConnectedTasks } from './ConnectedTasks';
import { TaskDatePill } from './TaskTable/TaskDatePill';
import { UserSelectOption } from './UserSelectOption';
import { DepartmentPill } from './TaskTable/DepartmentPill';
import { trpc } from '../lib/trpc';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  priorityBucket: number;
  dueDate: string;
  isRecurring: boolean;
  recurringInterval: number | null;
  ownerId: string;
  projectId: string | null;
  assignments: Array<{
    userId: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }>;
  tags: string[];
  comments: Array<{
    id: string;
    content: string;
    authorId: string;
    createdAt: string;
    updatedAt: string;
  }>;
  involvedDepartments?: Array<{ id: string; name: string }>;
  canEdit?: boolean; // Permission field from backend
}

interface UploadedFile {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedById: string;
  uploadedAt: string;
}

export function TaskCard({
  taskId,
  onTaskChange,
  onTaskUpdated,
}: {
  taskId: string;
  onTaskChange?: (newTaskId: string) => void;
  onTaskUpdated?: () => void;
}) {
  const { userProfile } = useAuth();
  const utils = trpc.useUtils();
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
  const [editingProject, setEditingProject] = useState(false);
  const [projectValue, setProjectValue] = useState<string>('');
  const [newTag, setNewTag] = useState('');
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentValue, setEditCommentValue] = useState('');

  // Available projects for dropdown
  const [availableProjects, setAvailableProjects] = useState<
    Array<{
      id: string;
      name: string;
    }>
  >([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>(
    'comments'
  );

  // Task logs state
  const [taskLogs, setTaskLogs] = useState<
    Array<{
      id: string;
      taskId: string;
      userId: string;
      action: string;
      field: string;
      changes: any;
      metadata: any;
      timestamp: string;
      user: {
        id: string;
        name: string;
        email: string;
      };
    }>
  >([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [totalSize, setTotalSize] = useState(0);

  // Assignee management states (AC7 - TM015: can add but NOT remove)
  const [addingAssignee, setAddingAssignee] = useState(false);
  const [userDetailsMap, setUserDetailsMap] = useState<
    Map<
      string,
      {
        name: string;
        email: string;
        role?: string;
        isHrAdmin?: boolean;
        department?: { id: string; name: string };
      }
    >
  >(new Map());

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

  // Task hierarchy state
  const [taskHierarchy, setTaskHierarchy] = useState<any>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchAllTaskData = async () => {
      if (!userProfile) {
        return;
      }

      try {
        const response = await fetch(
          `/api/trpc/task.getTaskEditingData?input=${encodeURIComponent(
            JSON.stringify({ taskId })
          )}`,
          {
            signal: abortController.signal, // Cancel request if effect cleanup runs
          }
        );
        const data = await response.json();

        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        if (data.result?.data) {
          const {
            task: taskData,
            files: filesData,
            logs,
            departmentUsers,
            allUsers,
            projects,
            hierarchy,
          } = data.result.data;

          // Set task data
          setTask(taskData);
          setTitleValue(taskData.title);
          setDescriptionValue(taskData.description);
          setPriorityValue(taskData.priorityBucket);
          setDeadlineValue(taskData.dueDate.split('T')[0]);
          setStatusValue(taskData.status);
          setRecurringEnabled(taskData.isRecurring);
          setRecurringInterval(taskData.recurringInterval);
          setProjectValue(taskData.projectId || '');

          // Set files data
          setUploadedFiles(filesData.files);
          setTotalSize(filesData.totalSize || 0);
          setLoadingFiles(false);

          // Set logs
          setTaskLogs(logs);
          setLoadingLogs(false);

          // Set hierarchy
          setTaskHierarchy(hierarchy);

          // Set department users
          const userMap = new Map<
            string,
            {
              name: string;
              email: string;
              role?: string;
              isHrAdmin?: boolean;
              department?: { id: string; name: string };
            }
          >();
          departmentUsers.forEach(
            (user: {
              id: string;
              name: string;
              email: string;
              role?: string;
              isHrAdmin?: boolean;
              department?: { id: string; name: string };
            }) => {
              userMap.set(user.id, {
                name: user.name,
                email: user.email,
                role: user.role,
                isHrAdmin: user.isHrAdmin,
                department: user.department,
              });
            }
          );

          // Set all users
          setAvailableUsers(allUsers);
          setLoadingUsers(false);

          // Set projects
          setAvailableProjects(
            projects.map((p: any) => ({
              id: p.id,
              name: p.name,
            }))
          );
          setLoadingProjects(false);

          // Populate user details map from allUsers (no additional API calls needed!)
          // Collect all user IDs we need (assignees + comment authors)
          const neededUserIds = new Set<string>();

          if (taskData.assignments && taskData.assignments.length > 0) {
            taskData.assignments.forEach((assignment: any) =>
              neededUserIds.add(assignment.userId)
            );
          }

          if (taskData.comments && taskData.comments.length > 0) {
            taskData.comments.forEach((comment: any) =>
              neededUserIds.add(comment.authorId)
            );
          }

          // Build complete user details map from allUsers data we already have
          allUsers.forEach((user: any) => {
            if (neededUserIds.has(user.id)) {
              userMap.set(user.id, {
                name: user.name,
                email: user.email,
                role: user.role,
                isHrAdmin: user.isHrAdmin,
                department: user.department,
              });
            }
          });

          setUserDetailsMap(userMap);
        }
      } catch (err: any) {
        // Ignore abort errors (expected when component unmounts)
        if (err.name === 'AbortError') {
          return;
        }
        if (!abortController.signal.aborted) {
          setError('Failed to load task');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchAllTaskData();

    // Cleanup function to abort pending request on unmount/re-render
    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, userProfile?.id]);

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
        setProjectValue(data.result.data.projectId || '');

        // Fetch user details for any assignees and comment authors we don't have details for
        const allUserIds = new Set<string>();

        if (
          data.result.data.assignments &&
          data.result.data.assignments.length > 0
        ) {
          data.result.data.assignments.forEach((assignment: any) =>
            allUserIds.add(assignment.userId)
          );
        }

        if (data.result.data.comments && data.result.data.comments.length > 0) {
          data.result.data.comments.forEach((comment: any) =>
            allUserIds.add(comment.authorId)
          );
        }

        if (allUserIds.size > 0) {
          await fetchUserDetailsForAssignees(Array.from(allUserIds));
        }
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

  const fetchUserDetailsForAssignees = async (assigneeIds: string[]) => {
    if (!userProfile) {
      return;
    }

    // Find assignees that we don't have details for
    const missingUserIds = assigneeIds.filter(
      userId => !userDetailsMap.has(userId)
    );

    if (missingUserIds.length === 0) {
      return; // All user details already available
    }

    // console.log('Fetching user details for:', missingUserIds);

    // Fetch details for each missing user using the existing getById endpoint
    const newUserMap = new Map(userDetailsMap);

    for (const userId of missingUserIds) {
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          const response = await fetch(
            `/api/trpc/userProfile.getById?input=${encodeURIComponent(
              JSON.stringify({ id: userId })
            )}`
          );

          if (response.ok) {
            const data = await response.json();
            // console.log(`User details for ${userId}:`, data);
            if (data.result?.data) {
              newUserMap.set(userId, {
                name: data.result.data.name,
                email: data.result.data.email,
                role: data.result.data.role,
                isHrAdmin: data.result.data.isHrAdmin,
                department: data.result.data.department,
              });
              //   console.log(`Successfully loaded user: ${data.result.data.name} (${data.result.data.email})`);
              break; // Success, exit retry loop
            } else {
              console.warn(`No data returned for user ${userId}:`, data);
              if (retryCount === maxRetries) {
                // Set a fallback entry for failed users
                newUserMap.set(userId, {
                  name: `User ${userId.slice(0, 8)}`,
                  email: 'Unknown',
                });
              }
            }
          } else {
            console.error(
              `Failed to fetch user details for ${userId}:`,
              response.status,
              response.statusText
            );
            if (retryCount === maxRetries) {
              // Set a fallback entry for failed users
              newUserMap.set(userId, {
                name: `User ${userId.slice(0, 8)}`,
                email: 'Unknown',
              });
            }
          }
        } catch (err) {
          console.error(
            `Failed to fetch user details for ${userId} (attempt ${retryCount + 1}):`,
            err
          );
          if (retryCount === maxRetries) {
            // Set a fallback entry for failed users
            newUserMap.set(userId, {
              name: `User ${userId.slice(0, 8)}`,
              email: 'Unknown',
            });
          }
        }

        retryCount++;
        if (retryCount <= maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    setUserDetailsMap(newUserMap);
  };

  const fetchTaskLogs = async () => {
    if (!userProfile) {
      return;
    }

    setLoadingLogs(true);
    try {
      const response = await fetch(
        `/api/trpc/task.getTaskLogs?input=${encodeURIComponent(
          JSON.stringify({ taskId })
        )}`
      );
      const data = await response.json();

      if (data.result?.data) {
        setTaskLogs(data.result.data);
      }
    } catch (err) {
      console.error('Failed to fetch task logs:', err);
    } finally {
      setLoadingLogs(false);
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

      await fetchTask();
      await fetchTaskLogs();

      // Invalidate all task-related caches to ensure fresh data everywhere
      utils.task.getUserTasks.invalidate();
      utils.task.getDepartmentTasksForUser.invalidate();
      utils.task.getCompanyTasks.invalidate();
      utils.task.getTaskEditingData.invalidate({ taskId });

      onTaskUpdated?.(); // Notify parent to refresh dashboard
      setSuccess(successMsg);
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

  const handleUpdateProject = async () => {
    await updateTask(
      'assignProject',
      { taskId, projectId: projectValue || null },
      '✅ Project updated'
    );
    setEditingProject(false);
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

  // AC7: Add assignee from dropdown (max 5, cannot remove - TM015)
  const handleAddAssignee = async (userId: string) => {
    if (!userId || !userProfile) {
      return;
    }

    // Check max 5 limit (TM023)
    if (task && task.assignments.length >= 5) {
      setError('Maximum 5 assignees allowed');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Check if already assigned
    if (
      task &&
      task.assignments.some(a => {
        const assigneeUserId = typeof a === 'string' ? a : a.userId;
        return assigneeUserId === userId;
      })
    ) {
      setError('User is already assigned to this task');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setAddingAssignee(true);
    setError(null);

    try {
      const addResponse = await fetch('/api/trpc/task.addAssignee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          userId: userId,
        }),
      });

      if (!addResponse.ok) {
        const errorData = await addResponse.json();
        throw new Error(errorData.error?.message || 'Failed to add assignee');
      }

      const user = availableUsers.find(u => u.id === userId);
      const displayName = user ? `${user.name} (${user.email})` : 'User';
      setSuccess(`✅ Assignee "${displayName}" added`);
      await fetchTask(); // Refresh task data
      onTaskUpdated?.(); // Notify parent to refresh dashboard

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add assignee');
      setTimeout(() => setError(null), 5000);
    } finally {
      setAddingAssignee(false);
    }
  };

  // SCRUM-15 AC3: Manager can remove assignees from accessible tasks
  // TM015: Staff CANNOT remove assignees (only managers)
  const handleRemoveAssignee = async (userId: string) => {
    if (!userProfile) {
      return;
    }

    // Only managers can remove assignees (AC3)
    if (userProfile.role !== 'MANAGER') {
      setError('Only managers can remove assignees');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Check minimum 1 assignee (TM016)
    if (task && task.assignments.length <= 1) {
      setError('Task must have at least 1 assignee');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // NOTE: Owner can be removed from assignees (SCRUM-15 AC6 edge case)
    // The ownerId field is immutable - removing owner from assignees doesn't change ownership
    // The owner remains as the task owner in the database, just not in the assignees list

    setError(null);

    try {
      const removeResponse = await fetch('/api/trpc/task.removeAssignee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          userId,
        }),
      });

      if (!removeResponse.ok) {
        const errorData = await removeResponse.json();
        throw new Error(
          errorData.error?.message || 'Failed to remove assignee'
        );
      }

      const userDetails = userDetailsMap.get(userId);
      const displayName = userDetails?.email || `User ${userId.slice(0, 8)}...`;
      setSuccess(`✅ Removed assignee "${displayName}"`);
      await fetchTask(); // Refresh task data
      onTaskUpdated?.(); // Notify parent to refresh dashboard

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to remove assignee'
      );
      setTimeout(() => setError(null), 5000);
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

  // Determine if user has edit permission
  const hasEditPermission = task.canEdit !== false; // Default to true if not specified

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
        maxWidth: '900px',
        margin: '0 auto',
        border: '1px solid #e5e7eb',
      }}
    >
      {/* Read-only indicator */}
      {!hasEditPermission && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fef3c7',
            color: '#92400e',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          👁️ View-only mode: You can view this task but cannot edit it
        </div>
      )}

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
              data-testid='task-title-input'
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '1.25rem',
                fontWeight: '600',
                border: '2px solid #4a90e2',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
              autoFocus
              onFocus={e => e.target.select()}
            />
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
              <button
                onClick={handleUpdateTitle}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ✓ Save
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ✗ Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            data-testid='task-title-display'
            onClick={() => {
              if (hasEditPermission) {
                setTitleValue(task.title);
                setEditingTitle(true);
              }
            }}
            style={{
              padding: '8px',
              borderRadius: '4px',
              cursor: hasEditPermission ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              border: '1px solid transparent',
            }}
            onMouseEnter={e => {
              if (hasEditPermission) {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.border = '1px solid #e2e8f0';
              }
            }}
            onMouseLeave={e => {
              if (hasEditPermission) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.border = '1px solid transparent';
              }
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
          </div>
        )}
      </div>

      {/* Description */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            margin: '0 0 8px 0',
          }}
        >
          Description
        </h3>
        {editingDescription ? (
          <div>
            <textarea
              data-testid='task-description-input'
              value={descriptionValue}
              onChange={e => setDescriptionValue(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: '8px',
                border: '2px solid #4a90e2',
                borderRadius: '4px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              autoFocus
              onFocus={e => e.target.select()}
            />
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
              <button
                onClick={handleUpdateDescription}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ✓ Save
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ✗ Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            data-testid='task-description-display'
            onClick={() => {
              if (hasEditPermission) {
                setDescriptionValue(task.description);
                setEditingDescription(true);
              }
            }}
            style={{
              padding: '8px',
              borderRadius: '4px',
              cursor: hasEditPermission ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              border: '1px solid transparent',
            }}
            onMouseEnter={e => {
              if (hasEditPermission) {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.border = '1px solid #e2e8f0';
              }
            }}
            onMouseLeave={e => {
              if (hasEditPermission) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.border = '1px solid transparent';
              }
            }}
          >
            <p style={{ color: '#4a5568', whiteSpace: 'pre-wrap', margin: 0 }}>
              {task.description}
            </p>
          </div>
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
                data-testid='task-status-select'
                value={statusValue}
                onChange={e => setStatusValue(e.target.value as Task['status'])}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '2px solid #4a90e2',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
                autoFocus
              >
                <option value='TO_DO'>To Do</option>
                <option value='IN_PROGRESS'>In Progress</option>
                <option value='COMPLETED'>Completed</option>
                <option value='BLOCKED'>Blocked</option>
              </select>
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleUpdateStatus}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                  }}
                >
                  ✓ Save
                </button>
                <button
                  onClick={() => setEditingStatus(false)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                  }}
                >
                  ✗ Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              data-testid='task-status-display'
              onClick={() => hasEditPermission && setEditingStatus(true)}
              style={{
                padding: '8px',
                borderRadius: '4px',
                cursor: hasEditPermission ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                display: 'inline-block',
                border: '1px solid transparent',
              }}
              onMouseEnter={e => {
                if (hasEditPermission) {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.border = '1px solid #e2e8f0';
                }
              }}
              onMouseLeave={e => {
                if (hasEditPermission) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.border = '1px solid transparent';
                }
              }}
            >
              <span
                style={{
                  padding: '4px 12px',
                  backgroundColor:
                    task.status === 'COMPLETED'
                      ? '#dcfce7'
                      : task.status === 'IN_PROGRESS'
                        ? '#dbeafe'
                        : task.status === 'BLOCKED'
                          ? '#fee2e2'
                          : '#f3f4f6',
                  color:
                    task.status === 'COMPLETED'
                      ? '#166534'
                      : task.status === 'IN_PROGRESS'
                        ? '#1e40af'
                        : task.status === 'BLOCKED'
                          ? '#dc2626'
                          : '#6b7280',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                {task.status.replace('_', ' ')}
              </span>
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
                data-testid='task-priority-input'
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
                  boxSizing: 'border-box',
                }}
                autoFocus
              />
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <button
                  data-testid='task-priority-save-button'
                  onClick={handleUpdatePriority}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                  }}
                >
                  ✓ Save
                </button>
                <button
                  data-testid='task-priority-cancel-button'
                  onClick={() => setEditingPriority(false)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                  }}
                >
                  ✗ Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              data-testid='task-priority-display'
              onClick={() => hasEditPermission && setEditingPriority(true)}
              style={{
                padding: '8px',
                borderRadius: '4px',
                cursor: hasEditPermission ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                display: 'inline-block',
                border: '1px solid transparent',
              }}
              onMouseEnter={e => {
                if (hasEditPermission) {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.border = '1px solid #e2e8f0';
                }
              }}
              onMouseLeave={e => {
                if (hasEditPermission) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.border = '1px solid transparent';
                }
              }}
            >
              <span
                data-testid='priority-value'
                style={{
                  padding: '4px 12px',
                  backgroundColor:
                    task.priorityBucket >= 8
                      ? '#fee2e2'
                      : task.priorityBucket >= 4
                        ? '#fef3c7'
                        : '#dcfce7',
                  color:
                    task.priorityBucket >= 8
                      ? '#dc2626'
                      : task.priorityBucket >= 4
                        ? '#d97706'
                        : '#166534',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                {task.priorityBucket}
              </span>
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
                  boxSizing: 'border-box',
                }}
                autoFocus
              />
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleUpdateDeadline}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                  }}
                >
                  ✓ Save
                </button>
                <button
                  onClick={() => setEditingDeadline(false)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                  }}
                >
                  ✗ Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              data-testid='task-deadline-display'
              onClick={() => hasEditPermission && setEditingDeadline(true)}
              style={{
                padding: '8px',
                borderRadius: '4px',
                cursor: hasEditPermission ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                display: 'inline-block',
                border: '1px solid transparent',
              }}
              onMouseEnter={e => {
                if (hasEditPermission) {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.border = '1px solid #e2e8f0';
                }
              }}
              onMouseLeave={e => {
                if (hasEditPermission) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.border = '1px solid transparent';
                }
              }}
            >
              <TaskDatePill dueDate={task.dueDate} status={task.status} />
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
        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            margin: '0 0 8px 0',
          }}
        >
          🔄 Recurring Settings
        </h3>
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
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleUpdateRecurring}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ✓ Save
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ✗ Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            data-testid='task-recurring-display'
            onClick={() => hasEditPermission && setEditingRecurring(true)}
            style={{
              padding: '8px',
              borderRadius: '4px',
              cursor: hasEditPermission ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              border: '1px solid transparent',
            }}
            onMouseEnter={e => {
              if (hasEditPermission) {
                e.currentTarget.style.backgroundColor = '#e0f2fe';
                e.currentTarget.style.border = '1px solid #bae6fd';
              }
            }}
            onMouseLeave={e => {
              if (hasEditPermission) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.border = '1px solid transparent';
              }
            }}
          >
            <div style={{ fontSize: '0.875rem', color: '#0369a1' }}>
              {task.isRecurring
                ? `✅ Enabled (every ${task.recurringInterval} days)`
                : '❌ Not recurring'}
            </div>
          </div>
        )}
      </div>

      {/* Connected Tasks */}
      <ConnectedTasks
        taskId={taskId}
        onTaskClick={onTaskChange}
        initialHierarchy={taskHierarchy}
      />

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
              {[...task.assignments]
                .sort((a, b) => {
                  // Sort so owner appears first
                  const userIdA = typeof a === 'string' ? a : a.userId;
                  const userIdB = typeof b === 'string' ? b : b.userId;
                  const aIsOwner = userIdA === task.ownerId;
                  const bIsOwner = userIdB === task.ownerId;
                  if (aIsOwner && !bIsOwner) {
                    return -1;
                  }
                  if (!aIsOwner && bIsOwner) {
                    return 1;
                  }
                  return 0;
                })
                .map(assignment => {
                  const userId =
                    typeof assignment === 'string'
                      ? assignment
                      : assignment.userId;
                  const userDetails = userDetailsMap.get(userId);
                  const isOwner = userId === task.ownerId;
                  // Manager can remove any assignee, including owner (AC6 edge case)
                  // Owner field is immutable - removing owner from assignees doesn't change ownership
                  const canRemove =
                    hasEditPermission &&
                    userProfile?.role === 'MANAGER' &&
                    task.assignments.length > 1;
                  return (
                    <div
                      key={userId}
                      data-testid={`task-assignee-${userId}`}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: isOwner ? '#fef3c7' : '#dcfce7',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        color: isOwner ? '#92400e' : '#166534',
                        border: isOwner ? '1px solid #f59e0b' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {isOwner ? '👑' : '👤'}{' '}
                        {userDetails
                          ? (() => {
                              const additionalInfo: string[] = [];
                              // Add department if available
                              if (userDetails.department?.name) {
                                additionalInfo.push(
                                  userDetails.department.name
                                );
                              }
                              // Add role if available (title case)
                              if (userDetails.role) {
                                const roleDisplay = userDetails.role
                                  .replace('_', ' ')
                                  .toLowerCase()
                                  .replace(/\b\w/g, l => l.toUpperCase());
                                additionalInfo.push(roleDisplay);
                              }
                              // Add HR_Admin if applicable
                              if (userDetails.isHrAdmin) {
                                additionalInfo.push('HR_Admin');
                              }
                              // Combine: name (email), then dash, then comma-separated additional info
                              const mainPart = `${userDetails.name} (${userDetails.email})`;
                              return additionalInfo.length > 0
                                ? `${mainPart} - ${additionalInfo.join(', ')}`
                                : mainPart;
                            })()
                          : `User ${userId.slice(0, 8)}...`}
                        {isOwner && (
                          <span
                            style={{
                              marginLeft: '8px',
                              padding: '2px 6px',
                              backgroundColor: '#f59e0b',
                              color: 'white',
                              borderRadius: '3px',
                              fontSize: '11px',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            OWNER
                          </span>
                        )}
                      </span>
                      {canRemove && (
                        <button
                          onClick={() => handleRemoveAssignee(userId)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                          title='Remove assignee (Manager only)'
                          data-testid={`remove-assignee-${userId}`}
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

        {/* Max 5 assignees (TM023). TM015: Staff cannot remove, but Managers can (SCRUM-15 AC3) */}
        {/* Add Assignee Interface - Dropdown */}
        {hasEditPermission && task.assignments.length < 5 ? (
          <div>
            <div
              style={{
                fontSize: '12px',
                color: '#7c2d12',
                marginBottom: '8px',
              }}
            >
              💡 Select user to add as assignee • Max 5 total
              {/* Debug info */}
              <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                ({availableUsers.length} users available)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value=''
                onChange={e => {
                  const userId = e.target.value;
                  if (userId) {
                    handleAddAssignee(userId);
                  }
                }}
                disabled={addingAssignee || loadingUsers}
                style={{
                  flex: 1,
                  padding: '6px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  maxWidth: '100%',
                  textOverflow: 'ellipsis',
                  cursor:
                    addingAssignee || loadingUsers ? 'not-allowed' : 'pointer',
                }}
                data-testid='assignee-dropdown'
              >
                <option value=''>
                  {loadingUsers
                    ? 'Loading users...'
                    : addingAssignee
                      ? 'Adding...'
                      : '-- Select User to Add --'}
                </option>
                {availableUsers
                  .filter(user => {
                    // Filter out users already assigned
                    const assignedUserIds = task.assignments.map(a =>
                      typeof a === 'string' ? a : a.userId
                    );
                    return !assignedUserIds.includes(user.id);
                  })
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
            </div>
          </div>
        ) : hasEditPermission && task.assignments.length >= 5 ? (
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
        ) : null}
      </div>

      {/* Project - Immutable once set (SCRUM-31) */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            marginBottom: '8px',
          }}
        >
          📁 Project
        </h3>
        {task.projectId ? (
          // Project already assigned - immutable (AC3)
          <div
            style={{
              padding: '8px',
              backgroundColor: '#f0f9ff',
              borderRadius: '4px',
            }}
          >
            <div
              style={{
                fontSize: '0.875rem',
                color: '#0369a1',
                marginBottom: '4px',
              }}
            >
              {availableProjects.find(p => p.id === task.projectId)?.name ||
                task.projectId}
            </div>
            <div
              style={{
                padding: '6px 8px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '4px',
                fontSize: '0.75rem',
                color: '#92400e',
              }}
            >
              ⚠️ Project cannot be changed once assigned (immutable)
            </div>
          </div>
        ) : (
          // No project assigned - can be set once (AC2)
          <>
            {editingProject ? (
              <div>
                <select
                  data-testid='task-project-select'
                  value={projectValue}
                  onChange={e => setProjectValue(e.target.value)}
                  disabled={loadingProjects}
                  style={{
                    width: '100%',
                    padding: '6px',
                    border: '2px solid #4a90e2',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    backgroundColor: loadingProjects ? '#f5f5f5' : 'white',
                    cursor: loadingProjects ? 'not-allowed' : 'pointer',
                  }}
                  autoFocus
                >
                  <option value=''>-- No Project (Standalone Task) --</option>
                  {availableProjects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleUpdateProject}
                    disabled={loadingProjects}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: loadingProjects ? '#9ca3af' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loadingProjects ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    ✓ Save
                  </button>
                  <button
                    onClick={() => setEditingProject(false)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    ✗ Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                data-testid='task-project-display'
                onClick={() => hasEditPermission && setEditingProject(true)}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  cursor: hasEditPermission ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  border: '1px solid transparent',
                  backgroundColor: '#f8fafc',
                }}
                onMouseEnter={e => {
                  if (hasEditPermission) {
                    e.currentTarget.style.backgroundColor = '#e0f2fe';
                    e.currentTarget.style.border = '1px solid #bae6fd';
                  }
                }}
                onMouseLeave={e => {
                  if (hasEditPermission) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.border = '1px solid transparent';
                  }
                }}
              >
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  No project assigned (click to assign)
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Involved Departments */}
      {task.involvedDepartments && task.involvedDepartments.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              marginBottom: '8px',
            }}
          >
            🏢 Involved Departments
          </h3>
          <DepartmentPill
            departments={task.involvedDepartments}
            parentDepartmentId={(task as any).departmentId}
          />
        </div>
      )}

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
              {hasEditPermission && (
                <button
                  data-testid={`remove-tag-${tag}`}
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
              )}
            </span>
          ))}
        </div>
        {hasEditPermission && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              data-testid='tag-input'
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
              data-testid='add-tag-button'
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
          📎 File Attachments
        </h3>

        {/* Upload Section */}
        {hasEditPermission && (
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
              data-testid='file-input'
              type='file'
              onChange={handleFileSelect}
              disabled={uploading}
              accept='.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.zip'
              style={{ display: 'none' }}
            />
            {selectedFile && (
              <button
                data-testid='upload-button'
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
        )}

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
                  {hasEditPermission && (
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
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comments and History Tabs */}
      <div>
        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '2px solid #e5e7eb',
            marginBottom: '1rem',
          }}
        >
          <button
            onClick={() => setActiveTab('comments')}
            style={{
              padding: '12px 24px',
              backgroundColor:
                activeTab === 'comments' ? '#3b82f6' : 'transparent',
              color: activeTab === 'comments' ? 'white' : '#6b7280',
              border: 'none',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'all 0.2s ease',
            }}
          >
            💬 Comments ({task.comments.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '12px 24px',
              backgroundColor:
                activeTab === 'history' ? '#3b82f6' : 'transparent',
              color: activeTab === 'history' ? 'white' : '#6b7280',
              border: 'none',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'all 0.2s ease',
            }}
          >
            📋 History ({taskLogs.length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'comments' && (
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
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
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
                              boxSizing: 'border-box',
                            }}
                            autoFocus
                          />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              data-testid={`comment-save-button-${comment.id}`}
                              onClick={() => handleUpdateComment(comment.id)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                              }}
                            >
                              ✓ Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditCommentValue('');
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                              }}
                            >
                              ✗ Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {/* Header with user name and edit button */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '0px',
                            }}
                          >
                            {/* User name */}
                            <div
                              style={{
                                fontSize: '0.875rem',
                                fontWeight: '800',
                                color: '#1f2937',
                              }}
                            >
                              {userDetailsMap.get(comment.authorId)?.name ||
                                'Unknown User'}
                            </div>

                            {/* Edit button for comment author */}
                            {comment.authorId === userProfile.id && (
                              <div
                                data-testid={`comment-edit-button-${comment.id}`}
                                onClick={() => {
                                  setEditingCommentId(comment.id);
                                  setEditCommentValue(comment.content);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: 'transparent',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  transition: 'all 0.2s ease',
                                  display: 'inline-block',
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.backgroundColor =
                                    '#f3f4f6';
                                  e.currentTarget.style.border =
                                    '1px solid #d1d5db';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.backgroundColor =
                                    'transparent';
                                  e.currentTarget.style.border =
                                    '1px solid #e5e7eb';
                                }}
                              >
                                ✏️ Edit
                              </div>
                            )}
                          </div>

                          {/* Date and time stamp */}
                          <div
                            style={{
                              fontSize: '8px',
                              color: '#6b7280',
                              marginBottom: '15px',
                            }}
                          >
                            {new Date(comment.createdAt).toLocaleString()}
                            {comment.updatedAt !== comment.createdAt &&
                              ' (edited)'}
                          </div>

                          {/* Comment content */}
                          <div
                            style={{
                              fontSize: '0.875rem',
                              color: '#1f2937',
                              whiteSpace: 'pre-wrap',
                              marginBottom: '8px',
                            }}
                          >
                            {comment.content}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Comment */}
            {hasEditPermission && (
              <div>
                <textarea
                  data-testid='comment-input'
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
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  data-testid='add-comment-button'
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
            )}
          </div>
        )}

        {/* History Tab Content */}
        {activeTab === 'history' && (
          <div>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                marginBottom: '12px',
              }}
            >
              📋 Task History ({taskLogs.length})
            </h3>

            {loadingLogs ? (
              <p style={{ fontSize: '0.875rem', color: '#666' }}>
                Loading history...
              </p>
            ) : taskLogs.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#666' }}>
                No history available.
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {taskLogs.map(log => (
                  <LogItem key={log.id} log={log} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
