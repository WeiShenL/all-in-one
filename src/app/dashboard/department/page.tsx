'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Navbar from '@/app/components/Navbar';
import { DepartmentDashboard } from '@/app/components/DepartmentDashboard';

export default function DepartmentDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
    // No role restriction - all authenticated users can access
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
      <div
        style={{
          padding: 'clamp(1rem, 3vw, 2rem)',
          maxWidth: '100%',
          marginLeft: '280px', // Account for sidebar width
        }}
        className='main-content'
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
              Department Dashboard
            </h1>
            <p
              style={{
                color: '#718096',
                margin: 0,
                fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
              }}
            >
              Welcome, {user.email}
            </p>
          </header>

          {/* Removed in-page User Information panel (now shown in Navbar modal) */}

          {/* Department Task Dashboard - Shows hierarchy tasks with conditional Edit */}
          <div>
            <DepartmentDashboard />
          </div>
        </div>
      </div>

      {/* CSS for responsive behavior */}
      <style jsx>{`
        @media (max-width: 768px) {
          .main-content {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
