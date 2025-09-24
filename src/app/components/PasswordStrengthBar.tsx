import { PasswordStrength } from '../lib/passwordValidation';

interface PasswordStrengthBarProps {
  strengthLevel: number; // 0-3
  strength?: PasswordStrength;
}

export function PasswordStrengthBar({
  strengthLevel,
  strength,
}: PasswordStrengthBarProps) {
  if (strengthLevel === 0) {
    return null; // Don't show until password is valid
  }

  const getStrengthColor = (level: number): string => {
    switch (level) {
      case 1:
        return '#28a745'; // Green - Strong
      case 2:
        return '#007bff'; // Blue - Very Strong
      case 3:
        return '#6f42c1'; // Purple - Excellent
      default:
        return '#e9ecef'; // Gray - Empty
    }
  };

  const getStrengthText = (strength?: PasswordStrength): string => {
    switch (strength) {
      case 'strong':
        return 'Strong password';
      case 'very-strong':
        return 'Very strong password';
      case 'excellent':
        return 'Excellent password';
      default:
        return '';
    }
  };

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {/* Progress Bar */}
      <div
        style={{
          display: 'flex',
          gap: '2px',
          marginBottom: '0.25rem',
        }}
      >
        {[1, 2, 3].map(level => (
          <div
            key={level}
            style={{
              flex: 1,
              height: '6px',
              borderRadius: '3px',
              backgroundColor:
                level <= strengthLevel ? getStrengthColor(level) : '#e9ecef',
              transition: 'background-color 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Strength Text */}
      <div
        style={{
          fontSize: '0.875rem',
          color: getStrengthColor(strengthLevel),
          fontWeight: '500',
        }}
      >
        ✓ {getStrengthText(strength)}
      </div>
    </div>
  );
}
