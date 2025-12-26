'use client';

import { useState } from 'react';
import { trpc } from '@/app/lib/trpc';

interface DepartmentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepartmentManagementModal({
  isOpen,
  onClose,
}: DepartmentManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    parentId: '',
    managerId: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Queries
  const { data: departments, refetch: refetchDepartments } =
    trpc.department.getAll.useQuery(undefined, { enabled: isOpen });
  const { data: users } = trpc.userProfile.getAll.useQuery(undefined, {
    enabled: isOpen,
  });

  // Mutations
  const createDepartmentMutation = trpc.department.create.useMutation({
    onSuccess: () => {
      setSuccess('Department created successfully!');
      setError('');
      refetchDepartments();
      resetForm();
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: error => {
      setError(error.message);
      setSuccess('');
    },
  });

  const updateDepartmentMutation = trpc.department.update.useMutation({
    onSuccess: () => {
      setSuccess('Department updated successfully!');
      setError('');
      refetchDepartments();
      setEditingDeptId(null);
      resetForm();
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: error => {
      setError(error.message);
      setSuccess('');
    },
  });

  const deleteDepartmentMutation = trpc.department.delete.useMutation({
    onSuccess: () => {
      setSuccess('Department deleted successfully!');
      refetchDepartments();
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: error => {
      setError(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      parentId: '',
      managerId: '',
    });
    setEditingDeptId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (editingDeptId) {
      updateDepartmentMutation.mutate({
        id: editingDeptId,
        name: formData.name,
        parentId: formData.parentId || null,
        managerId: formData.managerId || null,
      });
    } else {
      createDepartmentMutation.mutate({
        name: formData.name,
        parentId: formData.parentId || undefined,
        managerId: formData.managerId || undefined,
      });
    }
  };

  const handleEdit = (dept: any) => {
    setFormData({
      name: dept.name,
      parentId: dept.parentId || '',
      managerId: dept.managerId || '',
    });
    setEditingDeptId(dept.id);
    setActiveTab('create');
  };

  const handleDelete = (deptId: string, deptName: string) => {
    if (
      confirm(
        `Are you sure you want to delete "${deptName}"? This will soft-delete the department.`
      )
    ) {
      deleteDepartmentMutation.mutate({ id: deptId });
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
          maxWidth: '800px',
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
            Department Management
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
            Department List
          </button>
          <button
            onClick={() => {
              setActiveTab('create');
              if (!editingDeptId) {
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
            {editingDeptId ? 'Edit Department' : 'Create Department'}
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
              {/* Department List */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {departments?.map(dept => (
                  <div
                    key={dept.id}
                    style={{
                      padding: '1rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600' }}>
                        {'  '.repeat(dept.level || 0)}
                        {dept.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#718096',
                          marginTop: '0.25rem',
                        }}
                      >
                        Level {dept.level}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleEdit(dept)}
                        style={{
                          padding: '0.25rem 0.75rem',
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
                        onClick={() => handleDelete(dept.id, dept.name)}
                        style={{
                          padding: '0.25rem 0.75rem',
                          fontSize: '0.75rem',
                          backgroundColor: '#e53e3e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
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
                    Department Name *
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
                    Parent Department (optional)
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={e =>
                      setFormData({ ...formData, parentId: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                    }}
                  >
                    <option value=''>-- None (Root Department) --</option>
                    {departments
                      ?.filter(d => d.id !== editingDeptId)
                      .map(dept => (
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
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                    Department Manager (optional)
                  </label>
                  <select
                    value={formData.managerId}
                    onChange={e =>
                      setFormData({ ...formData, managerId: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                    }}
                  >
                    <option value=''>-- No Manager Assigned --</option>
                    {users?.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email}) - {user.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    justifyContent: 'flex-end',
                    marginTop: '1rem',
                  }}
                >
                  {editingDeptId && (
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
                      createDepartmentMutation.isPending ||
                      updateDepartmentMutation.isPending
                    }
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3182ce',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      opacity:
                        createDepartmentMutation.isPending ||
                        updateDepartmentMutation.isPending
                          ? 0.5
                          : 1,
                    }}
                  >
                    {createDepartmentMutation.isPending ||
                    updateDepartmentMutation.isPending
                      ? 'Saving...'
                      : editingDeptId
                        ? 'Update Department'
                        : 'Create Department'}
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
