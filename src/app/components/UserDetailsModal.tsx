'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { trpc } from '@/app/lib/trpc';

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserDetailsModal({ isOpen, onClose }: UserDetailsModalProps) {
  const { user, userProfile } = useAuth();

  // Fetch department name if user has a departmentId
  const { data: department } = trpc.department.getById.useQuery(
    { id: userProfile?.departmentId ?? '' },
    { enabled: !!userProfile?.departmentId }
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-label='User details'
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: 'min(420px, 90vw)',
          padding: '1rem 1.25rem',
          boxShadow: '0 10px 24px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            borderBottom: '1px solid #e9ecef',
            paddingBottom: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1rem', color: '#212529' }}>
            User Details
          </h2>
        </div>
        <div style={{ display: 'grid', rowGap: '0.5rem' }}>
          <div style={{ color: '#6c757d', fontSize: '0.9rem' }}>Name:</div>
          <div style={{ color: '#212529', fontWeight: 600 }}>
            {userProfile?.name || '-'}
          </div>
          <div
            style={{
              color: '#6c757d',
              fontSize: '0.9rem',
              marginTop: '0.5rem',
            }}
          >
            Email:
          </div>
          <div style={{ color: '#212529', wordBreak: 'break-all' }}>
            {user?.email}
          </div>
          <div
            style={{
              color: '#6c757d',
              fontSize: '0.9rem',
              marginTop: '0.5rem',
            }}
          >
            Role:
          </div>
          <div style={{ color: '#212529', textTransform: 'capitalize' }}>
            {(userProfile?.role || 'staff').toLowerCase()}
          </div>
          <div
            style={{
              color: '#6c757d',
              fontSize: '0.9rem',
              marginTop: '0.5rem',
            }}
          >
            Department:
          </div>
          <div style={{ color: '#212529' }}>{department?.name || '-'}</div>
          <div
            style={{
              color: '#6c757d',
              fontSize: '0.9rem',
              marginTop: '0.5rem',
            }}
          >
            Admin Status:
          </div>
          <div style={{ color: '#212529', fontWeight: 600 }}>
            {userProfile?.isHrAdmin || userProfile?.role === 'HR_ADMIN'
              ? 'Yes'
              : 'No'}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '1rem',
          }}
        >
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#e9ecef',
              color: '#212529',
              border: '1px solid #dee2e6',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
