'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Navbar from '@/app/components/Navbar';
import { CompanyDashboard } from '@/app/components/CompanyDashboard';

export default function CompanyPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }

    // Access control: Only HR/Admin users can access this page
    if (!loading && user && userProfile) {
      if (!userProfile.isHrAdmin && userProfile.role !== 'HR_ADMIN') {
        router.push('/dashboard/personal');
      }
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

  if (!user || !userProfile) {
    return null;
  }

  // Check if user is HR/Admin
  if (!userProfile.isHrAdmin && userProfile.role !== 'HR_ADMIN') {
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
        <div
          style={{
            backgroundColor: '#fff3cd',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #ffc107',
            maxWidth: '500px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#856404', margin: 0, fontWeight: '600' }}>
            Access Denied
          </p>
          <p style={{ color: '#856404', margin: '0.5rem 0 0 0' }}>
            Only HR/Admin users can access the Company Overview dashboard.
          </p>
        </div>
      </div>
    );
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
              Company Dashboard
            </h1>
            <p
              style={{
                color: '#718096',
                margin: 0,
                fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
              }}
            >
              Welcome, {userProfile.name || user.email}
            </p>
          </header>

          {/* Company-Wide Task Dashboard - Shows all tasks with canEdit based on role */}
          <div>
            <CompanyDashboard />
          </div>
        </div>
      </div>
    </div>
  );
}
