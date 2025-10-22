import React from 'react';
import { trpc } from '@/app/lib/trpc';
import { useSession } from 'next-auth/react';
import { ProjectCollaboratorsManager } from './ProjectCollaboratorsManager';
import { ProjectDashboard } from './ProjectDashboard';
import { Users, Settings, AlertCircle } from 'lucide-react';

interface ProjectManagementDashboardProps {
  projectId: string;
  projectName?: string;
}

const ProjectManagementDashboard: React.FC<ProjectManagementDashboardProps> = ({
  projectId,
  projectName: _projectName,
}) => {
  const { data: session } = useSession();
  const currentUserRole = session?.user?.role;

  // Get project details
  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = trpc.project.getById.useQuery({ id: projectId });

  const canManageProject =
    currentUserRole === 'MANAGER' || currentUserRole === 'HR_ADMIN';

  if (projectLoading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
        <span className='ml-2 text-gray-600'>Loading project...</span>
      </div>
    );
  }

  if (projectError) {
    return (
      <div className='flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-md'>
        <AlertCircle className='h-5 w-5 text-red-600' />
        <p className='text-red-800'>
          Error loading project: {projectError.message}
        </p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className='flex items-center space-x-2 p-4 bg-yellow-50 border border-yellow-200 rounded-md'>
        <AlertCircle className='h-5 w-5 text-yellow-600' />
        <p className='text-yellow-800'>Project not found</p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Project Header */}
      <div className='bg-white p-6 border rounded-lg shadow-sm'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>{project.name}</h1>
            {project.description && (
              <p className='text-gray-600 mt-1'>{project.description}</p>
            )}
            <div className='flex items-center space-x-4 mt-2 text-sm text-gray-500'>
              <span>
                Status: <span className='font-medium'>{project.status}</span>
              </span>
              <span>
                Priority:{' '}
                <span className='font-medium'>{project.priority}/10</span>
              </span>
              <span>
                Created:{' '}
                <span className='font-medium'>
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </span>
            </div>
          </div>
          {canManageProject && (
            <div className='flex items-center space-x-2 text-sm text-blue-600'>
              <Settings className='h-4 w-4' />
              <span>Management Mode</span>
            </div>
          )}
        </div>
      </div>

      {/* Management Section - Only visible to managers */}
      {canManageProject && (
        <div className='space-y-6'>
          <div className='flex items-center space-x-2 text-lg font-semibold text-gray-900'>
            <Users className='h-5 w-5' />
            <span>Project Management</span>
          </div>

          <ProjectCollaboratorsManager
            projectId={projectId}
            projectName={project.name}
          />
        </div>
      )}

      {/* Tasks Section - Visible to all users */}
      <div className='space-y-4'>
        <div className='flex items-center space-x-2 text-lg font-semibold text-gray-900'>
          <span>📋</span>
          <span>Project Tasks</span>
        </div>

        <ProjectDashboard
          projectId={projectId}
          title={`Tasks in ${project.name}`}
        />
      </div>
    </div>
  );
};

export default ProjectManagementDashboard;
