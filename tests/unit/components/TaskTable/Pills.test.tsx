/**
 * Unit Tests for Pills Component (StatusPill and PriorityPill)
 *
 * Tests the business logic for status and priority pill rendering,
 * including color mappings, text display, and edge cases.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusPill, PriorityPill } from '@/app/components/TaskTable/Pills';

describe('StatusPill Component', () => {
  describe('Status Color and Text Mapping', () => {
    test('should render TO_DO status with correct color and text', () => {
      const { container } = render(<StatusPill status='TO_DO' />);
      const pill = container.querySelector('span');

      expect(pill).toBeInTheDocument();
      expect(pill).toHaveStyle({
        backgroundColor: '#E8C0FA',
        color: '#ffffff',
      });
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });

    test('should render IN_PROGRESS status with correct color and text', () => {
      const { container } = render(<StatusPill status='IN_PROGRESS' />);
      const pill = container.querySelector('span');

      expect(pill).toBeInTheDocument();
      expect(pill).toHaveStyle({
        backgroundColor: '#dbeafe',
        color: '#1e40af',
      });
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    test('should render COMPLETED status with correct color and text', () => {
      const { container } = render(<StatusPill status='COMPLETED' />);
      const pill = container.querySelector('span');

      expect(pill).toBeInTheDocument();
      expect(pill).toHaveStyle({
        backgroundColor: '#dcfce7',
        color: '#166534',
      });
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    test('should render BLOCKED status with correct color and text', () => {
      const { container } = render(<StatusPill status='BLOCKED' />);
      const pill = container.querySelector('span');

      expect(pill).toBeInTheDocument();
      expect(pill).toHaveStyle({
        backgroundColor: '#fee2e2',
        color: '#dc2626',
      });
      expect(screen.getByText('Blocked')).toBeInTheDocument();
    });
  });

  describe('Default Case for Unknown Status', () => {
    test('should render unknown status with default gray color', () => {
      const { container } = render(
        <StatusPill status={'UNKNOWN_STATUS' as any} />
      );
      const pill = container.querySelector('span');

      expect(pill).toBeInTheDocument();
      expect(pill).toHaveStyle({
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
      });
      expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument();
    });
  });

  describe('Pill Styling', () => {
    test('should have correct base styles', () => {
      const { container } = render(<StatusPill status='TO_DO' />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.025em',
      });
    });
  });
});

describe('PriorityPill Component', () => {
  describe('Low Priority (1-3) - Green', () => {
    test('should render priority 1 with green color', () => {
      const { container } = render(<PriorityPill priority={1} />);
      const pill = container.querySelector('span');

      expect(pill).toBeInTheDocument();
      expect(pill).toHaveStyle({
        backgroundColor: '#dcfce7',
        color: '#166534',
      });
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    test('should render priority 2 with green color', () => {
      const { container } = render(<PriorityPill priority={2} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        backgroundColor: '#dcfce7',
        color: '#166534',
      });
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    test('should render priority 3 with green color (boundary)', () => {
      const { container } = render(<PriorityPill priority={3} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        backgroundColor: '#dcfce7',
        color: '#166534',
      });
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Medium Priority (4-7) - Yellow', () => {
    test('should render priority 4 with yellow color (boundary)', () => {
      const { container } = render(<PriorityPill priority={4} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        backgroundColor: '#fef3c7',
        color: '#d97706',
      });
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    test('should render priority 5 with yellow color', () => {
      const { container } = render(<PriorityPill priority={5} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        backgroundColor: '#fef3c7',
        color: '#d97706',
      });
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    test('should render priority 6 with yellow color', () => {
      const { container } = render(<PriorityPill priority={6} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        backgroundColor: '#fef3c7',
        color: '#d97706',
      });
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    test('should render priority 7 with yellow color (boundary)', () => {
      const { container } = render(<PriorityPill priority={7} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        backgroundColor: '#fef3c7',
        color: '#d97706',
      });
      expect(screen.getByText('7')).toBeInTheDocument();
    });
  });

  describe('High Priority (8-10) - Red', () => {
    test('should render priority 8 with red color (boundary)', () => {
      const { container } = render(<PriorityPill priority={8} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        backgroundColor: '#fee2e2',
        color: '#dc2626',
      });
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    test('should render priority 9 with red color', () => {
      const { container } = render(<PriorityPill priority={9} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        backgroundColor: '#fee2e2',
        color: '#dc2626',
      });
      expect(screen.getByText('9')).toBeInTheDocument();
    });

    test('should render priority 10 with red color (boundary)', () => {
      const { container } = render(<PriorityPill priority={10} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        backgroundColor: '#fee2e2',
        color: '#dc2626',
      });
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  describe('Edge Cases - Out of Range Priorities', () => {
    test('should render priority 0 with gray color (below range)', () => {
      const { container } = render(<PriorityPill priority={0} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
      });
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    test('should render priority 11 with gray color (above range)', () => {
      const { container } = render(<PriorityPill priority={11} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
      });
      expect(screen.getByText('11')).toBeInTheDocument();
    });

    test('should render negative priority with gray color', () => {
      const { container } = render(<PriorityPill priority={-5} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
      });
      expect(screen.getByText('-5')).toBeInTheDocument();
    });

    test('should render very large priority with gray color', () => {
      const { container } = render(<PriorityPill priority={999} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
      });
      expect(screen.getByText('999')).toBeInTheDocument();
    });
  });

  describe('Pill Styling', () => {
    test('should have correct base styles', () => {
      const { container } = render(<PriorityPill priority={5} />);
      const pill = container.querySelector('span');

      expect(pill).toHaveStyle({
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.025em',
      });
    });
  });

  describe('Priority Range Boundaries', () => {
    test('should correctly categorize boundary values', () => {
      // Test that boundaries are inclusive on both sides
      const { container: container3 } = render(<PriorityPill priority={3} />);
      const { container: container4 } = render(<PriorityPill priority={4} />);
      const { container: container7 } = render(<PriorityPill priority={7} />);
      const { container: container8 } = render(<PriorityPill priority={8} />);

      const pill3 = container3.querySelector('span');
      const pill4 = container4.querySelector('span');
      const pill7 = container7.querySelector('span');
      const pill8 = container8.querySelector('span');

      // Priority 3 should be green (low)
      expect(pill3).toHaveStyle({ backgroundColor: '#dcfce7' });

      // Priority 4 should be yellow (medium)
      expect(pill4).toHaveStyle({ backgroundColor: '#fef3c7' });

      // Priority 7 should be yellow (medium)
      expect(pill7).toHaveStyle({ backgroundColor: '#fef3c7' });

      // Priority 8 should be red (high)
      expect(pill8).toHaveStyle({ backgroundColor: '#fee2e2' });
    });
  });
});
