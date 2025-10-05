'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient();

      try {
        // Get the session after email confirmation
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        console.warn(
          '🔍 [Auth Callback] Session:',
          session?.user?.id,
          'Error:',
          error
        );

        if (error) {
          console.error('🔍 [Auth Callback] Error:', error);
          router.push('/auth/login?error=callback_failed');
          return;
        }

        if (session) {
          console.warn(
            '🔍 [Auth Callback] Session found, redirecting to login...'
          );
          // Redirect to login page which will then redirect to appropriate dashboard
          router.push('/auth/login');
        } else {
          console.warn('🔍 [Auth Callback] No session found');
          router.push('/auth/login');
        }
      } catch (err) {
        console.error('🔍 [Auth Callback] Unexpected error:', err);
        router.push('/auth/login?error=callback_failed');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #3182ce',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <p style={{ color: '#718096' }}>Completing sign up...</p>
      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
