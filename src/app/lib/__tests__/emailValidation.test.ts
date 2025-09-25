import { validateEmail } from '../emailValidation';

describe('Email Validation', () => {
  describe('Valid emails', () => {
    test('accepts valid email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.org',
        'user+tag@company.com.sg',
      ];

      validEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.hasAtSymbol).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
  });

  describe('Invalid emails', () => {
    test('rejects emails without @ symbol', () => {
      const invalidEmails = [
        'plainaddress',
        'test.email.com',
        'user.domain.org',
      ];

      invalidEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.hasAtSymbol).toBe(false);
        expect(result.error).toBe('Email must contain @ symbol');
      });
    });
  });

  describe('Edge cases', () => {
    test('handles empty string', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.hasAtSymbol).toBe(false);
      expect(result.error).toBeUndefined();
    });
  });
});
