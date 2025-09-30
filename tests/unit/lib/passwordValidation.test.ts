import { validatePassword } from '@/app/lib/passwordValidation';

describe('Password Validation', () => {
  describe('Individual Requirement Testing', () => {
    test('validates minimum length requirement', () => {
      expect(validatePassword('abc').minLength).toBe(false);
      expect(validatePassword('abcdefg').minLength).toBe(false); // 7 chars
      expect(validatePassword('abcdefgh').minLength).toBe(true); // 8 chars
      expect(validatePassword('abcdefghi').minLength).toBe(true); // 9+ chars
    });

    test('validates uppercase letter requirement', () => {
      expect(validatePassword('lowercase').hasUppercase).toBe(false);
      expect(validatePassword('hasUpperCase').hasUppercase).toBe(true);
      expect(validatePassword('123456789').hasUppercase).toBe(false);
    });

    test('validates lowercase letter requirement', () => {
      expect(validatePassword('UPPERCASE').hasLowercase).toBe(false);
      expect(validatePassword('hasLowerCase').hasLowercase).toBe(true);
      expect(validatePassword('123456789').hasLowercase).toBe(false);
    });

    test('validates number requirement', () => {
      expect(validatePassword('NoNumbers').hasNumber).toBe(false);
      expect(validatePassword('Has1Number').hasNumber).toBe(true);
      expect(validatePassword('123456789').hasNumber).toBe(true);
    });

    test('validates special character requirement', () => {
      expect(validatePassword('NoSpecial').hasSpecialChar).toBe(false);
      expect(validatePassword('HasSpecial!').hasSpecialChar).toBe(true);
      expect(validatePassword('Multiple@#$Special').hasSpecialChar).toBe(true);
      expect(validatePassword('With_Underscore').hasSpecialChar).toBe(true);
      expect(validatePassword('With-Hyphen').hasSpecialChar).toBe(true);
    });
  });

  describe('Overall Password Validation', () => {
    test('returns invalid when requirements are not met', () => {
      const weakPassword = validatePassword('weak');
      expect(weakPassword.isValid).toBe(false);
      expect(weakPassword.errors).toHaveLength(4); // 4 requirements failed (has lowercase)
      expect(weakPassword.strengthLevel).toBe(0);
    });

    test('returns valid when all requirements are met', () => {
      const strongPassword = validatePassword('Password1!');
      expect(strongPassword.isValid).toBe(true);
      expect(strongPassword.errors).toHaveLength(0);
      expect(strongPassword.strengthLevel).toBeGreaterThan(0);
    });

    test('generates appropriate error messages', () => {
      const result = validatePassword('ABC'); // uppercase only, no lowercase, no number, no special
      expect(result.errors).toContain(
        'Password must be at least 8 characters long'
      );
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter'
      );
      expect(result.errors).toContain(
        'Password must contain at least one number'
      );
      expect(result.errors).toContain(
        'Password must contain at least one special character'
      );
      expect(result.errors).toHaveLength(4);
    });
  });

  describe('Password Strength Calculation', () => {
    test('calculates strong password (level 1) for 8-9 characters with all requirements', () => {
      const result = validatePassword('Pass1!ab'); // 8 characters exactly
      expect(result.isValid).toBe(true);
      expect(result.strengthLevel).toBe(1);
      expect(result.strength).toBe('strong');
    });

    test('calculates very strong password (level 2) for 10-11 characters', () => {
      const result = validatePassword('Password1!'); // 10 characters
      expect(result.isValid).toBe(true);
      expect(result.strengthLevel).toBe(2);
      expect(result.strength).toBe('very-strong');
    });

    test('calculates excellent password (level 3) for 12+ characters', () => {
      const result = validatePassword('Password123!'); // 12 characters
      expect(result.isValid).toBe(true);
      expect(result.strengthLevel).toBe(3);
      expect(result.strength).toBe('excellent');
    });

    test('does not assign strength to invalid passwords', () => {
      const result = validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.strengthLevel).toBe(0);
      expect(result.strength).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty password', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.minLength).toBe(false);
      expect(result.hasUppercase).toBe(false);
      expect(result.hasLowercase).toBe(false);
      expect(result.hasNumber).toBe(false);
      expect(result.hasSpecialChar).toBe(false);
      expect(result.strengthLevel).toBe(0);
      expect(result.errors).toHaveLength(5);
    });

    test('validates special characters comprehensively', () => {
      const specialChars = '!@#$%^&*()_+-=[]{};\':"|,.<>?/~`';

      for (const char of specialChars) {
        const password = `Password1${char}`;
        const result = validatePassword(password);
        expect(result.hasSpecialChar).toBe(true);
        expect(result.isValid).toBe(true);
      }
    });
  });
});
