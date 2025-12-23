'use client';

import { useState } from 'react';
import { trpc } from '@/app/lib/trpc';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserManagementModal({
  isOpen,
  onClose,
}: UserManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [showInactive, setShowInactive] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'STAFF' as 'STAFF' | 'MANAGER' | 'HR_ADMIN',
    departmentId: '',
    isHrAdmin: false,
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Queries
  const { data: users, refetch: refetchUsers } =
    trpc.userManagement.getAllUsers.useQuery(
      { includeInactive: showInactive },
      { enabled: isOpen }
    );
  const { data: departments } = trpc.department.getAll.useQuery(undefined, {
    enabled: isOpen,
  });

  // Mutations
  const createUserMutation = trpc.userManagement.createUser.useMutation({
    onSuccess: () => {
      setSuccess('User created successfully!');
      setError('');
      refetchUsers();
      resetForm();
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: error => {
      setError(error.message);
      setSuccess('');
    },
  });

  const updateUserMutation = trpc.userManagement.updateUser.useMutation({
    onSuccess: () => {
      setSuccess('User updated successfully!');
      setError('');
      refetchUsers();
      setEditingUserId(null);
      resetForm();
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: error => {
      setError(error.message);
      setSuccess('');
    },
  });

  const deactivateUserMutation = trpc.userManagement.deactivateUser.useMutation(
    {
      onSuccess: () => {
        setSuccess('User deactivated successfully!');
        refetchUsers();
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: error => {
        setError(error.message);
      },
    }
  );

  const reactivateUserMutation = trpc.userManagement.reactivateUser.useMutation(
    {
      onSuccess: () => {
        setSuccess('User reactivated successfully!');
        refetchUsers();
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: error => {
        setError(error.message);
      },
    }
  );

  const resetPasswordMutation =
    trpc.userManagement.resetUserPassword.useMutation({
      onSuccess: () => {
        setSuccess('Password reset successfully!');
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: error => {
        setError(error.message);
      },
    });

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'STAFF',
      departmentId: '',
      isHrAdmin: false,
    });
    setEditingUserId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (editingUserId) {
      updateUserMutation.mutate({
        id: editingUserId,
        ...formData,
      });
    } else {
      if (!formData.password) {
        setError('Password is required for new users');
        return;
      }
      createUserMutation.mutate(formData);
    }
  };

  const handleEdit = (user: any) => {
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      isHrAdmin: user.isHrAdmin,
    });
    setEditingUserId(user.id);
    setActiveTab('create');
  };

  const handleResetPassword = (userId: string) => {
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (newPassword && newPassword.length >= 6) {
      resetPasswordMutation.mutate({ id: userId, newPassword });
    } else if (newPassword) {
      setError('Password must be at least 6 characters');
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
          maxWidth: '900px',
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
            User Management
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

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            padding: '0 1.5rem',
          }}
        >
          <button
            onClick={() => setActiveTab('list')}
            style={{
              padding: '1rem 1.5rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom:
                activeTab === 'list'
                  ? '2px solid #3182ce'
                  : '2px solid transparent',
              color: activeTab === 'list' ? '#3182ce' : '#718096',
              fontWeight: activeTab === 'list' ? '600' : '400',
            }}
          >
            User List
          </button>
          <button
            onClick={() => {
              setActiveTab('create');
              if (!editingUserId) {
                resetForm();
              }
            }}
            style={{
              padding: '1rem 1.5rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom:
                activeTab === 'create'
                  ? '2px solid #3182ce'
                  : '2px solid transparent',
              color: activeTab === 'create' ? '#3182ce' : '#718096',
              fontWeight: activeTab === 'create' ? '600' : '400',
            }}
          >
            {editingUserId ? 'Edit User' : 'Create User'}
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

          {activeTab === 'list' && (
            <div>
              {/* Show Inactive Toggle */}
              <div style={{ marginBottom: '1rem' }}>
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
                    checked={showInactive}
                    onChange={e => setShowInactive(e.target.checked)}
                  />
                  Show inactive users
                </label>
              </div>

              {/* User Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f7fafc' }}>
                      <th
                        style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#4a5568',
                        }}
                      >
                        Name
                      </th>
                      <th
                        style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#4a5568',
                        }}
                      >
                        Email
                      </th>
                      <th
                        style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#4a5568',
                        }}
                      >
                        Role
                      </th>
                      <th
                        style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#4a5568',
                        }}
                      >
                        Department
                      </th>
                      <th
                        style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#4a5568',
                        }}
                      >
                        Status
                      </th>
                      <th
                        style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#4a5568',
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users?.map(user => (
                      <tr
                        key={user.id}
                        style={{ borderBottom: '1px solid #e2e8f0' }}
                      >
                        <td style={{ padding: '0.75rem' }}>{user.name}</td>
                        <td style={{ padding: '0.75rem' }}>{user.email}</td>
                        <td style={{ padding: '0.75rem' }}>
                          {user.role}
                          {user.isHrAdmin && (
                            <span
                              style={{
                                marginLeft: '0.5rem',
                                fontSize: '0.75rem',
                                color: '#805ad5',
                              }}
                            >
                              (HR Admin)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {user.department?.name || 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <span
                            style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              backgroundColor: user.isActive
                                ? '#c6f6d5'
                                : '#fed7d7',
                              color: user.isActive ? '#22543d' : '#c53030',
                            }}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleEdit(user)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#3182ce',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleResetPassword(user.id)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#805ad5',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              Reset PW
                            </button>
                            {user.isActive ? (
                              <button
                                onClick={() =>
                                  deactivateUserMutation.mutate({
                                    id: user.id,
                                  })
                                }
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#e53e3e',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                }}
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  reactivateUserMutation.mutate({
                                    id: user.id,
                                  })
                                }
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#38a169',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                }}
                              >
                                Reactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'create' && (
            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                    Name *
                  </label>
                  <input
                    type='text'
                    required
                    value={formData.name}
                    onChange={e =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                    Email *
                  </label>
                  <input
                    type='email'
                    required
                    value={formData.email}
                    onChange={e =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                    Password{' '}
                    {editingUserId ? '(leave blank to keep current)' : '*'}
                  </label>
                  <input
                    type='password'
                    required={!editingUserId}
                    value={formData.password}
                    onChange={e =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder={
                      editingUserId ? 'Leave blank to keep current' : ''
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                    Role *
                  </label>
                  <select
                    required
                    value={formData.role}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        role: e.target.value as any,
                      })
                    }
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
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                    Department *
                  </label>
                  <select
                    required
                    value={formData.departmentId}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        departmentId: e.target.value,
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                    }}
                  >
                    <option value=''>Select department</option>
                    {departments?.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {'  '.repeat(dept.level || 0)}
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

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
                      checked={formData.isHrAdmin}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          isHrAdmin: e.target.checked,
                        })
                      }
                    />
                    <span style={{ fontSize: '0.875rem' }}>
                      Grant HR Admin privileges
                    </span>
                  </label>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    justifyContent: 'flex-end',
                    marginTop: '1rem',
                  }}
                >
                  {editingUserId && (
                    <button
                      type='button'
                      onClick={() => {
                        resetForm();
                        setActiveTab('list');
                      }}
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
                  )}
                  <button
                    type='submit'
                    disabled={
                      createUserMutation.isPending ||
                      updateUserMutation.isPending
                    }
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3182ce',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      opacity:
                        createUserMutation.isPending ||
                        updateUserMutation.isPending
                          ? 0.5
                          : 1,
                    }}
                  >
                    {createUserMutation.isPending ||
                    updateUserMutation.isPending
                      ? 'Saving...'
                      : editingUserId
                        ? 'Update User'
                        : 'Create User'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
