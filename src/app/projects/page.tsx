'use client';

import { useState } from 'react';
import { ProjectCreateModal } from '../components/ProjectCreateModal';
import Navbar from '../components/Navbar';

export default function ProjectsPage() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
                Projects
              </h1>
              <button
                onClick={() => setOpen(true)}
                style={{
                  backgroundColor: '#3182ce',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                data-testid='open-project-modal'
              >
                + Create Project
              </button>
            </div>
          </header>

          <div
            style={{
              backgroundColor: '#ffffff',
              padding: 'clamp(1rem, 2vw, 1.5rem)',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
          >
            {notice && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#efe',
                  color: '#070',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                }}
                data-testid='project-success-banner'
              >
                {notice}
              </div>
            )}

            {/* Minimal page per user story; listing is out of scope */}
            <p style={{ color: '#6b7280', margin: 0 }}>
              Use the button above to create a project.
            </p>
          </div>
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

      <ProjectCreateModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onCreated={p => {
          setNotice(`Project "${p.name}" created`);
          setOpen(false);
          setTimeout(() => setNotice(null), 3000);
        }}
      />
    </div>
  );
}
