import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ProjectsPage from '@/app/dashboard/projects/page';

// Mock Navbar to avoid pulling in app-level dependencies
jest.mock('@/app/components/Navbar', () => {
  return {
    __esModule: true,
    default: () => <div data-testid='navbar' />,
  };
});

describe('Projects Dashboard Page', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    sessionStorage.clear();
  });

  it('renders fallback project title when no selection present', () => {
    render(<ProjectsPage />);
    expect(
      screen.getByRole('heading', { name: 'Projects' })
    ).toBeInTheDocument();
  });

  it('selected project title is shown using sessionStorage activeProjectName if present', () => {
    sessionStorage.setItem('activeProjectName', 'Customer Portal Redesign');
    render(<ProjectsPage />);
    expect(
      screen.getByRole('heading', { name: 'Customer Portal Redesign' })
    ).toBeInTheDocument();
  });

  it('updates selected projecttitle when activeProjectChanged event is dispatched', async () => {
    render(<ProjectsPage />);
    expect(
      screen.getByRole('heading', { name: 'Projects' })
    ).toBeInTheDocument();

    window.dispatchEvent(
      new CustomEvent('activeProjectChanged', {
        detail: { id: 'p1', name: 'New Selected Project' },
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'New Selected Project' })
      ).toBeInTheDocument();
    });
  });
});
