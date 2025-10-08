'use client';

import { TaskCreateForm } from '@/app/components/TaskCreateForm';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';

export default function CreateTaskPage() {
  const router = useRouter();
  const { userProfile } = useAuth();

  // Get dashboard route based on user role (same logic as Navbar)
  const getDashboardRoute = () => {
    if (!userProfile?.role) {
      return '/dashboard';
    }

    const roleRoutes = {
      STAFF: '/dashboard/staff',
      MANAGER: '/dashboard/manager',
      HR_ADMIN: '/dashboard/hr',
    };

    return roleRoutes[userProfile.role] || '/dashboard';
  };

  return (
    <div className='container mx-auto p-6 max-w-4xl'>
      <h1 className='text-3xl font-bold mb-6'>Create New Task</h1>
      <TaskCreateForm
        onSuccess={_task => {
          // Redirect to role-based dashboard
          router.push(getDashboardRoute());
        }}
        onCancel={() => {
          router.push(getDashboardRoute());
        }}
      />
    </div>
  );
}
