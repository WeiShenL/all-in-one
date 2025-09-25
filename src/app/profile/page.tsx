'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import AuthNavbar from '../components/AuthNavbar';

export default function ProfilePage() {
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
          User Profile
        </h1>
        <div
          style={{
            backgroundColor: '#f8f9fa',
            padding: '1.5rem',
            borderRadius: '8px',
            maxWidth: '600px',
          }}
        >
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>Email:</strong> {user.email}
          </p>
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>Full Name:</strong> {userProfile?.name || 'Not set'}
          </p>
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>Role:</strong> {userProfile?.role || 'Not set'}
          </p>
          <p style={{ color: '#666', marginTop: '1rem' }}>
            Profile editing will be implemented here.
          </p>
        </div>
      </main>
    </div>
  );
}
