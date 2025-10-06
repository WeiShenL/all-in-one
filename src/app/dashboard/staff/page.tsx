'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/app/components/Navbar';
import { TaskFileUpload } from '@/app/components/TaskFileUpload';

export default function StaffDashboard() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [task, setTask] = useState<{ id: string; title: string } | null>(null);
  const [loadingTask, setLoadingTask] = useState(true);

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
          `/api/trpc/taskFile.getUserTasks?input=${encodeURIComponent(JSON.stringify({ userId: userProfile.id }))}`
        );
        const data = await response.json();

        if (data.result?.data?.tasks?.length > 0) {
          setTask(data.result.data.tasks[0]); // Get first task
        }
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
      } finally {
        setLoadingTask(false);
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

          {/* File Upload Test Section */}
          {task && (
            <div style={{ marginTop: '2rem' }}>
              <h2
                style={{
                  marginBottom: '1rem',
                  color: '#2d3748',
                  fontSize: '1.5rem',
                  fontWeight: '600',
                }}
              >
                📎 My Task - File Upload Test
              </h2>
              <div
                style={{
                  backgroundColor: '#ffffff',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
              >
                <h3
                  style={{
                    marginBottom: '1rem',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  {task.title}
                </h3>
                <p style={{ color: '#4a5568', marginBottom: '1rem' }}>
                  {task.description}
                </p>
                <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                  <span
                    style={{
                      backgroundColor: '#e3f2fd',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      marginRight: '0.5rem',
                    }}
                  >
                    {task.status}
                  </span>
                  <span
                    style={{
                      backgroundColor: '#fff3e0',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    {task.priority}
                  </span>
                </div>

                <h4
                  style={{
                    marginTop: '1.5rem',
                    marginBottom: '1rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                  }}
                >
                  Upload Files
                </h4>
                <TaskFileUpload taskId={task.id} />
              </div>
            </div>
          )}

          {!task && !loadingTask && (
            <div
              style={{
                marginTop: '2rem',
                padding: '1rem',
                backgroundColor: '#fff3cd',
                borderRadius: '8px',
              }}
            >
              <p style={{ margin: 0 }}>
                No tasks found. Please run the SQL script from
                FILE_UPLOAD_TESTING_GUIDE.md
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
