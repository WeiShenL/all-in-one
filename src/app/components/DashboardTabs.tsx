'use client';

import { useState, cloneElement } from 'react';

type TabType = 'table' | 'calendar';

interface DashboardTabsProps {
  tableView: React.ReactNode;
  calendarView: React.ReactNode;
  defaultTab?: TabType;
}

/**
 * DashboardTabs Component
 *
 * Reusable tab switcher for toggling between Table and Calendar views
 *
 * Features:
 * - Two tabs: "Table View" and "Calendar View"
 * - Active tab state management
 * - Visual feedback for active/inactive tabs
 * - Responsive design
 *
 * Usage:
 * <DashboardTabs
 *   tableView={<TaskTable tasks={tasks} />}
 *   calendarView={<TaskCalendar tasks={tasks} />}
 *   defaultTab="table"
 * />
 */
export function DashboardTabs({
  tableView,
  calendarView,
  defaultTab = 'table',
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  // Clone elements with stable keys to prevent remounting
  const stableTableView = cloneElement(tableView as React.ReactElement, {
    key: 'stable-table-view',
  });
  const stableCalendarView = cloneElement(calendarView as React.ReactElement, {
    key: 'stable-calendar-view',
  });

  return (
    <div style={styles.container}>
      {/* Tab buttons */}
      <div style={styles.tabBar}>
        <button
          onClick={() => setActiveTab('table')}
          style={{
            ...styles.tab,
            ...(activeTab === 'table' ? styles.tabActive : styles.tabInactive),
          }}
        >
          <span style={styles.tabIcon}>📋</span>
          Table View
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          style={{
            ...styles.tab,
            ...(activeTab === 'calendar'
              ? styles.tabActive
              : styles.tabInactive),
          }}
        >
          <span style={styles.tabIcon}>📅</span>
          Calendar View
        </button>
      </div>

      {/* Tab content - both views always mounted to preserve state across re-renders */}
      <div style={styles.content}>
        <div style={{ display: activeTab === 'table' ? 'block' : 'none' }}>
          {stableTableView}
        </div>
        <div style={{ display: activeTab === 'calendar' ? 'block' : 'none' }}>
          {stableCalendarView}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
  },
  tabBar: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '2px solid #e2e8f0',
    marginBottom: '1.5rem',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: 'none',
    borderBottom: '3px solid transparent',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative' as const,
    bottom: '-2px',
  },
  tabActive: {
    color: '#4299e1',
    borderBottom: '3px solid #4299e1',
    fontWeight: 600,
  },
  tabInactive: {
    color: '#718096',
  },
  tabIcon: {
    fontSize: '1.125rem',
  },
  content: {
    width: '100%',
  },
};
