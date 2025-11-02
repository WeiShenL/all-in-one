export default function Home() {
  return (
    <main className='p-8'>
      <h1 className='text-2xl font-bold mb-4'>All-In-One Task Manager</h1>
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
