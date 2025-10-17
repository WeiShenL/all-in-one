'use client';

import { useState } from 'react';
import { ProjectCreateModal } from '../components/ProjectCreateModal';

export default function ProjectsPage() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h1 style={{ margin: 0 }}>Projects</h1>
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
      <p style={{ color: '#6b7280' }}>
        Use the button above to create a project.
      </p>

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
