'use client';

import { useState } from 'react';
import { trpc } from '../lib/trpc';

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (project: { id: string; name: string }) => void;
}

export function ProjectCreateModal({
  isOpen,
  onClose,
  onCreated,
}: ProjectCreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Safely access tRPC mutation, handle case where tRPC context is not available
  let createMutation;
  try {
    createMutation = trpc?.project?.create?.useMutation?.();
  } catch {
    // tRPC context not available (e.g., in test environment)
    createMutation = {
      mutateAsync: async () => {
        throw new Error('tRPC context not available');
      },
      isLoading: false,
    };
  }

  // Ensure isLoading property exists for TypeScript
  const isLoading = (createMutation as any)?.isLoading ?? false;

  const resetState = () => {
    setName('');
    setDescription('');
    setPriority('');
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Project name is required');
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        name: trimmed,
        description: description.trim() || undefined,
        priority: typeof priority === 'number' ? priority : undefined,
      });
      setSuccess(`✅ Project "${result.name}" created`);
      if (onCreated) {
        onCreated(result);
      }
      // Leave the banner visible briefly, then close
      setTimeout(() => {
        resetState();
        void onClose();
      }, 1200);
    } catch (e: any) {
      setError(e?.message || 'Failed to create project');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          position: 'relative',
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          backgroundClip: 'padding-box',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            padding: '0.5rem',
            backgroundColor: '#e2e8f0',
            color: '#4a5568',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '1rem',
            lineHeight: 1,
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>

        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Create Project</h3>

        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#fee',
              color: '#c00',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            ❌ {error}
          </div>
        )}
        {success && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#efe',
              color: '#070',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            {success}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Project Name <span style={{ color: 'red' }}>*</span>
            </div>
            <input
              type='text'
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='e.g., Customer Portal'
              style={{
                display: 'block',
                width: '100%',
                padding: '8px',
                fontSize: '0.875rem',
                border: '1px solid #cbd5e0',
                borderRadius: '4px',
                backgroundColor: '#ffffff',
              }}
              data-testid='project-name-input'
            />
          </label>

          <label>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Description</div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder='Optional description'
              style={{
                display: 'block',
                width: '100%',
                padding: '8px',
                fontSize: '0.875rem',
                border: '1px solid #cbd5e0',
                borderRadius: '4px',
                backgroundColor: '#ffffff',
              }}
              data-testid='project-description-input'
            />
          </label>

          <label>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Priority (1-10)
            </div>
            <input
              type='number'
              min={1}
              max={10}
              value={priority}
              onChange={e => {
                const v = e.target.value;
                setPriority(
                  v === '' ? '' : Math.max(1, Math.min(10, Number(v)))
                );
              }}
              placeholder='5'
              style={{
                display: 'block',
                width: '100%',
                padding: '8px',
                fontSize: '0.875rem',
                border: '1px solid #cbd5e0',
                borderRadius: '4px',
                backgroundColor: '#ffffff',
              }}
              data-testid='project-priority-input'
            />
          </label>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 8,
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: isLoading ? '#9ca3af' : '#3182ce',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
              data-testid='project-create-button'
            >
              {isLoading ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
