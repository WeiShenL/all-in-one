'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Navbar from '@/app/components/Navbar';
import { PersonalDashboard } from '@/app/components/PersonalDashboard';

export default function PersonalDashboardPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, userProfile, loading, router]);

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
      <div
        style={{
          padding: 'clamp(1rem, 3vw, 2rem)',
          maxWidth: '100%',
        }}
      >
        <div
          style={{
            maxWidth: 'min(100%, 1600px)',
            margin: '0 auto',
            width: '100%',
          }}
        >
          <header
            style={{
              marginBottom: 'clamp(1rem, 2vw, 2rem)',
              paddingBottom: '1rem',
              borderBottom: '2px solid #e2e8f0',
            }}
          >
            <h1
              style={{
                marginBottom: '0.5rem',
                color: '#1a202c',
                fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                fontWeight: '700',
              }}
            >
              Personal Dashboard
            </h1>
            <p
              style={{
                color: '#718096',
                margin: 0,
                fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
              }}
            >
              Welcome, {userProfile?.name || user.email}
            </p>
          </header>

          <div style={{ marginBottom: 'clamp(1rem, 2vw, 2rem)' }}>
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: 'clamp(1rem, 2vw, 1.5rem)',
                borderRadius: '12px',
                marginBottom: '1rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}
            >
              <h2
                style={{
                  color: '#2d3748',
                  fontSize: 'clamp(1rem, 3vw, 1.25rem)',
                  fontWeight: '600',
                  marginBottom: '1rem',
                }}
              >
                User Information
              </h2>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <p
                  style={{
                    color: '#4a5568',
                    margin: 0,
                    fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                    wordBreak: 'break-word',
                  }}
                >
                  <strong>Email:</strong> {user.email}
                </p>
                <p
                  style={{
                    color: '#4a5568',
                    margin: 0,
                    fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                  }}
                >
                  <strong>Role:</strong> {userProfile?.role || 'N/A'}
                </p>
                <p
                  style={{
                    color: '#4a5568',
                    margin: 0,
                    fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                    wordBreak: 'break-all',
                  }}
                >
                  <strong>User ID:</strong> {user.id}
                </p>
              </div>
            </div>
          </div>

          {/* Personal Task Dashboard - Shows only assigned tasks with Edit button */}
          <div>
            <PersonalDashboard />
          </div>
        </div>
      </div>
    </div>
  );
}
