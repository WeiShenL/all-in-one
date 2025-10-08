# Development Guide

This document covers development practices, guidelines, and advanced topics for the G4T1 Task Management System.

## 📋 Table of Contents

- [Database Management](#-database-management)
- [Testing](#-testing)
- [Code Quality & Standards](#-code-quality--standards)
- [Authentication System](#-authentication-system)
- [Real-time Notification System](#-real-time-notification-system)
- [Project Structure](#-project-structure)

## 💾 Database Management

### Making Database Schema Changes

If you want to make changes to the database:

1. **Edit** `prisma/schema.prisma`
2. **Create migration**:
   ```bash
   npx prisma migrate dev --name your_change_description
   ```
3. **Commit** the generated migration files to Git

### Deploying to Different Environments

To deploy migrations to staging or production:

1. **Switch environment in `.env`**:

   ```bash
   # Comment out local development section:
   # DATABASE_URL="postgresql://postgres:postgres@localhost:5433/postgres"
   # NEXT_PUBLIC_API_EXTERNAL_URL=http://localhost:8000

   # Uncomment staging section:
   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true"
   NEXT_PUBLIC_API_EXTERNAL_URL=https://[PROJECT-REF].supabase.co
   ```

2. **Run migration**:

   ```bash
   npm run db:migrate
   ```

3. **Switch back to local development** when done

### Database Seeding

#### Seed Data Structure

Sample data is organized in `prisma/data/` directory:

- `1_departments.json` - Department structure
- `2_users.json` - Sample users (Staff, Manager, HR/Admin)
- `3_projects.json` - Sample projects
- `4_tasks.json` - Sample tasks with different priorities and statuses
- `5_task_assignments.json` - Task-user assignments
- `6_tags.json` - Task tags
- `7_task_tags.json` - Task-tag relationships
- `8_comments.json` - Sample comments on tasks
- `9_task_logs.json` - Task activity logs

#### Running the Seed

To populate your database with sample data:

```bash
npx prisma db seed
```

## 🧪 Testing

This project uses a comprehensive testing strategy with three test types:

1. **Unit Tests** - Fast, isolated tests using Jest
2. **Integration Tests** - Database and API tests using Jest
3. **End-to-End (E2E) Tests** - Full user flow tests using Playwright

### Test Structure

Tests are organized in a dedicated `tests/` directory with clear separation:

```
tests/
├── unit/                    # Unit tests (fast, isolated)
│   ├── components/         # React component tests
│   │   └── auth/
│   ├── lib/               # Utility function tests
│   ├── hooks/             # React hooks tests
│   └── services/          # Service class tests
├── integration/           # Integration tests (database, API)
│   ├── auth/              # Auth flow integration tests
│   ├── database/          # Database operation tests
│   └── realtime/          # Real-time notification tests
└── e2e/                   # End-to-end tests (Playwright)
    └── auth-flow.spec.ts  # Full authentication flow
```

### Running Tests

```bash
# Run ALL tests sequentially (Jest unit + integration + Playwright E2E)
npm test

# Run ONLY Jest tests (unit + integration, excludes E2E)
npm run test:jest

# Run only unit tests (fast feedback during development)
npm run test:unit

# Run only integration tests (requires database)
npm run test:integration

# Run only E2E tests (requires database and running app)
npm run test:e2e
npm run test:e2e:headed     # With browser UI visible
npm run test:e2e:ui         # Interactive UI mode
npm run test:e2e:debug      # Debug mode with inspector

# Run tests in watch mode (automatically re-run on file changes)
npm run test:watch

# Run specific test type in watch mode
npm run test:watch:unit
npm run test:watch:integration

# Run tests with coverage report
npm run test:coverage

# CI mode (no watch, coverage enabled)
npm run test:ci
```

### Test Execution Order

When running `npm test`, tests execute in this order:

1. **Unit Tests** → Fast isolated tests (Jest)
2. **Integration Tests** → Database/API tests (Jest)
3. **E2E Tests** → Full user flows (Playwright)

If any step fails, subsequent steps are skipped (fail-fast behavior).

### Test Type Comparison

| Test Type       | Speed     | Isolation     | Requires DB | Requires Browser | Use Case                   |
| --------------- | --------- | ------------- | ----------- | ---------------- | -------------------------- |
| **Unit**        | ⚡ Fast   | ✅ Isolated   | ❌ No       | ❌ No            | Component logic, utilities |
| **Integration** | 🐢 Medium | ⚠️ Partial    | ✅ Yes      | ❌ No            | Database ops, API calls    |
| **E2E**         | 🐌 Slow   | ❌ Full stack | ✅ Yes      | ✅ Yes           | User workflows, UI         |

### Coverage Reports

Coverage reports are generated in the `coverage/` directory when running `npm run test:coverage`:

- **Text summary**: Displayed in terminal
- **HTML report**: Open `coverage/index.html` in your browser for detailed visual coverage
- **LCOV format**: `coverage/lcov.info` for integration with external tools

### Writing Tests

This project follows React Testing Library best practices for writing maintainable, user-focused tests.

#### Creating Unit Tests

**For React Components:**
Create tests in `tests/unit/components/[feature]/ComponentName.test.tsx`

```typescript
// tests/unit/components/auth/EmailInput.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailInput } from '@/app/auth/components/EmailInput';

describe('EmailInput Component', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  test('renders with default props', () => {
    render(<EmailInput value="" onChange={mockOnChange} />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  test('validates email format', () => {
    render(<EmailInput value="" onChange={mockOnChange} />);
    const input = screen.getByLabelText('Email');

    fireEvent.change(input, { target: { value: 'invalid-email' } });
    expect(screen.getByText('✗ Email must contain @ symbol')).toBeInTheDocument();
  });
});
```

**For Utility Functions:**
Create tests in `tests/unit/lib/functionName.test.ts`

```typescript
// tests/unit/lib/emailValidation.test.ts
import { validateEmail } from '@/app/lib/emailValidation';

describe('validateEmail', () => {
  test('returns valid for correct email format', () => {
    const result = validateEmail('user@example.com');
    expect(result.isValid).toBe(true);
    expect(result.hasAtSymbol).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('returns invalid for missing @ symbol', () => {
    const result = validateEmail('userexample.com');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Email must contain @ symbol');
  });
});
```

#### Creating Integration Tests

**For Database Operations:**
Create tests in `tests/integration/database/featureName.test.ts`

```typescript
// tests/integration/database/user-operations.test.ts
import { Client } from 'pg';

describe('User Database Operations', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  afterEach(async () => {
    // Clean up test data
    await client.query('DELETE FROM public."UserProfile" WHERE email LIKE $1', [
      'test-%',
    ]);
  });

  test('should create user profile', async () => {
    await client.query(
      'INSERT INTO public."UserProfile" (id, email, name, role, "departmentId") VALUES ($1, $2, $3, $4, $5)',
      ['test-id', 'test@example.com', 'Test User', 'STAFF', 'dept-id']
    );

    const result = await client.query(
      'SELECT * FROM public."UserProfile" WHERE email = $1',
      ['test@example.com']
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Test User');
  });
});
```

#### Creating Service Tests (OOP Implementation)

**For Service Classes:**
Create tests in `tests/unit/services/ServiceName.test.ts`

```typescript
// tests/unit/services/TaskService.test.ts
import { TaskService } from '@/services/TaskService';
import { ITaskRepository } from '@/repositories/interfaces/ITaskRepository';

describe('TaskService', () => {
  let taskService: TaskService;
  let mockTaskRepository: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    mockTaskRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      findByUserId: jest.fn(),
      // ... other methods
    };

    taskService = new TaskService(mockTaskRepository);
  });

  test('should create task with valid data', async () => {
    const taskData = {
      title: 'Test Task',
      description: 'Test Description',
      priority: 'HIGH',
      dueDate: new Date(),
      ownerId: 'user-id',
    };

    await taskService.createTask(taskData);

    expect(mockTaskRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Task',
      })
    );
  });

  test('should throw error for invalid task data', async () => {
    const invalidData = { title: '', description: 'Test' };

    await expect(taskService.createTask(invalidData)).rejects.toThrow(
      'Task title is required'
    );
  });
});
```

### Test Guidelines

#### Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the component/function does, not how it does it
2. **Use Descriptive Test Names**: Test names should clearly describe the scenario being tested
3. **Follow AAA Pattern**: Arrange, Act, Assert
4. **Mock External Dependencies**: Use mocks for APIs, databases, and external services
5. **Clean Up After Tests**: Always clean up test data in integration tests

#### File Naming Conventions

- **Unit Tests**: `[ComponentName].test.tsx` or `[functionName].test.ts`
- **Integration Tests**: `[feature-name].test.ts`
- **Test Data**: Use factories or fixtures for complex test data

#### Import Paths

Use the configured path mappings:

- `@/` for source files: `import { Component } from '@/app/components/Component'`
- `@tests/` for test utilities: `import { mockUser } from '@tests/fixtures/users'`

#### Database Tests

- **Requires Docker**: Integration tests need the local database running
- **Clean State**: Always clean up test data in `afterEach` or `afterAll`
- **Environment Variables**: Tests use `DATABASE_URL` from `.env`
- **Isolation**: Each test should be independent and not rely on other tests

### Continuous Integration

The CI/CD pipeline ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs tests automatically on every pull request:

**Pipeline Stages:**

1. **Code Quality** (`code-quality` job):
   - TypeScript type checking (`npx tsc --noEmit`)
   - Code formatting check (`npm run format:check`)
   - Linting (`npm run lint`)

2. **Unit Tests** (`base-tests` job):
   - Runs `npm run test:unit` with coverage
   - Outputs coverage to `coverage/unit/`
   - Uploads coverage artifact for later merging

3. **Security Scan** (`security` job):
   - Dependency vulnerability scan (`npm audit`)
   - Secrets leak detection (gitleaks)
   - Static Application Security Testing (CodeQL)

4. **Staging Deploy & Integration Testing** (`staging-deploy` job):
   - Build verification
   - Database migrations (`npx prisma migrate deploy`)
   - Integration tests: `npm run test:integration` with coverage
   - Vercel preview deployment
   - E2E tests: `npm run test:e2e` against deployed preview
   - Coverage merging (unit + integration)
   - Coverage upload to Coveralls

**Test Execution in CI:**

- **Unit tests** run first (fast feedback)
- **Integration tests** run after successful deployment
- **E2E tests** run against the deployed Vercel preview URL
- All tests must pass for the pipeline to succeed

**Coverage Reporting:**

- Unit and integration coverage are collected separately
- Coverage files are merged: `coverage/unit/lcov.info` + `coverage/integration/lcov.info`
- Merged coverage uploaded to [Coveralls](https://coveralls.io) for tracking
- E2E tests do not generate coverage (focused on user flow validation)

**Manual CI Commands:**

```bash
# Run tests as CI does (no watch mode)
npm run test:ci
```

## 🧹 Code Quality & Development Standards

This project enforces consistent code style and quality through automated tooling:

### Automated Code Formatting & Linting

- **ESLint**: Configured for TypeScript and Next.js best practices
- **Prettier**: Handles code formatting for JS/TS, JSON, Markdown, and CSS files
- **Pre-commit Hooks**: Automatically runs linting and formatting on staged files before commits

### Setup for New Developers

The linting and formatting tools are automatically installed when you run `npm install`. Pre-commit hooks will:

- Auto-fix code style issues where possible
- Block commits that contain unfixable lint errors
- Ensure consistent code formatting across the team

### Manual Commands

```bash
# Linting
npm run lint        # Check for linting issues across all files
npm run lint:fix    # Fix auto-fixable linting issues

# Formatting
npm run format      # Format all files with Prettier
npm run format:check # Check formatting without fixing

# Type Checking
npm run type-check  # Check TypeScript types without building

# Build & Test
npm run build       # Build the application (includes linting & type checking)
```

### Troubleshooting Linting Issues

If you encounter linting errors during development or deployment:

1. **Run the linter manually** to see all issues:

   ```bash
   npm run lint
   ```

2. **Auto-fix common issues**:

   ```bash
   npm run lint:fix
   ```

3. **Format all files**:

   ```bash
   npm run format
   ```

4. **Check if build passes** (this runs all checks):
   ```bash
   npm run build
   ```

**Note**: The build process (used in deployment) will fail if there are any linting errors or type issues. Always run these commands before committing to ensure your code will deploy successfully.

## 🔐 Authentication System

### Overview

The application uses **Supabase Authentication** with role-based access control supporting three user roles:

- **STAFF** - Basic users with limited permissions
- **MANAGER** - Department managers with team oversight capabilities
- **HR_ADMIN** - System administrators with full access

### Authentication Features

- **Session Management**: Automatic session refresh via middleware
- **Role-Based Access**: Different permissions based on user role
- **Type Safety**: Full TypeScript support for user data and permissions
- **SSR Support**: Works with both client and server components
- **Real-time Updates**: Authentication state updates across the app

### Using Authentication in Components

```typescript
'use client'
import { useAuth } from '@/lib/supabase/auth-context'

export function MyComponent() {
  const { user, userProfile, userRole, signIn, signOut, loading } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!user) return <LoginForm />

  return (
    <div>
      <p>Welcome, {userProfile?.name}</p>
      <p>Role: {userRole}</p>
      <button onClick={signOut}>Logout</button>
    </div>
  )
}
```

### Production Deployment

For production, update environment variables to point to your cloud Supabase instance:

```bash
NEXT_PUBLIC_API_EXTERNAL_URL=https://your-project.supabase.co
NEXT_PUBLIC_ANON_KEY=your-production-anon-key
```

The authentication code automatically adapts to the environment.

## 🔔 Real-time Notification System

### Overview

The application includes a **real-time notification system** built with Supabase Realtime and custom Toast components. It supports displaying notifications in real-time across all connected clients with a clean, animated UI.

### Notification Features

- **Real-time Broadcasting**: Notifications appear instantly across all connected clients
- **Auto-dismiss**: Notifications automatically disappear after 5 seconds (configurable)
- **Manual Dismiss**: Users can close notifications manually
- **Animated Transitions**: Smooth slide-in and slide-out animations
- **Type Safety**: Full TypeScript support with defined notification types
- **Connection Status**: Real-time connection monitoring (shown in development mode)
- **Multiple Types**: Support for `info`, `success`, `warning`, and `error` notifications

### Notification Types

```typescript
type NotificationType = 'info' | 'success' | 'warning' | 'error';
```

Each type has distinct visual styling:

- **Info**: Blue theme for informational messages
- **Success**: Green theme for successful operations
- **Warning**: Yellow theme for warnings
- **Error**: Red theme for errors

### Setup

The notification system is already set up globally in [src/app/layout.tsx](src/app/layout.tsx). The `NotificationProvider` wraps your application and `ToastContainer` displays the notifications.

```typescript
import { NotificationProvider } from '@/lib/context/NotificationContext'
import { ToastContainer } from '@/app/components/ToastContainer'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider autoRemoveDelay={5000} maxNotifications={5}>
      {children}
      <ToastContainer />
    </NotificationProvider>
  )
}
```

### Using Notifications in Components

#### Displaying Notifications

```typescript
'use client'
import { useNotifications } from '@/lib/context/NotificationContext'

export function MyComponent() {
  const { addNotification, isConnected } = useNotifications()

  const handleSuccess = () => {
    addNotification('success', 'Task Completed', 'Your task was successfully saved!')
  }

  const handleError = () => {
    addNotification('error', 'Error', 'Failed to save task. Please try again.')
  }

  const handleWarning = () => {
    addNotification('warning', 'Warning', 'This action cannot be undone.')
  }

  const handleInfo = () => {
    addNotification('info', 'New Update', 'A new version is available.')
  }

  return (
    <div>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleError}>Show Error</button>
      <button onClick={handleWarning}>Show Warning</button>
      <button onClick={handleInfo}>Show Info</button>

      {/* Connection status */}
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
    </div>
  )
}
```

#### Broadcasting Real-time Notifications

To send notifications that appear on all connected clients:

```typescript
'use client'
import { useRealtimeNotifications } from '@/lib/hooks/useRealtimeNotifications'

export function BroadcastComponent() {
  const { sendBroadcast, isConnected } = useRealtimeNotifications()

  const notifyAllUsers = async () => {
    try {
      await sendBroadcast({
        type: 'info',
        title: 'System Announcement',
        message: 'Maintenance scheduled for tonight at 10 PM',
      })
    } catch (error) {
      console.error('Failed to broadcast notification:', error)
    }
  }

  return (
    <button onClick={notifyAllUsers} disabled={!isConnected}>
      Notify All Users
    </button>
  )
}
```

### API Reference

#### `useNotifications()` Hook

Returns notification context with the following methods and properties:

```typescript
interface NotificationContextType {
  // Array of current notifications
  notifications: Notification[];

  // Add a new notification
  addNotification: (
    type: NotificationType,
    title: string,
    message: string
  ) => void;

  // Remove a notification immediately
  removeNotification: (id: string) => void;

  // Dismiss with animation
  dismissNotification: (id: string) => void;

  // Clear all notifications
  clearAll: () => void;

  // Connection status
  isConnected: boolean;

  // Connection error (if any)
  error: Error | null;
}
```

#### `useRealtimeNotifications()` Hook

Lower-level hook for custom real-time notification handling:

```typescript
interface UseRealtimeNotificationsOptions {
  channel?: string; // Default: 'notifications'
  onNotification?: (notification: RealtimeNotification) => void;
  autoReconnect?: boolean; // Default: true
}

interface UseRealtimeNotificationsReturn {
  isConnected: boolean;
  error: Error | null;
  sendBroadcast: (
    notification: Omit<RealtimeNotification, 'broadcast_at'>
  ) => Promise<void>;
}
```

#### `NotificationProvider` Props

```typescript
interface NotificationProviderProps {
  children: ReactNode;
  autoRemoveDelay?: number; // Default: 5000ms (5 seconds)
  maxNotifications?: number; // Default: 5
}
```

### Configuration Options

Customize the notification behavior by adjusting the provider props:

```typescript
<NotificationProvider
  autoRemoveDelay={10000}     // Keep notifications for 10 seconds
  maxNotifications={3}        // Show max 3 notifications at once
>
  {children}
</NotificationProvider>
```

### File Structure

```
src/
├── app/components/
│   ├── Toast.tsx              # Individual toast notification component
│   └── ToastContainer.tsx     # Container for rendering all toasts
├── lib/
│   ├── context/
│   │   └── NotificationContext.tsx  # Notification state management
│   └── hooks/
│       └── useRealtimeNotifications.ts  # Supabase Realtime hook
└── types/
    └── notification.ts        # TypeScript type definitions
```

### Best Practices

1. **Use Appropriate Types**: Choose the correct notification type to convey the message intent
2. **Keep Messages Concise**: Titles should be 2-4 words, messages 1-2 sentences
3. **Avoid Spam**: Don't trigger multiple notifications for the same event
4. **Handle Errors**: Wrap `sendBroadcast` in try-catch blocks
5. **Check Connection**: Verify `isConnected` before broadcasting

### Notification Examples

**Task Assignment:**

```typescript
addNotification('success', 'Task Assigned', `Task assigned to ${userName}`);
```

**Error Handling:**

```typescript
addNotification('error', 'Upload Failed', 'File size exceeds 10MB limit');
```

**System Announcements:**

```typescript
await sendBroadcast({
  type: 'warning',
  title: 'Scheduled Maintenance',
  message: 'System will be down for 30 minutes starting at 2 AM',
});
```

**Real-time Updates:**

```typescript
await sendBroadcast({
  type: 'info',
  title: 'New Comment',
  message: `${userName} commented on your task`,
});
```

## 📁 Project Structure

```
all-in-one/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Seed script
│   ├── data/              # Seed data JSON files
│   └── migrations/        # Migration history
├── src/app/
│   ├── server/           # Backend API Layer
│   │   ├── services/     # OOP Service Classes (business logic)
│   │   ├── routers/      # tRPC routers (thin wrappers)
│   │   ├── types/        # Shared TypeScript types
│   │   └── trpc.ts       # tRPC configuration
│   └── ...               # Next.js app directory
├── tests/                # Test suite organization
│   ├── unit/             # Unit tests (components, utilities, services)
│   ├── integration/      # Integration tests (database, API)
│   └── e2e/             # End-to-end tests (future)
├── supabase/             # Supabase Docker configuration
├── OOP.md                # OOP Architecture documentation
└── .env.example          # Environment template
```

### Backend Architecture (OOP)

This project uses an **Object-Oriented Programming architecture** for the backend API layer:

- **Service Layer** (`src/app/server/services/`): TypeScript classes encapsulating business logic
- **Router Layer** (`src/app/server/routers/`): Thin tRPC wrappers delegating to services
- **OOP Principles**: Encapsulation, Inheritance, Single Responsibility, Dependency Injection

For complete architecture details, implementation guide, and examples, see [OOP.md](./OOP.md).

You can start editing by modifying `src/app/page.tsx`. The page auto-updates as you edit.
