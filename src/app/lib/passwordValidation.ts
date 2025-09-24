export type PasswordStrength = 'strong' | 'very-strong' | 'excellent';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  strength?: PasswordStrength;
  strengthLevel: number; // 0 = invalid, 1 = strong, 2 = very strong, 3 = excellent
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(
    password
  );

  if (!minLength) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumber) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  // Calculate strength level if password is valid
  let strengthLevel = 0;
  let strength: PasswordStrength | undefined;

  if (errors.length === 0) {
    // All requirements met = Strong (Level 1)
    strengthLevel = 1;
    strength = 'strong';

    // 10+ characters = Very Strong (Level 2)
    if (password.length >= 10) {
      strengthLevel = 2;
      strength = 'very-strong';
    }

    // 12+ characters = Excellent (Level 3)
    if (password.length >= 12) {
      strengthLevel = 3;
      strength = 'excellent';
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
    strength,
    strengthLevel,
  };
}
