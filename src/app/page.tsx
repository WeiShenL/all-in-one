'use client';

export default function Home() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>All-in-One Project</h1>
      <p>Next.js application with TypeScript, ESLint, and App Router.</p>
      <p>Ready for development!</p>

      <div style={{ marginTop: '2rem' }}>
        <a
          href='/login'
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
