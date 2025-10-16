/**
 * TaskDatePill Component
 *
 * Displays a task's due date with visual highlighting for overdue tasks.
 *
 * Overdue logic:
 * - A task is overdue if: due date is in the past AND status is NOT 'COMPLETED'
 * - Completed tasks are NEVER shown as overdue, even if past their due date
 *
 * Visual styling:
 * - Overdue: Red background (#fee2e2) + Red text (#dc2626)
 * - Not overdue: Gray background (#f3f4f6) + Gray text (#6b7280)
 */

interface TaskDatePillProps {
  dueDate: string;
  status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
}

export function TaskDatePill({ dueDate, status }: TaskDatePillProps) {
  // Parse the due date
  const dueDateObj = new Date(dueDate);
  const now = new Date();

  // Check if date is valid
  const isValidDate = !isNaN(dueDateObj.getTime());

  // Calculate if task is overdue
  // Key requirement: Only show as overdue if status is NOT 'COMPLETED'
  const isOverdue = isValidDate && dueDateObj < now && status !== 'COMPLETED';

  // Determine styling based on overdue status
  const backgroundColor = isOverdue ? '#fee2e2' : '#f3f4f6';
  const textColor = isOverdue ? '#dc2626' : '#6b7280';

  // Format the date for display
  const displayText = isValidDate
    ? dueDateObj.toLocaleDateString()
    : 'Invalid Date';

  return (
    <span
      data-testid='task-date-pill'
      style={{
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: '600',
        backgroundColor,
        color: textColor,
        textTransform: 'uppercase',
        letterSpacing: '0.025em',
      }}
    >
      {displayText}
    </span>
  );
}
