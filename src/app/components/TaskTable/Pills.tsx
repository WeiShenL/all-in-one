import { Task } from './types';

interface PillProps {
  children: React.ReactNode;
  backgroundColor: string;
  textColor?: string;
}

const Pill = ({
  children,
  backgroundColor,
  textColor = 'white',
}: PillProps) => (
  <span
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
    {children}
  </span>
);

export const StatusPill = ({ status }: { status: Task['status'] }) => {
  const getStatusConfig = (status: Task['status']) => {
    switch (status) {
      case 'TO_DO':
        return { color: '#E8C0FA', textColor: '#ffffff', text: 'To Do' };
      case 'IN_PROGRESS':
        return { color: '#dbeafe', textColor: '#1e40af', text: 'In Progress' };
      case 'COMPLETED':
        return { color: '#dcfce7', textColor: '#166534', text: 'Completed' };
      case 'BLOCKED':
        return { color: '#fee2e2', textColor: '#dc2626', text: 'Blocked' };
      default:
        return { color: '#f3f4f6', textColor: '#6b7280', text: status };
    }
  };

  const config = getStatusConfig(status);
  return (
    <Pill backgroundColor={config.color} textColor={config.textColor}>
      {config.text}
    </Pill>
  );
};

export const PriorityPill = ({ priority }: { priority: number }) => {
  const getPriorityConfig = (priority: number) => {
    if (priority >= 1 && priority <= 3) {
      return { color: '#dcfce7', textColor: '#166534', text: `${priority}` };
    } else if (priority >= 4 && priority <= 7) {
      return { color: '#fef3c7', textColor: '#d97706', text: `${priority}` };
    } else if (priority >= 8 && priority <= 10) {
      return { color: '#fee2e2', textColor: '#dc2626', text: `${priority}` };
    } else {
      return { color: '#f3f4f6', textColor: '#6b7280', text: `${priority}` };
    }
  };

  const config = getPriorityConfig(priority);
  return (
    <Pill backgroundColor={config.color} textColor={config.textColor}>
      {config.text}
    </Pill>
  );
};
