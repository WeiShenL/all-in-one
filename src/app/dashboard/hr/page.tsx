'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Navbar from '@/app/components/Navbar';

export default function HRDashboard() {
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
              HR Admin Dashboard
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
              HR Admin Features
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
                  backgroundColor: '#f0fff4',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #9ae6b4',
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#22543d',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  User Management
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  Create, update, and manage user accounts
                </p>
              </div>
              <div
                style={{
                  backgroundColor: '#f0fff4',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #9ae6b4',
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#22543d',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  Role Assignment
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  Assign and modify user roles and permissions
                </p>
              </div>
              <div
                style={{
                  backgroundColor: '#f0fff4',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #9ae6b4',
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#22543d',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  Department Management
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  Manage departments and organizational structure
                </p>
              </div>
              <div
                style={{
                  backgroundColor: '#f0fff4',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #9ae6b4',
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#22543d',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  System Reports
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  Access company-wide reports and analytics
                </p>
              </div>
              <div
                style={{
                  backgroundColor: '#f0fff4',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #9ae6b4',
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#22543d',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  Audit Logs
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  View system audit logs and security events
                </p>
              </div>
              <div
                style={{
                  backgroundColor: '#f0fff4',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #9ae6b4',
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#22543d',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  Settings
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  Configure system-wide settings and policies
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
