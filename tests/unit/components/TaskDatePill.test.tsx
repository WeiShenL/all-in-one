/**
 * Unit Tests for TaskDatePill Component
 *
 * Testing overdue task highlighting based on:
 * - Due date in the past
 * - Status NOT equal to 'COMPLETED'
 *
 * Acceptance Criteria:
 * - Overdue tasks (past due + not completed) should show red background + red text
 * - Completed tasks should NEVER show as overdue (even if past due)
 * - Future tasks should show gray background + gray text
 */

import { render } from '@testing-library/react';
import { TaskDatePill } from '@/app/components/TaskDatePill';

describe('TaskDatePill', () => {
  // Helper function to format dates consistently
  const formatDate = (date: Date) => date.toLocaleDateString();

  describe('Overdue tasks (should show RED)', () => {
    const pastDate = '2020-01-01T00:00:00Z'; // Way in the past

    it('should show red background and text for overdue TO_DO task', () => {
      const { container } = render(
        <TaskDatePill dueDate={pastDate} status='TO_DO' />
      );

      const pill = container.querySelector('span');
      expect(pill).toBeInTheDocument();

      // Check for red styling
      expect(pill).toHaveStyle({
        backgroundColor: '#fee2e2', // Red background
        color: '#dc2626', // Red text
      });

      // Should display the date
      expect(pill).toHaveTextContent(formatDate(new Date(pastDate)));
    });

    it('should show red background and text for overdue IN_PROGRESS task', () => {
      const { container } = render(
        <TaskDatePill dueDate={pastDate} status='IN_PROGRESS' />
      );

      const pill = container.querySelector('span');
      expect(pill).toHaveStyle({
        backgroundColor: '#fee2e2',
        color: '#dc2626',
      });
    });

    it('should show red background and text for overdue BLOCKED task', () => {
      const { container } = render(
        <TaskDatePill dueDate={pastDate} status='BLOCKED' />
      );

      const pill = container.querySelector('span');
      expect(pill).toHaveStyle({
        backgroundColor: '#fee2e2',
        color: '#dc2626',
      });
    });
  });

  describe('Completed tasks (should show GRAY, even if overdue)', () => {
    const pastDate = '2020-01-01T00:00:00Z'; // Way in the past

    it('should show gray background and text for overdue COMPLETED task', () => {
      const { container } = render(
        <TaskDatePill dueDate={pastDate} status='COMPLETED' />
      );

      const pill = container.querySelector('span');
      expect(pill).toBeInTheDocument();

      // TEST: Completed tasks should NOT show red, even if past due
      expect(pill).toHaveStyle({
        backgroundColor: '#f3f4f6', // Gray background
        color: '#6b7280', // Gray text
      });

      // Should still display the date
      expect(pill).toHaveTextContent(formatDate(new Date(pastDate)));
    });
  });

  describe('Future tasks (should show GRAY)', () => {
    const futureDate = '2099-12-31T00:00:00Z'; // Far in the future

    it('should show gray background and text for future TO_DO task', () => {
      const { container } = render(
        <TaskDatePill dueDate={futureDate} status='TO_DO' />
      );

      const pill = container.querySelector('span');
      expect(pill).toHaveStyle({
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
      });
    });

    it('should show gray background and text for future IN_PROGRESS task', () => {
      const { container } = render(
        <TaskDatePill dueDate={futureDate} status='IN_PROGRESS' />
      );

      const pill = container.querySelector('span');
      expect(pill).toHaveStyle({
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
      });
    });

    it('should show gray background and text for future COMPLETED task', () => {
      const { container } = render(
        <TaskDatePill dueDate={futureDate} status='COMPLETED' />
      );

      const pill = container.querySelector('span');
      expect(pill).toHaveStyle({
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
      });
    });

    it('should show gray background and text for future BLOCKED task', () => {
      const { container } = render(
        <TaskDatePill dueDate={futureDate} status='BLOCKED' />
      );

      const pill = container.querySelector('span');
      expect(pill).toHaveStyle({
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle today as due date correctly', () => {
      // Create a date that's definitely "today" but later in the day
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      const todayISO = today.toISOString();

      const { container } = render(
        <TaskDatePill dueDate={todayISO} status='TO_DO' />
      );

      const pill = container.querySelector('span');
      expect(pill).toBeInTheDocument();

      // Today should NOT be overdue (not < new Date())
      expect(pill).toHaveStyle({
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
      });
    });

    it('should handle invalid date gracefully', () => {
      const invalidDate = 'invalid-date-string';

      const { container } = render(
        <TaskDatePill dueDate={invalidDate} status='TO_DO' />
      );

      const pill = container.querySelector('span');
      expect(pill).toBeInTheDocument();

      // Should show "Invalid Date" or handle gracefully
      expect(pill).toHaveTextContent(/Invalid Date|Invalid/i);
    });

    it('should handle ISO 8601 date strings', () => {
      const isoDate = '2020-06-15T14:30:00.000Z';

      const { container } = render(
        <TaskDatePill dueDate={isoDate} status='TO_DO' />
      );

      const pill = container.querySelector('span');
      expect(pill).toBeInTheDocument();
      expect(pill).toHaveTextContent(formatDate(new Date(isoDate)));
    });

    it('should handle date-only strings (without time)', () => {
      const dateOnly = '2020-06-15';

      const { container } = render(
        <TaskDatePill dueDate={dateOnly} status='TO_DO' />
      );

      const pill = container.querySelector('span');
      expect(pill).toBeInTheDocument();
      expect(pill).toHaveTextContent(formatDate(new Date(dateOnly)));
    });
  });

  describe('Visual styling consistency', () => {
    const pastDate = '2020-01-01T00:00:00Z';

    it('should apply pill styling (padding, border-radius, etc.)', () => {
      const { container } = render(
        <TaskDatePill dueDate={pastDate} status='TO_DO' />
      );

      const pill = container.querySelector('span');

      // Check that basic pill styling is present
      expect(pill).toHaveStyle({
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: '600',
      });
    });
  });

  describe('Overdue logic validation', () => {
    it('should correctly identify overdue = past date + not completed', () => {
      const pastDate = '2020-01-01T00:00:00Z';

      // Test all non-completed statuses (should be red)
      const nonCompletedStatuses: Array<'TO_DO' | 'IN_PROGRESS' | 'BLOCKED'> = [
        'TO_DO',
        'IN_PROGRESS',
        'BLOCKED',
      ];

      nonCompletedStatuses.forEach(status => {
        const { container } = render(
          <TaskDatePill dueDate={pastDate} status={status} />
        );

        const pill = container.querySelector('span');
        expect(pill).toHaveStyle({
          backgroundColor: '#fee2e2', // Should be red
          color: '#dc2626',
        });
      });
    });

    it('should correctly identify NOT overdue = completed status (regardless of date)', () => {
      const pastDate = '2020-01-01T00:00:00Z';

      const { container } = render(
        <TaskDatePill dueDate={pastDate} status='COMPLETED' />
      );

      const pill = container.querySelector('span');
      expect(pill).toHaveStyle({
        backgroundColor: '#f3f4f6', // Should be gray
        color: '#6b7280',
      });
    });
  });
});
