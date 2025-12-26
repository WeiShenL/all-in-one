'use client';

import { useState } from 'react';
import { trpc } from '@/app/lib/trpc';

interface RoleAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoleAssignmentModal({
  isOpen,
  onClose,
}: RoleAssignmentModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<
    'STAFF' | 'MANAGER' | 'HR_ADMIN'
  >('STAFF');
  const [isHrAdmin, setIsHrAdmin] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Queries
  const { data: users, refetch: refetchUsers } =
    trpc.userProfile.getAll.useQuery(undefined, { enabled: isOpen });

  // Mutation
  const updateUserMutation = trpc.userProfile.update.useMutation({
    onSuccess: () => {
      setSuccess('Role updated successfully!');
      setError('');
      refetchUsers();
      setSelectedUserId('');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: error => {
      setError(error.message);
      setSuccess('');
    },
  });

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    const user = users?.find(u => u.id === userId);
    if (user) {
      setSelectedRole(user.role as any);
      setIsHrAdmin(user.isHrAdmin || false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }

    updateUserMutation.mutate({
      id: selectedUserId,
      role: selectedRole,
      isHrAdmin,
    });
  };

  if (!isOpen) {
    return null;
  }

  const selectedUser = users?.find(u => u.id === selectedUserId);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
            Role Assignment
          </h2>
          <button
            onClick={onClose}
            style={{
              fontSize: '1.5rem',
              color: '#718096',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Messages */}
          {error && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#fee',
                color: '#c53030',
                borderRadius: '6px',
                marginBottom: '1rem',
              }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#c6f6d5',
                color: '#22543d',
                borderRadius: '6px',
                marginBottom: '1rem',
              }}
            >
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
              }}
            >
              {/* User Selection */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                  }}
                >
                  Select User *
                </label>
                <select
                  required
                  value={selectedUserId}
                  onChange={e => handleUserSelect(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                  }}
                >
                  <option value=''>-- Select a user --</option>
                  {users?.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email}) - Current: {user.role}
                      {user.isHrAdmin ? ' (HR Admin)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedUser && (
                <>
                  {/* Current Info */}
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: '#f7fafc',
                      borderRadius: '6px',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Current Assignment
                    </h3>
                    <p style={{ fontSize: '0.875rem', margin: 0 }}>
                      <strong>Role:</strong> {selectedUser.role}
                      <br />
                      <strong>HR Admin:</strong>{' '}
                      {selectedUser.isHrAdmin ? 'Yes' : 'No'}
                      <br />
                      <strong>Department:</strong>{' '}
                      {selectedUser.department?.name || 'N/A'}
                    </p>
                  </div>

                  {/* Role Selection */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                      }}
                    >
                      New Role *
                    </label>
                    <select
                      required
                      value={selectedRole}
                      onChange={e => setSelectedRole(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #cbd5e0',
                        borderRadius: '4px',
                      }}
                    >
                      <option value='STAFF'>Staff</option>
                      <option value='MANAGER'>Manager</option>
                      <option value='HR_ADMIN'>HR Admin</option>
                    </select>
                    <p
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.75rem',
                        color: '#718096',
                      }}
                    >
                      {selectedRole === 'STAFF' &&
                        'Staff members can view and manage their own tasks'}
                      {selectedRole === 'MANAGER' &&
                        'Managers can view their department hierarchy and manage team tasks'}
                      {selectedRole === 'HR_ADMIN' &&
                        'HR Admins have access to all company data and settings'}
                    </p>
                  </div>

                  {/* HR Admin Toggle */}
                  <div>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type='checkbox'
                        checked={isHrAdmin}
                        onChange={e => setIsHrAdmin(e.target.checked)}
                      />
                      <span style={{ fontSize: '0.875rem' }}>
                        Grant HR Admin privileges
                      </span>
                    </label>
                    <p
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.75rem',
                        color: '#718096',
                      }}
                    >
                      HR Admin privileges grant access to user management,
                      company-wide reports, and administrative functions
                    </p>
                  </div>
                </>
              )}

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  justifyContent: 'flex-end',
                  marginTop: '1rem',
                }}
              >
                <button
                  type='button'
                  onClick={onClose}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#e2e8f0',
                    color: '#2d3748',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={!selectedUserId || updateUserMutation.isPending}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#3182ce',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    opacity:
                      !selectedUserId || updateUserMutation.isPending ? 0.5 : 1,
                  }}
                >
                  {updateUserMutation.isPending ? 'Updating...' : 'Update Role'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
