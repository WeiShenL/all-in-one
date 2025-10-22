import React, { useState } from 'react';
import { trpc } from '@/app/lib/trpc';
import { useAuth } from '@/lib/supabase/auth-context';
import { Users, UserMinus, AlertTriangle, Shield, Mail } from 'lucide-react';

interface ProjectCollaboratorsManagerProps {
  projectId: string;
  projectName?: string;
}

interface Collaborator {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId: string;
  isHrAdmin: boolean;
  isActive: boolean;
}

const ProjectCollaboratorsManager: React.FC<
  ProjectCollaboratorsManagerProps
> = ({ projectId, projectName = 'this project' }) => {
  const { userProfile } = useAuth();
  const currentUserRole = userProfile?.role;
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const {
    data: collaborators,
    isLoading,
    error,
    refetch,
  } = trpc.project.getProjectCollaborators.useQuery({ projectId });
  const removeProjectCollaboratorMutation =
    trpc.project.removeProjectCollaborator.useMutation({
      onSuccess: () => {
        alert('Collaborator removed successfully!');
        refetch();
        setRemovingUserId(null);
      },
      onError: err => {
        alert(`Error removing collaborator: ${err.message}`);
        setRemovingUserId(null);
      },
    });

  const handleRemoveCollaborator = async (collaborator: Collaborator) => {
    const confirmMessage = `Are you sure you want to remove ${collaborator.name} from ${projectName}?\n\nThis will:\n• Remove them from all tasks in this project\n• Revoke their access to view this project\n• Send them a notification about the removal`;

    if (window.confirm(confirmMessage)) {
      setRemovingUserId(collaborator.id);
      await removeProjectCollaboratorMutation.mutateAsync({
        projectId,
        userId: collaborator.id,
      });
    }
  };

  const canManageCollaborators =
    currentUserRole === 'MANAGER' || currentUserRole === 'HR_ADMIN';

  if (isLoading) {
    return (
      <div className='p-6 border rounded-lg shadow-sm bg-white'>
        <div className='flex items-center space-x-2 mb-4'>
          <Users className='h-5 w-5 text-blue-600' />
          <h3 className='text-lg font-semibold'>Project Collaborators</h3>
        </div>
        <div className='flex items-center justify-center py-8'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
          <span className='ml-2 text-gray-600'>Loading collaborators...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='p-6 border rounded-lg shadow-sm bg-white'>
        <div className='flex items-center space-x-2 mb-4'>
          <Users className='h-5 w-5 text-blue-600' />
          <h3 className='text-lg font-semibold'>Project Collaborators</h3>
        </div>
        <div className='flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-md'>
          <AlertTriangle className='h-5 w-5 text-red-600' />
          <p className='text-red-800'>
            Error loading collaborators: {error.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='p-6 border rounded-lg shadow-sm bg-white'>
      <div className='flex items-center justify-between mb-6'>
        <div className='flex items-center space-x-2'>
          <Users className='h-5 w-5 text-blue-600' />
          <h3 className='text-lg font-semibold'>Project Collaborators</h3>
          <span className='bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full'>
            {collaborators?.length || 0}
          </span>
        </div>
        {!canManageCollaborators && (
          <div className='flex items-center space-x-1 text-sm text-gray-500'>
            <Shield className='h-4 w-4' />
            <span>View only</span>
          </div>
        )}
      </div>

      {collaborators && collaborators.length > 0 ? (
        <div className='space-y-3'>
          {collaborators.map(collaborator => (
            <div
              key={collaborator.id}
              className='flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors'
            >
              <div className='flex items-center space-x-3'>
                <div className='flex-shrink-0'>
                  <div className='w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center'>
                    <span className='text-blue-600 font-medium text-sm'>
                      {collaborator.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center space-x-2'>
                    <p className='font-medium text-gray-900 truncate'>
                      {collaborator.name}
                    </p>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        collaborator.role === 'MANAGER'
                          ? 'bg-purple-100 text-purple-800'
                          : collaborator.role === 'HR_ADMIN'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {collaborator.role}
                    </span>
                    {collaborator.isHrAdmin && (
                      <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800'>
                        HR Admin
                      </span>
                    )}
                  </div>
                  <div className='flex items-center space-x-1 mt-1'>
                    <Mail className='h-3 w-3 text-gray-400' />
                    <p className='text-sm text-gray-500 truncate'>
                      {collaborator.email}
                    </p>
                  </div>
                  {!collaborator.isActive && (
                    <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 mt-1'>
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {canManageCollaborators && (
                <div className='flex-shrink-0'>
                  <button
                    onClick={() => handleRemoveCollaborator(collaborator)}
                    disabled={
                      removeProjectCollaboratorMutation.isLoading ||
                      removingUserId === collaborator.id
                    }
                    className='inline-flex items-center space-x-1 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                  >
                    {removingUserId === collaborator.id ? (
                      <>
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-red-600'></div>
                        <span>Removing...</span>
                      </>
                    ) : (
                      <>
                        <UserMinus className='h-4 w-4' />
                        <span>Remove</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className='text-center py-8'>
          <Users className='h-12 w-12 text-gray-400 mx-auto mb-4' />
          <h4 className='text-lg font-medium text-gray-900 mb-2'>
            No Collaborators
          </h4>
          <p className='text-gray-500'>
            This project doesn&apos;t have any collaborators yet. Collaborators
            are automatically added when users are assigned to tasks in this
            project.
          </p>
        </div>
      )}

      {canManageCollaborators && collaborators && collaborators.length > 0 && (
        <div className='mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md'>
          <div className='flex items-start space-x-2'>
            <AlertTriangle className='h-5 w-5 text-blue-600 mt-0.5' />
            <div className='text-sm text-blue-800'>
              <p className='font-medium mb-1'>About Removing Collaborators</p>
              <ul className='list-disc list-inside space-y-1'>
                <li>
                  Removing a collaborator will remove them from all tasks in
                  this project
                </li>
                <li>
                  They will lose access to view this project and its tasks
                </li>
                <li>A notification will be sent to the removed user</li>
                <li>This action cannot be undone</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectCollaboratorsManager;
