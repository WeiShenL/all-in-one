'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/supabase/auth-context';
import { useDashboard } from '@/lib/context/DashboardContext';

// Lazy load dashboard components for better performance
const PersonalDashboard = dynamic(
  () => import('./PersonalDashboard').then(mod => ({ default: mod.PersonalDashboard })),
  { loading: () => <div style={{ padding: '2rem', textAlign: 'center' }}>Loading dashboard...</div> }
);

const DepartmentDashboard = dynamic(
  () => import('./DepartmentDashboard').then(mod => ({ default: mod.DepartmentDashboard })),
  { loading: () => <div style={{ padding: '2rem', textAlign: 'center' }}>Loading dashboard...</div> }
);

const CompanyDashboard = dynamic(
  () => import('./CompanyDashboard').then(mod => ({ default: mod.CompanyDashboard })),
  { loading: () => <div style={{ padding: '2rem', textAlign: 'center' }}>Loading dashboard...</div> }
);

export function UnifiedDashboard() {
  const { user, userProfile } = useAuth();
  const dashboardContext = useDashboard();

  // Access control for company view
  const canAccessCompany =
    userProfile?.isHrAdmin || userProfile?.role === 'HR_ADMIN';

  // If user tries to access company without permission, redirect to personal
  useEffect(() => {
    if (
      dashboardContext &&
      dashboardContext.activeView === 'company' &&
      !canAccessCompany
    ) {
      dashboardContext.setActiveView('personal');
    }
  }, [dashboardContext, canAccessCompany]);

  // Handle case where context might be null (shouldn't happen in normal use)
  if (!dashboardContext) {
    return <div>Loading dashboard...</div>;
  }

  const { activeView } = dashboardContext;

  const getTitle = () => {
    switch (activeView) {
      case 'personal':
        return 'Personal Dashboard';
      case 'department':
        return 'Department Dashboard';
      case 'company':
        return 'Company Dashboard';
      default:
        return 'Dashboard';
    }
  };

  const getDescription = () => {
    switch (activeView) {
      case 'personal':
        return `Welcome, ${user?.email}`;
      case 'department':
        return `Welcome, ${user?.email}`;
      case 'company':
        return 'Company-wide overview';
      default:
        return '';
    }
  };

  return (
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
          <h1
            style={{
              marginBottom: '0.5rem',
              color: '#1a202c',
              fontSize: 'clamp(1.5rem, 4vw, 2rem)',
              fontWeight: '700',
            }}
          >
            {getTitle()}
          </h1>
          <p
            style={{
              color: '#718096',
              margin: 0,
              fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
            }}
          >
            {getDescription()}
          </p>
        </header>

        {/* Render active dashboard */}
        <div>
          {activeView === 'personal' && <PersonalDashboard />}
          {activeView === 'department' && <DepartmentDashboard />}
          {activeView === 'company' && canAccessCompany && <CompanyDashboard />}
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
