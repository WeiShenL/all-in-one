'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/app/components/Navbar';
import { ProjectReportExportButton } from '@/app/components/ProjectReport/ProjectReportExportButton';
import { ProjectReportPreview } from '@/app/components/ProjectReport/ProjectReportPreview';
import { trpc } from '@/app/lib/trpc';

type ActiveSection =
  | 'userManagement'
  | 'roleAssignment'
  | 'departmentManagement'
  | 'reports'
  | null;

export default function HRDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);

  // User Management state
  const [userTab, setUserTab] = useState<'list' | 'create'>('list');
  const [showInactive, setShowInactive] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'STAFF' as 'STAFF' | 'MANAGER' | 'HR_ADMIN',
    departmentId: '',
    isHrAdmin: false,
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');

  // Role Assignment state
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<
    'STAFF' | 'MANAGER' | 'HR_ADMIN'
  >('STAFF');
  const [isHrAdmin, setIsHrAdmin] = useState(false);

  // Department Management state
  const [deptTab, setDeptTab] = useState<'list' | 'create'>('list');
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptFormData, setDeptFormData] = useState({
    name: '',
    parentId: '',
    managerId: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch all projects for dropdown
  const { data: projects } = trpc.project.getAll.useQuery(
    { isArchived: false },
    {
      enabled: !loading && !!user,
    }
  );

  // Queries for inline sections
  const { data: users, refetch: refetchUsers } =
    trpc.userManagement.getAllUsers.useQuery(
      { includeInactive: showInactive },
      { enabled: !!user && activeSection === 'userManagement' }
    );
  const { data: departments, refetch: refetchDepartments } =
    trpc.department.getAll.useQuery(undefined, {
      enabled:
        !!user &&
        (activeSection === 'userManagement' ||
          activeSection === 'departmentManagement' ||
          activeSection === 'roleAssignment'),
    });
  const { data: allUsers } = trpc.userProfile.getAll.useQuery(undefined, {
    enabled:
      !!user &&
      (activeSection === 'roleAssignment' ||
        activeSection === 'departmentManagement'),
  });

  // Mutations
  const createUserMutation = trpc.userManagement.createUser.useMutation({
    onSuccess: () => {
      setSuccess('User created successfully!');
      setError('');
      refetchUsers();
      resetUserForm();
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
      resetUserForm();
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
        setShowPasswordModal(false);
        setNewPassword('');
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: error => {
        setError(error.message);
      },
    });

  const updateRoleMutation = trpc.userProfile.update.useMutation({
    onSuccess: () => {
      setSuccess('Role updated successfully!');
      setError('');
      setSelectedUserId('');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: error => {
      setError(error.message);
      setSuccess('');
    },
  });

  const createDepartmentMutation = trpc.department.create.useMutation({
    onSuccess: () => {
      setSuccess('Department created successfully!');
      setError('');
      refetchDepartments();
      resetDeptForm();
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
      resetDeptForm();
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

  // Helper functions
  const resetUserForm = () => {
    setUserFormData({
      email: '',
      password: '',
      name: '',
      role: 'STAFF',
      departmentId: '',
      isHrAdmin: false,
    });
    setEditingUserId(null);
  };

  const resetDeptForm = () => {
    setDeptFormData({
      name: '',
      parentId: '',
      managerId: '',
    });
    setEditingDeptId(null);
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (editingUserId) {
      updateUserMutation.mutate({ id: editingUserId, ...userFormData });
    } else {
      if (!userFormData.password) {
        setError('Password is required for new users');
        return;
      }
      createUserMutation.mutate(userFormData);
    }
  };

  const handleEditUser = (user: any) => {
    setUserFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      isHrAdmin: user.isHrAdmin,
    });
    setEditingUserId(user.id);
    setUserTab('create');
  };

  const handleResetPassword = (userId: string) => {
    setResetPasswordUserId(userId);
    setShowPasswordModal(true);
  };

  const handlePasswordModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword.length >= 6) {
      resetPasswordMutation.mutate({ id: resetPasswordUserId, newPassword });
    } else {
      setError('Password must be at least 6 characters');
    }
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    const user = allUsers?.find(u => u.id === userId);
    if (user) {
      setSelectedRole(user.role as any);
      setIsHrAdmin(user.isHrAdmin || false);
    }
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }
    updateRoleMutation.mutate({
      id: selectedUserId,
      role: selectedRole,
      isHrAdmin,
    });
  };

  const handleDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (editingDeptId) {
      updateDepartmentMutation.mutate({
        id: editingDeptId,
        name: deptFormData.name,
        parentId: deptFormData.parentId || null,
        managerId: deptFormData.managerId || null,
      });
    } else {
      createDepartmentMutation.mutate({
        name: deptFormData.name,
        parentId: deptFormData.parentId || undefined,
        managerId: deptFormData.managerId || undefined,
      });
    }
  };

  const handleEditDept = (dept: any) => {
    setDeptFormData({
      name: dept.name,
      parentId: dept.parentId || '',
      managerId: dept.managerId || '',
    });
    setEditingDeptId(dept.id);
    setDeptTab('create');
  };

  const handleDeleteDept = (deptId: string, deptName: string) => {
    if (
      confirm(
        `Are you sure you want to delete "${deptName}"? This will soft-delete the department.`
      )
    ) {
      deleteDepartmentMutation.mutate({ id: deptId });
    }
  };

  // Preview is now handled by ProjectReportPreview component

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#f7fafc',
        }}
      >
        <p style={{ color: '#718096' }}>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
          padding: '2rem',
          marginLeft: '280px', // Account for sidebar width
        }}
        className='main-content'
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <header
            style={{
              marginBottom: '2rem',
              paddingBottom: '1rem',
              borderBottom: '2px solid #e2e8f0',
            }}
          >
            <h1
              style={{
                marginBottom: '0.5rem',
                color: '#1a202c',
                fontSize: '2rem',
                fontWeight: '700',
              }}
            >
              HR Admin Dashboard
            </h1>
            {/* Removed inline welcome that duplicates user info */}
          </header>

          {/* Removed in-page User Information panel (now shown in Navbar modal) */}

          <div>
            <h2
              style={{
                marginBottom: '1rem',
                color: '#2d3748',
                fontSize: '1.5rem',
                fontWeight: '600',
              }}
            >
              HR Admin Features
            </h2>
            <div
              style={{
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              }}
            >
              <button
                onClick={() =>
                  setActiveSection(
                    activeSection === 'userManagement' ? null : 'userManagement'
                  )
                }
                style={{
                  backgroundColor: '#f0fff4',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #9ae6b4',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#e6ffed';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#f0fff4';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#22543d',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  User Management
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  Create, update, and manage user accounts
                </p>
              </button>
              <button
                onClick={() =>
                  setActiveSection(
                    activeSection === 'roleAssignment' ? null : 'roleAssignment'
                  )
                }
                style={{
                  backgroundColor: '#f0fff4',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #9ae6b4',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#e6ffed';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#f0fff4';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#22543d',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  Role Assignment
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  Assign and modify user roles and permissions
                </p>
              </button>
              <button
                onClick={() =>
                  setActiveSection(
                    activeSection === 'departmentManagement'
                      ? null
                      : 'departmentManagement'
                  )
                }
                style={{
                  backgroundColor: '#f0fff4',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #9ae6b4',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#e6ffed';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#f0fff4';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#22543d',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  Department Management
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  Manage departments and organizational structure
                </p>
              </button>
              <button
                onClick={() =>
                  setActiveSection(
                    activeSection === 'reports' ? null : 'reports'
                  )
                }
                style={{
                  backgroundColor:
                    activeSection === 'reports' ? '#e6ffed' : '#f0fff4',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border:
                    activeSection === 'reports'
                      ? '2px solid #48bb78'
                      : '1px solid #9ae6b4',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  if (activeSection !== 'reports') {
                    e.currentTarget.style.backgroundColor = '#e6ffed';
                  }
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={e => {
                  if (activeSection !== 'reports') {
                    e.currentTarget.style.backgroundColor = '#f0fff4';
                  }
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: '#22543d',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  System Reports
                </h3>
                <p
                  style={{ color: '#4a5568', fontSize: '0.875rem', margin: 0 }}
                >
                  View project reports and analytics
                </p>
              </button>
            </div>
          </div>

          {/* Project Reports Section - Toggleable */}
          {activeSection === 'reports' && (
            <div style={{ marginTop: '2rem' }}>
              <h2
                style={{
                  marginBottom: '1rem',
                  color: '#2d3748',
                  fontSize: '1.5rem',
                  fontWeight: '600',
                }}
              >
                Project Reports
              </h2>

              <div
                style={{
                  backgroundColor: 'white',
                  padding: '2rem',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                  }}
                >
                  {/* Description */}
                  <div>
                    <h3
                      style={{
                        fontSize: '1.125rem',
                        fontWeight: '600',
                        color: '#1a202c',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Export Project Reports
                    </h3>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        color: '#718096',
                        margin: 0,
                      }}
                    >
                      Generate comprehensive reports for any project including
                      tasks, collaborators, and statistics. Export as PDF or
                      Excel.
                    </p>
                  </div>

                  {/* Project Selection */}
                  <div>
                    <label
                      htmlFor='project-select'
                      style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Select Project
                    </label>
                    <select
                      id='project-select'
                      data-testid='project-select-dropdown'
                      value={selectedProjectId}
                      onChange={e => setSelectedProjectId(e.target.value)}
                      style={{
                        width: '100%',
                        maxWidth: '400px',
                        padding: '0.625rem 1rem',
                        fontSize: '0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: 'white',
                        color: '#1f2937',
                        cursor: 'pointer',
                      }}
                    >
                      <option value=''>-- Select a project --</option>
                      {projects?.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.name} ({project.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Export Button */}
                  <div>
                    {selectedProjectId ? (
                      <ProjectReportExportButton
                        projectId={selectedProjectId}
                        projectName={
                          projects?.find(p => p.id === selectedProjectId)
                            ?.name || 'Project'
                        }
                      />
                    ) : (
                      <div
                        style={{
                          padding: '0.625rem 1rem',
                          backgroundColor: '#f3f4f6',
                          color: '#6b7280',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          display: 'inline-block',
                        }}
                      >
                        Select a project to enable export
                      </div>
                    )}
                  </div>

                  {/* PDF Preview */}
                  {selectedProjectId && (
                    <ProjectReportPreview projectId={selectedProjectId} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* User Management Section */}
          {activeSection === 'userManagement' && (
            <div
              style={{
                marginTop: '2rem',
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
              }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  marginBottom: '1.5rem',
                }}
              >
                User Management
              </h2>

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

              {/* Tabs */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid #e2e8f0',
                  marginBottom: '1.5rem',
                }}
              >
                <button
                  onClick={() => setUserTab('list')}
                  style={{
                    padding: '1rem 1.5rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    borderBottom:
                      userTab === 'list'
                        ? '2px solid #3182ce'
                        : '2px solid transparent',
                    color: userTab === 'list' ? '#3182ce' : '#718096',
                    fontWeight: userTab === 'list' ? '600' : '400',
                  }}
                >
                  User List
                </button>
                <button
                  onClick={() => {
                    setUserTab('create');
                    if (!editingUserId) {
                      resetUserForm();
                    }
                  }}
                  style={{
                    padding: '1rem 1.5rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    borderBottom:
                      userTab === 'create'
                        ? '2px solid #3182ce'
                        : '2px solid transparent',
                    color: userTab === 'create' ? '#3182ce' : '#718096',
                    fontWeight: userTab === 'create' ? '600' : '400',
                  }}
                >
                  {editingUserId ? 'Edit User' : 'Create User'}
                </button>
              </div>

              {userTab === 'list' && (
                <div>
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
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        minWidth: '900px',
                      }}
                    >
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
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '0.5rem',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <button
                                  onClick={() => handleEditUser(user)}
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

              {userTab === 'create' && (
                <form onSubmit={handleUserSubmit}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      maxWidth: '600px',
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
                        value={userFormData.name}
                        onChange={e =>
                          setUserFormData({
                            ...userFormData,
                            name: e.target.value,
                          })
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
                        value={userFormData.email}
                        onChange={e =>
                          setUserFormData({
                            ...userFormData,
                            email: e.target.value,
                          })
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
                        value={userFormData.password}
                        onChange={e =>
                          setUserFormData({
                            ...userFormData,
                            password: e.target.value,
                          })
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
                        value={userFormData.role}
                        onChange={e =>
                          setUserFormData({
                            ...userFormData,
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
                        value={userFormData.departmentId}
                        onChange={e =>
                          setUserFormData({
                            ...userFormData,
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
                          checked={userFormData.isHrAdmin}
                          onChange={e =>
                            setUserFormData({
                              ...userFormData,
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
                            resetUserForm();
                            setUserTab('list');
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
          )}

          {/* Password Reset Modal */}
          {showPasswordModal && (
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
              onClick={() => setShowPasswordModal(false)}
            >
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '2rem',
                  maxWidth: '400px',
                  width: '90%',
                }}
                onClick={e => e.stopPropagation()}
              >
                <h3
                  style={{
                    marginBottom: '1rem',
                    fontSize: '1.25rem',
                    fontWeight: '600',
                  }}
                >
                  Reset Password
                </h3>
                <form onSubmit={handlePasswordModalSubmit}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      New Password (min 6 characters) *
                    </label>
                    <input
                      type='password'
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #cbd5e0',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      type='button'
                      onClick={() => {
                        setShowPasswordModal(false);
                        setNewPassword('');
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
                    <button
                      type='submit'
                      disabled={resetPasswordMutation.isPending}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#3182ce',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        opacity: resetPasswordMutation.isPending ? 0.5 : 1,
                      }}
                    >
                      {resetPasswordMutation.isPending
                        ? 'Resetting...'
                        : 'Reset Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Role Assignment Section */}
          {activeSection === 'roleAssignment' && (
            <div
              style={{
                marginTop: '2rem',
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
              }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  marginBottom: '1.5rem',
                }}
              >
                Role Assignment
              </h2>

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

              <form onSubmit={handleRoleSubmit} style={{ maxWidth: '600px' }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
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
                      {allUsers?.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email}) - Current: {user.role}
                          {user.isHrAdmin ? ' (HR Admin)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedUserId && allUsers && (
                    <>
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
                          <strong>Role:</strong>{' '}
                          {allUsers.find(u => u.id === selectedUserId)?.role}
                          <br />
                          <strong>HR Admin:</strong>{' '}
                          {allUsers.find(u => u.id === selectedUserId)
                            ?.isHrAdmin
                            ? 'Yes'
                            : 'No'}
                          <br />
                          <strong>Department:</strong>{' '}
                          {allUsers.find(u => u.id === selectedUserId)
                            ?.department?.name || 'N/A'}
                        </p>
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
                            checked={isHrAdmin}
                            onChange={e => setIsHrAdmin(e.target.checked)}
                          />
                          <span style={{ fontSize: '0.875rem' }}>
                            Grant HR Admin privileges
                          </span>
                        </label>
                      </div>
                    </>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      type='submit'
                      disabled={!selectedUserId || updateRoleMutation.isPending}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#3182ce',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        opacity:
                          !selectedUserId || updateRoleMutation.isPending
                            ? 0.5
                            : 1,
                      }}
                    >
                      {updateRoleMutation.isPending
                        ? 'Updating...'
                        : 'Update Role'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Department Management Section */}
          {activeSection === 'departmentManagement' && (
            <div
              style={{
                marginTop: '2rem',
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
              }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  marginBottom: '1.5rem',
                }}
              >
                Department Management
              </h2>

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

              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid #e2e8f0',
                  marginBottom: '1.5rem',
                }}
              >
                <button
                  onClick={() => setDeptTab('list')}
                  style={{
                    padding: '1rem 1.5rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    borderBottom:
                      deptTab === 'list'
                        ? '2px solid #3182ce'
                        : '2px solid transparent',
                    color: deptTab === 'list' ? '#3182ce' : '#718096',
                    fontWeight: deptTab === 'list' ? '600' : '400',
                  }}
                >
                  Department List
                </button>
                <button
                  onClick={() => {
                    setDeptTab('create');
                    if (!editingDeptId) {
                      resetDeptForm();
                    }
                  }}
                  style={{
                    padding: '1rem 1.5rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    borderBottom:
                      deptTab === 'create'
                        ? '2px solid #3182ce'
                        : '2px solid transparent',
                    color: deptTab === 'create' ? '#3182ce' : '#718096',
                    fontWeight: deptTab === 'create' ? '600' : '400',
                  }}
                >
                  {editingDeptId ? 'Edit Department' : 'Create Department'}
                </button>
              </div>

              {deptTab === 'list' && (
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
                          onClick={() => handleEditDept(dept)}
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
                          onClick={() => handleDeleteDept(dept.id, dept.name)}
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
              )}

              {deptTab === 'create' && (
                <form onSubmit={handleDeptSubmit} style={{ maxWidth: '600px' }}>
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
                        value={deptFormData.name}
                        onChange={e =>
                          setDeptFormData({
                            ...deptFormData,
                            name: e.target.value,
                          })
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
                        value={deptFormData.parentId}
                        onChange={e =>
                          setDeptFormData({
                            ...deptFormData,
                            parentId: e.target.value,
                          })
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
                        value={deptFormData.managerId}
                        onChange={e =>
                          setDeptFormData({
                            ...deptFormData,
                            managerId: e.target.value,
                          })
                        }
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid #cbd5e0',
                          borderRadius: '4px',
                        }}
                      >
                        <option value=''>-- No Manager Assigned --</option>
                        {allUsers?.map(user => (
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
                            resetDeptForm();
                            setDeptTab('list');
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
