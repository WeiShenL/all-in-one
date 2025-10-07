'use client';

import { TaskCreateForm } from '@/app/components/TaskCreateForm';
import { useRouter } from 'next/navigation';

export default function CreateTaskPage() {
  const router = useRouter();

  return (
    <div className='container mx-auto p-6 max-w-4xl'>
      <h1 className='text-3xl font-bold mb-6'>Create New Task</h1>
      <TaskCreateForm
        onSuccess={_task => {
          // Redirect to dashboard or task detail page
          router.push('/dashboard');
        }}
        onCancel={() => {
          router.push('/dashboard');
        }}
      />
    </div>
  );
}
