import Button from '@/components/Button';

export default function Home() {
  return (
    <main className='flex min-h-screen flex-col items-center justify-center p-24'>
      <h1 className='text-4xl font-bold mb-8'>All-in-One Project</h1>
      <p className='text-xl mb-8'>
        Next.js application with TypeScript, ESLint, and App Router.
      </p>
      <div className='space-x-4'>
        <Button onClick={() => alert('Primary clicked!')}>
          Primary Button
        </Button>
        <Button variant='secondary' onClick={() => alert('Secondary clicked!')}>
          Secondary Button
        </Button>
      </div>
      <p className='mt-8'>Ready for development!</p>
    </main>
  );
}
