import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectSelection } from '@/app/components/ProjectSelection';
import { useAuth } from '@/lib/supabase/auth-context';
import { trpc } from '@/app/lib/trpc';
import { useRouter, usePathname } from 'next/navigation';

// Mock dependencies
jest.mock('@/lib/supabase/auth-context', () => ({
  useAuth: jest.fn(),
}));

// Mock tRPC specifically for this component
jest.mock('@/app/lib/trpc', () => ({
  trpc: {
    project: {
      getVisible: {
        useQuery: jest.fn(),
      },
    },
    useUtils: jest.fn(() => ({
      project: {
        getVisible: {
          invalidate: jest.fn(),
        },
      },
    })),
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
  usePathname: jest.fn(() => '/dashboard/personal'),
}));

jest.mock('@/app/components/ProjectCreateModal', () => ({
  ProjectCreateModal: ({ isOpen, onClose, onCreated }: any) =>
    isOpen ? (
      <div data-testid='project-create-modal'>
        <button onClick={onClose}>Close Modal</button>
        <button
          onClick={() => onCreated({ id: 'new-project', name: 'New Project' })}
        >
          Create Project
        </button>
      </div>
    ) : null,
}));

describe('ProjectSelection', () => {
  const mockUseAuth = useAuth as jest.Mock;
  const mockUseQuery = trpc.project.getVisible.useQuery as jest.Mock;
  const mockPush = jest.fn();
  const mockUsePathname = jest.fn(() => '/dashboard/personal');

  const mockUserProfile = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'MANAGER',
  };

  const mockProjects = [
    {
      id: 'project-1',
      name: 'Customer Portal',
      description: 'Customer portal redesign',
      priority: 5,
      status: 'ACTIVE',
      departmentId: 'dept-1',
      creatorId: 'user-123',
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'project-2',
      name: 'Mobile App',
      description: 'Mobile application development',
      priority: 8,
      status: 'ACTIVE',
      departmentId: 'dept-1',
      creatorId: 'user-123',
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const sixProjects = Array.from({ length: 6 }).map((_, i) => ({
    id: `p-${i + 1}`,
    name: `Project ${i + 1}`,
    description: '',
    priority: 1,
    status: 'ACTIVE',
    departmentId: 'dept-1',
    creatorId: 'user-123',
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      userProfile: mockUserProfile,
    });
    mockUseQuery.mockReturnValue({
      data: mockProjects,
      isLoading: false,
      error: null,
    });

    // Reset mock functions
    mockPush.mockClear();
    mockUsePathname.mockReturnValue('/dashboard/personal');

    // Set up the navigation mocks
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (usePathname as jest.Mock).mockImplementation(mockUsePathname);
  });

  describe('Rendering', () => {
    it('should render PROJECTS header', () => {
      render(<ProjectSelection />);
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });

    it('should render add button for MANAGER role', () => {
      render(<ProjectSelection />);
      expect(screen.getByTitle('Add Project')).toBeInTheDocument();
    });

    it('should render add button for HR_ADMIN role', () => {
      mockUseAuth.mockReturnValue({
        userProfile: { ...mockUserProfile, role: 'HR_ADMIN' },
      });
      render(<ProjectSelection />);
      expect(screen.getByTitle('Add Project')).toBeInTheDocument();
    });

    it('should not render add button for STAFF role', () => {
      mockUseAuth.mockReturnValue({
        userProfile: { ...mockUserProfile, role: 'STAFF' },
      });
      render(<ProjectSelection />);
      expect(screen.queryByTitle('Add Project')).not.toBeInTheDocument();
    });

    it('should not render add button when no user profile', () => {
      mockUseAuth.mockReturnValue({
        userProfile: null,
      });
      render(<ProjectSelection />);
      expect(screen.queryByTitle('Add Project')).not.toBeInTheDocument();
    });
  });

  describe('Project List Display', () => {
    it('should display projects when data is available', () => {
      render(<ProjectSelection />);
      expect(screen.getByText('Customer Portal')).toBeInTheDocument();
      expect(screen.getByText('Mobile App')).toBeInTheDocument();
    });

    it('should display project icons with first letter', () => {
      render(<ProjectSelection />);
      expect(screen.getByText('C')).toBeInTheDocument(); // Customer Portal
      expect(screen.getByText('M')).toBeInTheDocument(); // Mobile App
    });

    it('should show loading state', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });
      render(<ProjectSelection />);
      expect(screen.getByText('Loading projects...')).toBeInTheDocument();
    });

    it('should show error state', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch'),
      });
      render(<ProjectSelection />);
      expect(screen.getByText('Failed to load projects')).toBeInTheDocument();
    });

    it('should show appropriate message when no projects', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });
      render(<ProjectSelection />);
      expect(screen.getByText('Create your first project')).toBeInTheDocument();
    });

    it('shows only four visible items and enables scroll when more than 4 projects', () => {
      mockUseQuery.mockReturnValue({
        data: sixProjects,
        isLoading: false,
        error: null,
      });

      render(<ProjectSelection />);
      // Grab container by going to a known child and stepping to parent container
      const firstItem = screen.getByText('Project 1');
      const listContainer = firstItem.closest('div')!
        .parentElement as HTMLDivElement;

      expect(listContainer).toHaveStyle({
        maxHeight: '200px',
        overflowY: 'auto',
      });

      // Items exist in DOM; visibility is governed by CSS scroll
      [
        'Project 1',
        'Project 2',
        'Project 3',
        'Project 4',
        'Project 5',
        'Project 6',
      ].forEach(name => {
        expect(screen.getByText(name)).toBeInTheDocument();
      });
    });
  });

  describe('Role-based Messages', () => {
    it('should show correct message for MANAGER role', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });
      mockUseAuth.mockReturnValue({
        userProfile: { ...mockUserProfile, role: 'MANAGER' },
      });
      render(<ProjectSelection />);
      expect(screen.getByText('Create your first project')).toBeInTheDocument();
    });

    it('should show correct message for HR_ADMIN role', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });
      mockUseAuth.mockReturnValue({
        userProfile: { ...mockUserProfile, role: 'HR_ADMIN' },
      });
      render(<ProjectSelection />);
      expect(screen.getByText('Create your first project')).toBeInTheDocument();
    });

    it('should show correct message for STAFF role', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });
      mockUseAuth.mockReturnValue({
        userProfile: { ...mockUserProfile, role: 'STAFF' },
      });
      render(<ProjectSelection />);
      expect(
        screen.getByText('Wait for a manager to add you to your first project')
      ).toBeInTheDocument();
    });

    it('should show default message when no user profile', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });
      mockUseAuth.mockReturnValue({
        userProfile: null,
      });
      render(<ProjectSelection />);
      expect(screen.getByText('No projects yet')).toBeInTheDocument();
    });
  });

  describe('Project Creation Modal', () => {
    it('should open modal when add button is clicked', () => {
      render(<ProjectSelection />);
      const addButton = screen.getByTitle('Add Project');
      fireEvent.click(addButton);
      expect(screen.getByTestId('project-create-modal')).toBeInTheDocument();
    });

    it('should close modal when close button is clicked', async () => {
      render(<ProjectSelection />);
      const addButton = screen.getByTitle('Add Project');
      fireEvent.click(addButton);

      expect(screen.getByTestId('project-create-modal')).toBeInTheDocument();

      const closeButton = screen.getByText('Close Modal');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByTestId('project-create-modal')
        ).not.toBeInTheDocument();
      });
    });

    it('should close modal when project is created', async () => {
      render(<ProjectSelection />);
      const addButton = screen.getByTitle('Add Project');
      fireEvent.click(addButton);

      expect(screen.getByTestId('project-create-modal')).toBeInTheDocument();

      const createButton = screen.getByText('Create Project');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(
          screen.queryByTestId('project-create-modal')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Project Navigation', () => {
    it('should navigate to projects page when project is clicked', () => {
      render(<ProjectSelection />);
      const projectItem = screen.getByText('Customer Portal');
      fireEvent.click(projectItem);

      expect(mockPush).toHaveBeenCalledWith('/dashboard/projects');
    });
  });

  describe('Active State', () => {
    it('applies active styling only to the clicked item when on /dashboard/projects', () => {
      mockUsePathname.mockReturnValue('/dashboard/projects');

      render(<ProjectSelection />);

      // Click second item to select it
      fireEvent.click(screen.getByText('Mobile App'));

      const firstItem = screen.getByText('Customer Portal').closest('div');
      const secondItem = screen.getByText('Mobile App').closest('div');

      expect(firstItem).toHaveStyle({
        color: '#495057',
        backgroundColor: 'transparent',
        borderLeft: '3px solid transparent',
      });
      expect(secondItem).toHaveStyle({
        color: '#1976d2',
        backgroundColor: '#e3f2fd',
        borderLeft: '3px solid #1976d2',
      });
    });

    it('does not apply active styling when not on /projects route', () => {
      mockUsePathname.mockReturnValue('/dashboard/personal');

      render(<ProjectSelection />);
      fireEvent.click(screen.getByText('Customer Portal'));

      const clicked = screen.getByText('Customer Portal').closest('div');
      expect(clicked).toHaveStyle({
        color: '#495057',
        backgroundColor: 'transparent',
        borderLeft: '3px solid transparent',
      });
    });

    it('restores active item from sessionStorage on /dashboard/projects', () => {
      // Persist selection
      sessionStorage.setItem('activeProjectId', 'project-2');
      mockUsePathname.mockReturnValue('/dashboard/projects');

      render(<ProjectSelection />);
      const restored = screen.getByText('Mobile App').closest('div');
      expect(restored).toHaveStyle({
        color: '#1976d2',
        backgroundColor: '#e3f2fd',
        borderLeft: '3px solid #1976d2',
      });
      sessionStorage.removeItem('activeProjectId');
    });
  });

  describe('Hover Effects', () => {
    it('should apply hover effects when not active', () => {
      mockUsePathname.mockReturnValue('/dashboard/personal');

      render(<ProjectSelection />);
      const projectItem = screen.getByText('Customer Portal').closest('div');

      fireEvent.mouseEnter(projectItem!);
      expect(projectItem).toHaveStyle({
        backgroundColor: '#e3f2fd',
        color: '#1976d2',
        transform: 'translateX(4px)',
      });

      fireEvent.mouseLeave(projectItem!);
      expect(projectItem).toHaveStyle({
        backgroundColor: 'transparent',
        color: '#495057',
        transform: 'translateX(0)',
      });
    });

    it('should not apply hover effects when item is active', () => {
      mockUsePathname.mockReturnValue('/dashboard/projects');

      render(<ProjectSelection />);
      // Activate first item
      fireEvent.click(screen.getByText('Customer Portal'));
      const activeItem = screen.getByText('Customer Portal').closest('div');

      fireEvent.mouseEnter(activeItem!);
      expect(activeItem).toHaveStyle({
        backgroundColor: '#e3f2fd',
        color: '#1976d2',
      });
    });
  });

  describe('Project Icon Generation', () => {
    it('should generate correct icon for project name', () => {
      render(<ProjectSelection />);
      // Customer Portal should show 'C'
      expect(screen.getByText('C')).toBeInTheDocument();
      // Mobile App should show 'M'
      expect(screen.getByText('M')).toBeInTheDocument();
    });

    it('should apply different colors for different projects', () => {
      render(<ProjectSelection />);
      const customerIcon = screen.getByText('C').closest('div');
      const mobileIcon = screen.getByText('M').closest('div');

      expect(customerIcon).toHaveStyle({ backgroundColor: expect.any(String) });
      expect(mobileIcon).toHaveStyle({ backgroundColor: expect.any(String) });
      // Colors should be different
      expect(customerIcon?.style.backgroundColor).not.toBe(
        mobileIcon?.style.backgroundColor
      );
    });
  });

  describe('SessionStorage Integration', () => {
    beforeEach(() => {
      // Clear sessionStorage before each test
      sessionStorage.clear();
    });

    it('should persist active project selection to sessionStorage', () => {
      render(<ProjectSelection />);
      const projectItem = screen.getByText('Customer Portal');
      fireEvent.click(projectItem);

      expect(sessionStorage.getItem('activeProjectId')).toBe('project-1');
      expect(sessionStorage.getItem('activeProjectName')).toBe(
        'Customer Portal'
      );
    });

    it('should restore active project from sessionStorage on mount', () => {
      sessionStorage.setItem('activeProjectId', 'project-2');
      sessionStorage.setItem('activeProjectName', 'Mobile App');
      mockUsePathname.mockReturnValue('/dashboard/projects');

      render(<ProjectSelection />);

      const restoredItem = screen.getByText('Mobile App').closest('div');
      expect(restoredItem).toHaveStyle({
        color: '#1976d2',
        backgroundColor: '#e3f2fd',
        borderLeft: '3px solid #1976d2',
      });
    });

    it('should dispatch custom event when project is selected', () => {
      const mockDispatchEvent = jest.spyOn(window, 'dispatchEvent');
      render(<ProjectSelection />);

      const projectItem = screen.getByText('Customer Portal');
      fireEvent.click(projectItem);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'activeProjectChanged',
          detail: { id: 'project-1', name: 'Customer Portal' },
        })
      );
    });

    it('should handle sessionStorage errors gracefully', () => {
      // Mock sessionStorage to throw error
      const originalSetItem = sessionStorage.setItem;
      sessionStorage.setItem = jest.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      render(<ProjectSelection />);
      const projectItem = screen.getByText('Customer Portal');

      // Should not crash when sessionStorage fails
      expect(() => fireEvent.click(projectItem)).not.toThrow();

      // Restore original method
      sessionStorage.setItem = originalSetItem;
    });
  });

  describe('Project Visibility Query', () => {
    it('should call getVisible query with correct parameters', () => {
      render(<ProjectSelection />);

      expect(mockUseQuery).toHaveBeenCalledWith({
        isArchived: false,
      });
    });

    it('should invalidate getVisible query when project is created', async () => {
      const mockInvalidate = jest.fn();
      const mockUtils = {
        project: {
          getVisible: {
            invalidate: mockInvalidate,
          },
        },
      };
      (trpc.useUtils as jest.Mock).mockReturnValue(mockUtils);

      render(<ProjectSelection />);
      const addButton = screen.getByTitle('Add Project');
      fireEvent.click(addButton);

      const createButton = screen.getByText('Create Project');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockInvalidate).toHaveBeenCalledWith({ isArchived: false });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty project name', () => {
      mockUseQuery.mockReturnValue({
        data: [{ ...mockProjects[0], name: '' }],
        isLoading: false,
        error: null,
      });
      render(<ProjectSelection />);
      // Should not crash and should handle gracefully
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });

    it('should handle undefined projects data', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });
      render(<ProjectSelection />);
      expect(screen.getByText('Create your first project')).toBeInTheDocument();
    });

    it('should handle long project names with ellipsis', () => {
      const longNameProject = {
        ...mockProjects[0],
        name: 'This is a very long project name that should be truncated with ellipsis',
      };
      mockUseQuery.mockReturnValue({
        data: [longNameProject],
        isLoading: false,
        error: null,
      });
      render(<ProjectSelection />);
      const projectName = screen.getByText(longNameProject.name);
      expect(projectName).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
    });

    it('should handle null project data gracefully', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });
      render(<ProjectSelection />);
      expect(screen.getByText('Create your first project')).toBeInTheDocument();
    });
  });
});
