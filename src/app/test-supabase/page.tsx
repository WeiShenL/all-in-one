'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/supabase/auth-context';
import { testSupabaseConnection } from '../../lib/test-supabase';

export default function TestSupabasePage() {
  const { user, userProfile, loading } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(
    null
  );
  const [testLoading, setTestLoading] = useState(false);

  const runConnectionTest = async () => {
    setTestLoading(true);
    try {
      const result = await testSupabaseConnection();
      setConnectionStatus(result);
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus(false);
    } finally {
      setTestLoading(false);
    }
  };

  useEffect(() => {
    runConnectionTest();
  }, []);

  if (loading) {
    return <div className='p-8'>Loading...</div>;
  }

  return (
    <div className='p-8 max-w-4xl mx-auto'>
      <h1 className='text-3xl font-bold mb-6'>Supabase Connection Test</h1>

      <div className='grid gap-6'>
        {/* Connection Status */}
        <div className='border rounded-lg p-4'>
          <h2 className='text-xl font-semibold mb-3'>Connection Status</h2>
          <div className='flex items-center gap-2'>
            {testLoading ? (
              <span className='text-blue-600'>Testing connection...</span>
            ) : connectionStatus === true ? (
              <span className='text-green-600 font-medium'>
                ✅ Connected successfully
              </span>
            ) : connectionStatus === false ? (
              <span className='text-red-600 font-medium'>
                ❌ Connection failed
              </span>
            ) : (
              <span className='text-gray-600'>⏳ Testing...</span>
            )}
          </div>
          <button
            onClick={runConnectionTest}
            disabled={testLoading}
            className='mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50'
          >
            {testLoading ? 'Testing...' : 'Test Connection Again'}
          </button>
        </div>

        {/* Auth Status */}
        <div className='border rounded-lg p-4'>
          <h2 className='text-xl font-semibold mb-3'>Authentication Status</h2>
          {user ? (
            <div className='space-y-2'>
              <p className='text-green-600 font-medium'>
                ✅ User authenticated
              </p>
              <div className='bg-gray-50 p-3 rounded'>
                <p>
                  <strong>User ID:</strong> {user.id}
                </p>
                <p>
                  <strong>Email:</strong> {user.email}
                </p>
                <p>
                  <strong>Created:</strong>{' '}
                  {new Date(user.created_at).toLocaleString()}
                </p>
              </div>
              {userProfile && (
                <div className='bg-blue-50 p-3 rounded'>
                  <p className='font-medium text-blue-800'>User Profile:</p>
                  <p>
                    <strong>Name:</strong> {userProfile.name || 'Not set'}
                  </p>
                  <p>
                    <strong>Role:</strong> {userProfile.role}
                  </p>
                  <p>
                    <strong>Department ID:</strong>{' '}
                    {userProfile.departmentId || 'Not assigned'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className='text-orange-600'>🔐 No user authenticated</p>
          )}
        </div>

        {/* Environment Variables */}
        <div className='border rounded-lg p-4'>
          <h2 className='text-xl font-semibold mb-3'>
            Environment Configuration
          </h2>
          <div className='space-y-2 text-sm'>
            <p>
              <strong>API URL:</strong>{' '}
              <code className='bg-gray-100 px-2 py-1 rounded'>
                {process.env.NEXT_PUBLIC_API_EXTERNAL_URL || 'Not set'}
              </code>
            </p>
            <p>
              <strong>Anon Key:</strong>{' '}
              <code className='bg-gray-100 px-2 py-1 rounded'>
                {process.env.NEXT_PUBLIC_ANON_KEY ? '✅ Set' : '❌ Not set'}
              </code>
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className='border rounded-lg p-4'>
          <h2 className='text-xl font-semibold mb-3'>Quick Actions</h2>
          <div className='space-y-2'>
            <p className='text-sm text-gray-600'>
              This test page verifies that Supabase authentication is properly
              configured. If all checks pass, you can implement login/signup
              functionality.
            </p>
            <div className='flex gap-2'>
              <button className='px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700'>
                ✅ Auth Setup Complete
              </button>
              <Link
                href='/'
                className='px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 inline-block'
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
