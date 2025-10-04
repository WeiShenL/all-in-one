'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Navbar from '@/app/components/Navbar';

export default function ManagerDashboard() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

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
              Manager Dashboard
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
              Manager Features
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
                  backgroundColor: '#fef5e7',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #f9c74f',
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#975a16',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  Team Management
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  Manage your team members and assignments
                </p>
              </div>
              <div
                style={{
                  backgroundColor: '#fef5e7',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #f9c74f',
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#975a16',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  Task Approval
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  Review and approve team tasks
                </p>
              </div>
              <div
                style={{
                  backgroundColor: '#fef5e7',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #f9c74f',
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#975a16',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  Reports
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  View team performance and analytics
                </p>
              </div>
              <div
                style={{
                  backgroundColor: '#fef5e7',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #f9c74f',
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#975a16',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  Department Overview
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  Monitor department-wide activities
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
