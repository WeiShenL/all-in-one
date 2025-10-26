interface DepartmentPillProps {
  departments: Array<{ id: string; name: string; isActive?: boolean }>;
  parentDepartmentId?: string;
  maxDisplay?: number;
  showTooltip?: boolean;
  compact?: boolean; // For TaskTable row display
}

/**
 * DepartmentPill Component
 *
 * Displays department tags with parent department highlighted
 * - Parent department appears first with gold/owner styling
 * - Other departments appear with indigo styling
 * - Supports compact mode for table rows
 */
export const DepartmentPill = ({
  departments,
  parentDepartmentId,
  maxDisplay = 3,
  showTooltip = true,
  compact = false,
}: DepartmentPillProps) => {
  if (!departments || departments.length === 0) {
    return null;
  }

  // Sort departments: parent first, then others
  const sortedDepartments = [...departments].sort((a, b) => {
    if (a.id === parentDepartmentId) {
      return -1;
    }
    if (b.id === parentDepartmentId) {
      return 1;
    }
    return 0;
  });

  const visibleDepartments = sortedDepartments.slice(0, maxDisplay);
  const remainingCount = Math.max(0, sortedDepartments.length - maxDisplay);

  const getStyles = (isParent: boolean, isActive: boolean) => ({
    display: 'inline-block',
    padding: compact ? '2px 6px' : '4px 8px',
    borderRadius: '12px',
    fontSize: compact ? '0.65rem' : '0.75rem',
    fontWeight: '600',
    backgroundColor: isActive ? (isParent ? '#fef3c7' : '#dcfce7') : '#f3f4f6',
    color: isActive ? (isParent ? '#92400e' : '#166534') : '#9ca3af',
    textTransform: 'capitalize' as const,
    letterSpacing: '0.025em',
    border: isParent ? '1px solid #f59e0b' : 'none',
    textDecoration: !isActive ? 'line-through' : 'none',
    opacity: !isActive ? 0.7 : 1,
  });

  return (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      {visibleDepartments.map(dept => {
        const isParent = dept.id === parentDepartmentId;
        const isActive = dept.isActive !== false; // Default to true if not specified
        return (
          <span
            key={dept.id}
            style={getStyles(isParent, isActive)}
            title={
              showTooltip
                ? `${dept.name}${isParent ? ' (Parent Department)' : ''}${!isActive ? ' (No assignees)' : ''}`
                : undefined
            }
          >
            {isParent && '👑 '}
            {dept.name}
            {!isActive && ' (Unassigned)'}
          </span>
        );
      })}
      {remainingCount > 0 && (
        <span
          style={{
            display: 'inline-block',
            padding: compact ? '2px 6px' : '4px 8px',
            borderRadius: '12px',
            fontSize: compact ? '0.65rem' : '0.75rem',
            fontWeight: '600',
            backgroundColor: '#F3F4F6',
            color: '#6B7280',
            letterSpacing: '0.025em',
          }}
          title={
            showTooltip
              ? sortedDepartments
                  .slice(maxDisplay)
                  .map(d => d.name)
                  .join(', ')
              : undefined
          }
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
};
