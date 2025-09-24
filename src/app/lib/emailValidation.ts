export interface EmailValidationResult {
  isValid: boolean;
  hasAtSymbol: boolean;
  error?: string;
}

export function validateEmail(email: string): EmailValidationResult {
  const hasAtSymbol = email.includes('@');

  // Basic email validation - just checking for @ symbol for now
  const isValid = hasAtSymbol && email.length > 0;

  let error: string | undefined;
  if (email.length > 0 && !hasAtSymbol) {
    error = 'Email must contain @ symbol';
  }

  return {
    isValid,
    hasAtSymbol,
    error,
  };
}
