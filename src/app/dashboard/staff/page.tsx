'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/app/components/Navbar';
import { TaskEditCard } from '@/app/components/TaskEditCard';

export default function StaffDashboard() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  // Fetch user's tasks
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

        if (data.result?.data?.tasks?.length > 0) {
          setTasks(data.result.data.tasks);
          setSelectedTaskId(data.result.data.tasks[0].id); // Select first task
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
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '1rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}
            >
              <h2
                style={{
                  marginBottom: '1rem',
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
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
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
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
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
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
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

          {/* Task Management Section */}
          <div style={{ marginTop: '2rem' }}>
            <h2
              style={{
                marginBottom: '1rem',
                color: '#2d3748',
                fontSize: '1.5rem',
                fontWeight: '600',
              }}
            >
              📋 My Assigned Tasks
            </h2>

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
                }}
              >
                <p
                  style={{ margin: 0, fontWeight: '600', marginBottom: '8px' }}
                >
                  📝 No tasks found
                </p>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
                  Run the SQL script from{' '}
                  <code
                    style={{
                      backgroundColor: '#fff',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    scripts/seed-test-tasks-comprehensive.sql
                  </code>{' '}
                  to create test tasks.
                </p>
              </div>
            ) : (
              <div>
                {/* Task Selector */}
                {tasks.length > 1 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        marginBottom: '8px',
                        color: '#4a5568',
                      }}
                    >
                      Select Task:
                    </label>
                    <select
                      value={selectedTaskId || ''}
                      onChange={e => setSelectedTaskId(e.target.value)}
                      style={{
                        width: '100%',
                        maxWidth: '500px',
                        padding: '10px',
                        border: '2px solid #cbd5e0',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {tasks.map(task => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Task Edit Card */}
                {selectedTaskId && <TaskEditCard taskId={selectedTaskId} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
