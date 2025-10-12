'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/app/components/Navbar';
import { TaskEditCard } from '@/app/components/TaskEditCard';
import { TaskFileUpload } from '@/app/components/TaskFileUpload';

export default function StaffDashboard() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<
    Array<{
      id: string;
      title: string;
      description: string;
      status: string;
      priorityBucket: number;
      dueDate: string;
      ownerId: string;
      parentTaskId: string | null;
      assignments: string[];
    }>
  >([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  // Fetch user's assigned tasks
  useEffect(() => {
    async function fetchTasks() {
      if (!userProfile) {
        return;
      }

      try {
        const response = await fetch(
          `/api/trpc/task.getUserTasks?input=${encodeURIComponent(JSON.stringify({ userId: userProfile.id, includeArchived: false }))}`
        );
        const data = await response.json();

        if (data.result?.data && Array.isArray(data.result.data)) {
          setTasks(data.result.data);
        }
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
      } finally {
        setLoadingTasks(false);
      }
    }

    fetchTasks();
  }, [userProfile]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#f7fafc',
        }}
      >
        <p style={{ color: '#718096' }}>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f7fafc',
      }}
    >
      <Navbar />
      <div style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <header
            style={{
              marginBottom: '2rem',
              paddingBottom: '1rem',
              borderBottom: '2px solid #e2e8f0',
            }}
          >
            <h1
              style={{
                marginBottom: '0.5rem',
                color: '#1a202c',
                fontSize: '2rem',
                fontWeight: '700',
              }}
            >
              Staff Dashboard
            </h1>
            <p style={{ color: '#718096', margin: 0, fontSize: '0.875rem' }}>
              Welcome, {userProfile?.name || user.email}
            </p>
          </header>

          <div style={{ marginBottom: '2rem' }}>
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '0 1.5rem 1.5rem',
                borderRadius: '12px',
                marginBottom: '1rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}
            >
              <h2
                style={{
                  paddingTop: '1.5rem',
                  color: '#2d3748',
                  fontSize: '1.25rem',
                  fontWeight: '600',
                }}
              >
                User Information
              </h2>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <p style={{ color: '#4a5568', margin: 0 }}>
                  <strong>Email:</strong> {user.email}
                </p>
                <p style={{ color: '#4a5568', margin: 0 }}>
                  <strong>Role:</strong> {userProfile?.role || 'N/A'}
                </p>
                <p style={{ color: '#4a5568', margin: 0 }}>
                  <strong>User ID:</strong> {user.id}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2
              style={{
                marginBottom: '1rem',
                color: '#2d3748',
                fontSize: '1.5rem',
                fontWeight: '600',
              }}
            >
              Staff Features
            </h2>
            <div
              style={{
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              }}
            >
              <div
                style={{
                  backgroundColor: '#ebf8ff',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #90cdf4',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    marginTop: 0,
                    color: '#2c5282',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  My Tasks
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  View and manage your assigned tasks
                </p>
              </div>
              <div
                style={{
                  backgroundColor: '#ebf8ff',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #90cdf4',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    marginTop: 0,
                    color: '#2c5282',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  My Schedule
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  Check your calendar and upcoming deadlines
                </p>
              </div>
              <div
                style={{
                  backgroundColor: '#ebf8ff',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #90cdf4',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    marginTop: 0,
                    color: '#2c5282',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  Team
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  View your team members and collaborations
                </p>
              </div>
            </div>
          </div>

          {/* Task Management Section - Integrated Create + Update + View */}
          <div style={{ marginTop: '2rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  color: '#2d3748',
                  fontSize: '1.5rem',
                  fontWeight: '600',
                }}
              >
                📋 My Assigned Tasks
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

            {loadingTasks ? (
              <div
                style={{
                  padding: '2rem',
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  textAlign: 'center',
                  color: '#666',
                }}
              >
                Loading tasks...
              </div>
            ) : tasks.length === 0 ? (
              <div
                style={{
                  padding: '2rem',
                  backgroundColor: '#fff3cd',
                  borderRadius: '12px',
                  border: '1px solid #ffc107',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{ margin: 0, fontWeight: '600', marginBottom: '8px' }}
                >
                  📝 No tasks assigned to you yet
                </p>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
                  Create your first task or wait for a manager to assign one to
                  you.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {/* Organize tasks hierarchically: parent tasks first, then their subtasks */}
                {(() => {
                  const parentTasks = tasks.filter(t => !t.parentTaskId);
                  const subtasks = tasks.filter(t => t.parentTaskId);

                  return parentTasks.map(task => (
                    <div key={task.id}>
                      {/* Parent Task Card */}
                      {editingTaskId === task.id ? (
                        /* Edit Mode - Show TaskEditCard */
                        <div>
                          <button
                            onClick={() => setEditingTaskId(null)}
                            style={{
                              marginBottom: '1rem',
                              padding: '0.5rem 1rem',
                              backgroundColor: '#6c757d',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                            }}
                          >
                            ← Back to View
                          </button>
                          <TaskEditCard taskId={task.id} />
                        </div>
                      ) : (
                        /* View Mode - Show Task Details */
                        <div
                          style={{
                            backgroundColor: '#ffffff',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: '0.75rem',
                            }}
                          >
                            <h3
                              style={{
                                margin: 0,
                                fontSize: '1.125rem',
                                fontWeight: '600',
                                color: '#1a202c',
                              }}
                            >
                              {task.title}
                            </h3>
                            <div
                              style={{
                                display: 'flex',
                                gap: '0.5rem',
                                alignItems: 'center',
                              }}
                            >
                              <span
                                style={{
                                  backgroundColor:
                                    task.status === 'TO_DO'
                                      ? '#e3f2fd'
                                      : '#f0f0f0',
                                  padding: '0.25rem 0.75rem',
                                  borderRadius: '12px',
                                  fontSize: '0.875rem',
                                  fontWeight: '500',
                                }}
                              >
                                {task.status}
                              </span>
                              <span
                                style={{
                                  backgroundColor:
                                    task.priorityBucket >= 8
                                      ? '#fee'
                                      : task.priorityBucket >= 5
                                        ? '#fff3e0'
                                        : '#f0f0f0',
                                  padding: '0.25rem 0.75rem',
                                  borderRadius: '12px',
                                  fontSize: '0.875rem',
                                  fontWeight: '500',
                                }}
                              >
                                Priority: {task.priorityBucket}
                              </span>
                              <button
                                onClick={() => setEditingTaskId(task.id)}
                                style={{
                                  padding: '0.25rem 0.75rem',
                                  backgroundColor: '#3182ce',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  fontWeight: '600',
                                }}
                              >
                                ✏️ Edit
                              </button>
                            </div>
                          </div>
                          <p
                            style={{
                              color: '#4a5568',
                              marginBottom: '0.75rem',
                              fontSize: '0.9rem',
                            }}
                          >
                            {task.description}
                          </p>
                          <div
                            style={{
                              fontSize: '0.875rem',
                              color: '#718096',
                              marginBottom: '1rem',
                            }}
                          >
                            <span>
                              📅 Due:{' '}
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                            {task.assignments &&
                              task.assignments.length > 0 && (
                                <span style={{ marginLeft: '1rem' }}>
                                  👥 {task.assignments.length} assignee(s)
                                </span>
                              )}
                          </div>

                          {/* File Upload Section */}
                          <details style={{ marginTop: '1rem' }}>
                            <summary
                              style={{
                                cursor: 'pointer',
                                fontWeight: '600',
                                color: '#3182ce',
                              }}
                            >
                              📎 Manage Files
                            </summary>
                            <div
                              style={{
                                marginTop: '1rem',
                                paddingTop: '1rem',
                                borderTop: '1px solid #e2e8f0',
                              }}
                            >
                              <TaskFileUpload taskId={task.id} />
                            </div>
                          </details>
                        </div>
                      )}

                      {/* Subtasks - Indented */}
                      {subtasks
                        .filter(subtask => subtask.parentTaskId === task.id)
                        .map(subtask => (
                          <div
                            key={subtask.id}
                            style={{
                              marginLeft: '2rem',
                              marginTop: '0.75rem',
                              maxWidth: 'calc(100% - 2rem)',
                            }}
                          >
                            {editingTaskId === subtask.id ? (
                              /* Edit Mode for Subtask */
                              <div>
                                <button
                                  onClick={() => setEditingTaskId(null)}
                                  style={{
                                    marginBottom: '1rem',
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                  }}
                                >
                                  ← Back to View
                                </button>
                                <TaskEditCard taskId={subtask.id} />
                              </div>
                            ) : (
                              /* View Mode for Subtask */
                              <div
                                style={{
                                  backgroundColor: '#f8f9fa',
                                  padding: '1rem',
                                  borderRadius: '8px',
                                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                  border: '1px solid #dee2e6',
                                  borderLeft: '3px solid #3182ce',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: '0.5rem',
                                    alignItems: 'center',
                                  }}
                                >
                                  <h4
                                    style={{
                                      margin: 0,
                                      fontSize: '1rem',
                                      fontWeight: '500',
                                      color: '#2d3748',
                                    }}
                                  >
                                    ↳ {subtask.title}
                                  </h4>
                                  <div
                                    style={{
                                      display: 'flex',
                                      gap: '0.4rem',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <span
                                      style={{
                                        backgroundColor:
                                          subtask.status === 'TO_DO'
                                            ? '#e3f2fd'
                                            : '#f0f0f0',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '10px',
                                        fontSize: '0.75rem',
                                        fontWeight: '500',
                                      }}
                                    >
                                      {subtask.status}
                                    </span>
                                    <span
                                      style={{
                                        backgroundColor:
                                          subtask.priorityBucket >= 8
                                            ? '#fee'
                                            : subtask.priorityBucket >= 5
                                              ? '#fff3e0'
                                              : '#f0f0f0',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '10px',
                                        fontSize: '0.75rem',
                                        fontWeight: '500',
                                      }}
                                    >
                                      P: {subtask.priorityBucket}
                                    </span>
                                    <button
                                      onClick={() =>
                                        setEditingTaskId(subtask.id)
                                      }
                                      style={{
                                        padding: '0.2rem 0.6rem',
                                        backgroundColor: '#3182ce',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                      }}
                                    >
                                      ✏️
                                    </button>
                                  </div>
                                </div>
                                <p
                                  style={{
                                    color: '#4a5568',
                                    marginBottom: '0.5rem',
                                    fontSize: '0.85rem',
                                  }}
                                >
                                  {subtask.description}
                                </p>
                                <div
                                  style={{
                                    fontSize: '0.8rem',
                                    color: '#718096',
                                  }}
                                >
                                  <span>
                                    📅 Due:{' '}
                                    {new Date(
                                      subtask.dueDate
                                    ).toLocaleDateString()}
                                  </span>
                                </div>

                                {/* File Upload Section for subtask */}
                                <details style={{ marginTop: '0.75rem' }}>
                                  <summary
                                    style={{
                                      cursor: 'pointer',
                                      fontWeight: '600',
                                      color: '#3182ce',
                                      fontSize: '0.85rem',
                                    }}
                                  >
                                    📎 Manage Files
                                  </summary>
                                  <div
                                    style={{
                                      marginTop: '0.75rem',
                                      paddingTop: '0.75rem',
                                      borderTop: '1px solid #dee2e6',
                                    }}
                                  >
                                    <TaskFileUpload taskId={subtask.id} />
                                  </div>
                                </details>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
