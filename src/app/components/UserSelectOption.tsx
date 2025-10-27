/**
 * UserSelectOption Component
 *
 * Reusable component for rendering user options in select dropdowns.
 * Displays user name, email, department, role, and HR admin status.
 *
 * Used in:
 * - TaskCreateForm (multi-select for assignees)
 * - TaskCreateModal (single-select for adding assignees)
 * - TaskCard (single-select for adding assignees)
 */

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  isHrAdmin?: boolean;
  department?: {
    id: string;
    name: string;
  };
  departmentId?: string;
}

interface UserSelectOptionProps {
  user: User;
}

/**
 * Formats user information for display in select dropdown
 * Format: Name (email) - Department, Role, HR_Admin
 * Text is truncated if too long to prevent horizontal overflow
 */
export function UserSelectOption({ user }: UserSelectOptionProps) {
  const mainPart = `${user.name} (${user.email})`;
  const additionalInfo: string[] = [];

  // Add department if available
  if (user.department?.name) {
    additionalInfo.push(user.department.name);
  }

  // Add role if available (title case)
  if (user.role) {
    const roleDisplay = user.role
      .replace('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
    additionalInfo.push(roleDisplay);
  }

  // Add HR_Admin if applicable
  if (user.isHrAdmin) {
    additionalInfo.push('HR_Admin');
  }

  // Combine: main part, then dash, then comma-separated additional info
  let fullText: string;
  if (additionalInfo.length > 0) {
    fullText = `${mainPart} - ${additionalInfo.join(', ')}`;
  } else {
    fullText = mainPart;
  }

  // Truncate if text is too long (prevent horizontal overflow in dropdowns)
  const MAX_LENGTH = 80;
  if (fullText.length > MAX_LENGTH) {
    return fullText.substring(0, MAX_LENGTH - 3) + '...';
  }
  return fullText;
}

/**
 * Hook to format user display text
 * Can be used when you need the formatted string directly
 */
export function useUserDisplayText(user: User): string {
  return UserSelectOption({ user });
}
