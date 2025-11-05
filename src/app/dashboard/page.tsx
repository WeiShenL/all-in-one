'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import { DashboardProvider } from '@/lib/context/DashboardContext';
import Navbar from '../components/Navbar';
import { UnifiedDashboard } from '../components/UnifiedDashboard';

function DashboardContent() {
  return (
    <DashboardProvider>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f7fafc',
        }}
      >
        <Navbar />
        <UnifiedDashboard />
      </div>
    </DashboardProvider>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
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
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
