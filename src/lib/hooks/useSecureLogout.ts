'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';

export function useSecureLogout() {
  const { signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  const handleSecureLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      // Call Supabase signOut - this invalidates session token automatically
      const { error } = await signOut();

      if (error) {
        console.error('Logout error:', error);
        // Still redirect even if there's an error to be safe
      }

      // Redirect to login page
      router.push('/auth/login');
    } catch (error) {
      console.error('Unexpected logout error:', error);
      // Still redirect to login page for security
      router.push('/auth/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return {
    handleSecureLogout,
    isLoggingOut,
  };
}
