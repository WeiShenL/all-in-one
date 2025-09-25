'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import AuthNavbar from '../components/AuthNavbar';

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
        }}
      >
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div>
      <AuthNavbar />
      <main style={{ padding: '2rem' }}>
        <h1
          style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}
        >
          Task Management Dashboard
        </h1>
        <p style={{ color: '#666', fontSize: '1.125rem' }}>
          Dashboard will be implemented here. Welcome, {user.email}!
        </p>
      </main>
    </div>
  );
}
