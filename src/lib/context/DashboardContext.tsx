'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type DashboardView =
  | 'personal'
  | 'department'
  | 'company'
  | 'hr'
  | 'projects';

interface DashboardContextType {
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveViewState] = useState<DashboardView>('personal');

  const setActiveView = useCallback((view: DashboardView) => {
    setActiveViewState(view);
  }, []);

  return (
    <DashboardContext.Provider value={{ activeView, setActiveView }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  return context; // Return null if not inside provider (don't throw)
}
