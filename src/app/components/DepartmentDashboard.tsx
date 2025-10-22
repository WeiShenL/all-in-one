'use client';

import { useState } from 'react';
import { TaskTable } from './TaskTable';
import { trpc } from '../lib/trpc';
import ProjectCollaboratorsManager from './ProjectCollaboratorsManager';

/**
 * Department Dashboard Component
 * Shows tasks from user's department hierarchy with role-based edit permissions
 * Matches structure of Personal Dashboard (StaffDashboard)
 */
export function DepartmentDashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [showCollaborators, setShowCollaborators] = useState(false);

  // Try to get utils for query invalidation (may not be available in test environment)
  let utils;
  try {
    utils = trpc.useUtils();
  } catch {
    // useUtils not available (e.g., in test environment without provider)
    utils = null;
  }

  const { data, isLoading, error } =
    trpc.task.getDepartmentTasksForUser.useQuery();

  // Get unique projects from tasks
  const { data: projects } = trpc.project.getAll.useQuery();

  const handleTaskCreated = utils
    ? () => {
        // Invalidate the query to trigger a refetch
        utils.task.getDepartmentTasksForUser.invalidate();
      }
    : undefined;

  const handleTaskUpdated = utils
    ? () => {
        // Invalidate the query to trigger a refetch
        utils.task.getDepartmentTasksForUser.invalidate();
      }
    : undefined;

  return (
    <div>
      <TaskTable
        tasks={data || []}
        title='All Tasks'
        showCreateButton={true}
        onTaskCreated={handleTaskCreated}
        onTaskUpdated={handleTaskUpdated}
        emptyStateConfig={{
          icon: '📁',
          title: 'No tasks in your department yet',
          description:
            'Create your first task or wait for tasks to be added to your department.',
        }}
        isLoading={isLoading}
        error={error ? new Error(error.message) : null}
      />

      {/* Project Collaborators Section - Only show if there are projects */}
      {projects && projects.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '1.5rem',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2
              style={{
                color: '#2d3748',
                fontSize: '1.25rem',
                fontWeight: '600',
                marginBottom: '1rem',
              }}
            >
              Manage Project Collaborators
            </h2>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor='project-select'
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#4a5568',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                Select a Project:
              </label>
              <select
                id='project-select'
                value={selectedProjectId || ''}
                onChange={e => {
                  setSelectedProjectId(e.target.value || null);
                  setShowCollaborators(!!e.target.value);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e0',
                  fontSize: '1rem',
                  backgroundColor: 'white',
                }}
              >
                <option value=''>
                  Select a project to manage collaborators
                </option>
                {projects.map((project: any) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {showCollaborators && selectedProjectId && (
              <ProjectCollaboratorsManager
                projectId={selectedProjectId}
                projectName={
                  projects.find((p: any) => p.id === selectedProjectId)?.name
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
