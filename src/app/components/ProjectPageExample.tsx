/**
 * Example usage of ProjectCollaboratorsManager
 *
 * This file demonstrates how to integrate the ProjectCollaboratorsManager
 * into an existing project page or dashboard.
 */

import React from 'react';
import { ProjectCollaboratorsManager } from './ProjectCollaboratorsManager';
import { ProjectManagementDashboard } from './ProjectManagementDashboard';

// Example 1: Simple integration in a project page
export function ProjectPageExample({ projectId }: { projectId: string }) {
  return (
    <div className='max-w-6xl mx-auto p-6'>
      <ProjectManagementDashboard
        projectId={projectId}
        projectName='Sample Project'
      />
    </div>
  );
}

// Example 2: Standalone collaborators manager
export function CollaboratorsOnlyExample({ projectId }: { projectId: string }) {
  return (
    <div className='max-w-4xl mx-auto p-6'>
      <h1 className='text-2xl font-bold mb-6'>Manage Project Collaborators</h1>
      <ProjectCollaboratorsManager
        projectId={projectId}
        projectName='Sample Project'
      />
    </div>
  );
}

// Example 3: Integration in a modal or sidebar
export function CollaboratorsModalExample({
  projectId,
  isOpen,
  onClose,
}: {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
      <div className='bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto'>
        <div className='p-6'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-xl font-semibold'>Project Collaborators</h2>
            <button
              onClick={onClose}
              className='text-gray-400 hover:text-gray-600'
            >
              ✕
            </button>
          </div>
          <ProjectCollaboratorsManager
            projectId={projectId}
            projectName='Sample Project'
          />
        </div>
      </div>
    </div>
  );
}
