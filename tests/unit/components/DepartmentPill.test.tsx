/**
 * Unit Tests for DepartmentPill Component
 *
 * Tests the visual rendering and behavior of department tag pills
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { DepartmentPill } from '@/app/components/TaskTable/DepartmentPill';

describe('DepartmentPill Component', () => {
  test('should render single department pill', () => {
    const departments = [{ id: 'dept-1', name: 'Engineering' }];

    render(<DepartmentPill departments={departments} />);

    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  test('should render multiple department pills', () => {
    const departments = [
      { id: 'dept-1', name: 'Engineering' },
      { id: 'dept-2', name: 'Marketing' },
      { id: 'dept-3', name: 'Sales' },
    ];

    render(<DepartmentPill departments={departments} />);

    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
  });

  test('should respect maxDisplay limit and show "+N" for remaining', () => {
    const departments = [
      { id: 'dept-1', name: 'Engineering' },
      { id: 'dept-2', name: 'Marketing' },
      { id: 'dept-3', name: 'Sales' },
      { id: 'dept-4', name: 'HR' },
      { id: 'dept-5', name: 'Finance' },
    ];

    render(<DepartmentPill departments={departments} maxDisplay={3} />);

    // Should show first 3
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();

    // Should show "+2" for remaining
    expect(screen.getByText('+2')).toBeInTheDocument();

    // Should NOT show HR and Finance directly
    expect(screen.queryByText('HR')).not.toBeInTheDocument();
    expect(screen.queryByText('Finance')).not.toBeInTheDocument();
  });

  test('should return null when departments array is empty', () => {
    const { container } = render(<DepartmentPill departments={[]} />);

    expect(container.firstChild).toBeNull();
  });

  test('should return null when departments is undefined', () => {
    const { container } = render(
      <DepartmentPill departments={undefined as any} />
    );

    expect(container.firstChild).toBeNull();
  });

  test('should add title attribute for tooltip when showTooltip is true', () => {
    const departments = [{ id: 'dept-1', name: 'Engineering' }];

    render(<DepartmentPill departments={departments} showTooltip={true} />);

    const pill = screen.getByText('Engineering');
    expect(pill).toHaveAttribute('title', 'Engineering');
  });

  test('should not add title attribute when showTooltip is false', () => {
    const departments = [{ id: 'dept-1', name: 'Engineering' }];

    render(<DepartmentPill departments={departments} showTooltip={false} />);

    const pill = screen.getByText('Engineering');
    expect(pill).not.toHaveAttribute('title');
  });

  test('should show tooltip with all remaining departments on +N pill', () => {
    const departments = [
      { id: 'dept-1', name: 'Engineering' },
      { id: 'dept-2', name: 'Marketing' },
      { id: 'dept-3', name: 'Sales' },
      { id: 'dept-4', name: 'HR' },
    ];

    render(<DepartmentPill departments={departments} maxDisplay={2} />);

    const remainingPill = screen.getByText('+2');
    expect(remainingPill).toHaveAttribute('title', 'Sales, HR');
  });

  describe('Parent Department Highlighting', () => {
    test('should highlight parent department with gold styling', () => {
      const departments = [
        { id: 'dept-1', name: 'Engineering' },
        { id: 'dept-2', name: 'Marketing' },
      ];

      render(
        <DepartmentPill departments={departments} parentDepartmentId='dept-1' />
      );

      const engineeringPill = screen.getByText(/Engineering/);
      const styles = engineeringPill.style;

      expect(styles.backgroundColor).toBe('rgb(254, 243, 199)'); // #fef3c7
      expect(styles.color).toBe('rgb(146, 64, 14)'); // #92400e
      expect(styles.border).toBe('1px solid #f59e0b'); // Allow hex format
    });

    test('should show crown emoji for parent department', () => {
      const departments = [
        { id: 'dept-1', name: 'Engineering' },
        { id: 'dept-2', name: 'Marketing' },
      ];

      render(
        <DepartmentPill departments={departments} parentDepartmentId='dept-1' />
      );

      expect(screen.getByText(/👑 Engineering/)).toBeInTheDocument();
    });

    test('should show parent department first even if not first in array', () => {
      const departments = [
        { id: 'dept-1', name: 'Engineering' },
        { id: 'dept-2', name: 'Marketing' },
        { id: 'dept-3', name: 'Sales' },
      ];

      const { container } = render(
        <DepartmentPill departments={departments} parentDepartmentId='dept-3' />
      );

      const pills = container.querySelectorAll('span');
      // First pill should be Sales (parent department)
      expect(pills[0].textContent).toContain('Sales');
      expect(pills[0].textContent).toContain('👑');
    });

    test('should add "(Parent Department)" to parent department tooltip', () => {
      const departments = [{ id: 'dept-1', name: 'Engineering' }];

      render(
        <DepartmentPill
          departments={departments}
          parentDepartmentId='dept-1'
          showTooltip={true}
        />
      );

      const pill = screen.getByText(/Engineering/);
      expect(pill).toHaveAttribute('title', 'Engineering (Owner)');
    });
  });

  describe('Compact Mode', () => {
    test('should use smaller padding and font size in compact mode', () => {
      const departments = [{ id: 'dept-1', name: 'Engineering' }];

      render(<DepartmentPill departments={departments} compact={true} />);

      const pill = screen.getByText('Engineering');
      expect(pill.style.padding).toBe('2px 6px');
      expect(pill.style.fontSize).toBe('0.65rem');
    });
  });
});
