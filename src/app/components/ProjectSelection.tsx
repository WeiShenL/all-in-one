'use client';

import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import { ProjectCreateModal } from './ProjectCreateModal';
import { trpc } from '@/app/lib/trpc';

export function ProjectSelection() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const utils = trpc.useUtils();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Persist/restore active selection between navigations
  useEffect(() => {
    try {
      const saved =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('activeProjectId')
          : null;
      if (saved) {
        setActiveProjectId(saved);
      }
    } catch {}
  }, []);

  // Fetch projects using tRPC
  const {
    data: projects,
    isLoading,
    error,
  } = trpc.project.getAll.useQuery({
    isArchived: false,
  });

  const handleAddProject = () => {
    setIsCreateModalOpen(true);
  };

  const handleModalClose = () => {
    setIsCreateModalOpen(false);
  };

  const handleProjectCreated = () => {
    // Refresh the projects list so the new project appears immediately
    void utils.project.getAll.invalidate({ isArchived: false });
    setIsCreateModalOpen(false);
  };

  // Generate project icon based on first letter
  const getProjectIcon = (projectName: string) => {
    const firstLetter = projectName.charAt(0).toUpperCase();
    return firstLetter;
  };

  // Generate background color for project icon
  const getProjectIconColor = (projectName: string) => {
    const colors = [
      '#3b82f6', // blue
      '#10b981', // emerald
      '#f59e0b', // amber
      '#8b5cf6', // violet
      '#06b6d4', // cyan
      '#84cc16', // lime
      '#f97316', // orange
    ];
    const index = projectName.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Active state per item (only show when on /projects route)
  const isOnProjectsPage = pathname === '/dashboard/projects';
  const isItemActive = (projectId: string) =>
    isOnProjectsPage && activeProjectId === projectId;

  const getProjectItemStyles = (projectId?: string) => {
    const isActive = projectId ? isItemActive(projectId) : false;
    return {
      color: isActive ? '#1976d2' : '#495057',
      backgroundColor: isActive ? '#e3f2fd' : 'transparent',
      borderLeft: isActive ? '3px solid #1976d2' : '3px solid transparent',
    } as React.CSSProperties;
  };

  const getProjectMessage = () => {
    if (!userProfile) {
      return 'No projects yet';
    }

    switch (userProfile.role) {
      case 'STAFF':
        return 'Wait for a manager to add you to your first project';
      case 'MANAGER':
        return 'Create your first project';
      case 'HR_ADMIN':
        return 'Create your first project';
      default:
        return 'No projects yet';
    }
  };

  const shouldShowAddButton = () => {
    if (!userProfile) {
      return false;
    }
    return userProfile.role === 'MANAGER' || userProfile.role === 'HR_ADMIN';
  };

  return (
    <div
      style={{
        padding: '1rem',
        borderTop: '1px solid #dee2e6',
      }}
    >
      {/* Projects Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}
      >
        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: 'bold',
            color: '#495057',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Projects
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Add Button - Only show for MANAGER and HR_ADMIN */}
          {shouldShowAddButton() && (
            <button
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                color: '#6c757d',
                borderRadius: '4px',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={handleAddProject}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#e9ecef';
                e.currentTarget.style.color = '#495057';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#6c757d';
              }}
              title='Add Project'
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Project List or Message */}
      {isLoading ? (
        <p
          style={{
            fontSize: '0.75rem',
            color: '#6c757d',
            margin: 0,
            fontStyle: 'italic',
          }}
        >
          Loading projects...
        </p>
      ) : error ? (
        <p
          style={{
            fontSize: '0.75rem',
            color: '#dc3545',
            margin: 0,
            fontStyle: 'italic',
          }}
        >
          Failed to load projects
        </p>
      ) : projects && projects.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxHeight: (projects?.length ?? 0) > 4 ? '200px' : 'none',
            overflowY: (projects?.length ?? 0) > 4 ? 'auto' : 'visible',
            paddingRight: (projects?.length ?? 0) > 4 ? '0.25rem' : 0,
          }}
        >
          {(projects || []).map(project => (
            <div
              key={project.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                cursor: 'pointer',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                height: '56px',
                ...getProjectItemStyles(project.id),
              }}
              onMouseEnter={e => {
                if (!isItemActive(project.id)) {
                  e.currentTarget.style.backgroundColor = '#e3f2fd';
                  e.currentTarget.style.color = '#1976d2';
                  e.currentTarget.style.transform = 'translateX(4px)';
                  e.currentTarget.style.boxShadow =
                    '0 2px 8px rgba(25, 118, 210, 0.15)';
                }
              }}
              onMouseLeave={e => {
                if (!isItemActive(project.id)) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#495057';
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
              onClick={() => {
                // Navigate to projects page
                setActiveProjectId(project.id);
                try {
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('activeProjectId', project.id);
                  }
                } catch {}
                router.push('/dashboard/projects');
              }}
            >
              {/* Project Icon */}
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: getProjectIconColor(project.name),
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}
              >
                {getProjectIcon(project.name)}
              </div>

              {/* Project Name */}
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#495057',
                  fontWeight: '500',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
                title={project.name}
              >
                {project.name}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p
          style={{
            fontSize: '0.75rem',
            color: '#6c757d',
            margin: 0,
            fontStyle: 'italic',
          }}
        >
          {getProjectMessage()}
        </p>
      )}

      {/* Project Create Modal */}
      <ProjectCreateModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        onCreated={handleProjectCreated}
      />
    </div>
  );
}
