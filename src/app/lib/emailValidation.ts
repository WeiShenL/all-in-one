export interface EmailValidationResult {
  isValid: boolean;
  hasAtSymbol: boolean;
  error?: string;
}

export function validateEmail(email: string): EmailValidationResult {
  // Handle null/undefined inputs
  const safeEmail = email || '';

  const hasAtSymbol = safeEmail.includes('@');

  // Basic email validation - just checking for @ symbol for now
  const isValid = hasAtSymbol && safeEmail.length > 0;

  let error: string | undefined;
  if (safeEmail.length > 0 && !hasAtSymbol) {
    error = 'Email must contain @ symbol';
  }

  return {
    isValid,
    hasAtSymbol,
    error,
  };
}
