import { testSupabaseConnection } from '@/lib/test-supabase';

export default async function Home() {
  const isConnected = await testSupabaseConnection();

  return (
    <main className='p-8'>
      <h1 className='text-2xl font-bold mb-4'>All-In-One Task Manager</h1>
      <div className='bg-gray-100 p-4 rounded-lg mb-4'>
        <p className='font-semibold'>
          Supabase Connection: {isConnected ? '✅ Connected' : '❌ Failed'}
        </p>
      </div>
      <p>Next.js application with TypeScript, ESLint, and App Router.</p>
      <p>Ready for development!</p>

      <div style={{ marginTop: '2rem' }}>
        <a
          href='/auth/login'
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            padding: '0.75rem 1.5rem',
            textDecoration: 'none',
            borderRadius: '4px',
            display: 'inline-block',
          }}
        >
          Login / Sign Up
        </a>
      </div>
    </main>
  );
}
