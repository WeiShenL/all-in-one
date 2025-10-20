'use client';

import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { ProjectDashboard } from '../../components/ProjectDashboard';

export default function ProjectsPage() {
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );

  useEffect(() => {
    try {
      const name =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('activeProjectName')
          : null;
      const id =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('activeProjectId')
          : null;
      if (name) {
        setSelectedTitle(name);
      }
      if (id) {
        setSelectedProjectId(id);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { id?: string; name?: string }
        | undefined;
      if (detail?.name) {
        setSelectedTitle(detail.name);
      } else {
        const name = sessionStorage.getItem('activeProjectName');
        if (name) {
          setSelectedTitle(name);
        }
      }
      if (detail && 'id' in detail && detail.id) {
        setSelectedProjectId(detail.id);
      } else {
        const id = sessionStorage.getItem('activeProjectId');
        if (id) {
          setSelectedProjectId(id);
        }
      }
    };
    window.addEventListener('activeProjectChanged', handler as EventListener);
    return () =>
      window.removeEventListener(
        'activeProjectChanged',
        handler as EventListener
      );
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f7fafc',
      }}
    >
      <Navbar />
      <div
        style={{
          padding: 'clamp(1rem, 3vw, 2rem)',
          maxWidth: '100%',
          marginLeft: '280px', // Account for sidebar width
        }}
        className='main-content'
      >
        <div
          style={{
            maxWidth: 'min(100%, 1600px)',
            margin: '0 auto',
            width: '100%',
          }}
        >
          <header
            style={{
              marginBottom: 'clamp(1rem, 2vw, 2rem)',
              paddingBottom: '1rem',
              borderBottom: '2px solid #e2e8f0',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h1
                style={{
                  margin: 0,
                  color: '#1a202c',
                  fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                  fontWeight: '700',
                }}
              >
                {selectedTitle || 'Projects'}
              </h1>
            </div>
          </header>

          {selectedProjectId && (
            <ProjectDashboard
              projectId={selectedProjectId}
              title={selectedTitle || 'Project Tasks'}
            />
          )}
        </div>
      </div>

      {/* CSS for responsive behavior */}
      <style jsx>{`
        @media (max-width: 768px) {
          .main-content {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
