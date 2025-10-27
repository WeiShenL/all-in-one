# Development Guide

This document covers development practices, guidelines, and advanced topics for the G4T1 Task Management System.

## 📋 Table of Contents

- [Database Management](#-database-management)
- [Testing](#-testing)
- [Code Quality & Standards](#-code-quality--standards)
- [Authentication System](#-authentication-system)
- [Real-time Notification System](#-real-time-notification-system)
- [Email System](#-email-system)
- [File Upload & Storage System](#-file-upload--storage-system)
- [Project Report Export](#-project-report-export)
- [Reusable Components](#-reusable-components)
  - [TaskCalendar Component](#taskcalendar-component)
- [Project Structure](#-project-structure)

## 🚀 Getting Started

This section covers how to get the project running on your local machine for development and testing.

### Prerequisites

- Node.js (v18 or later)
- Docker and Docker Compose
- `npm` or a compatible package manager

### One-Command Setup

The easiest way to start the development environment is to use the all-in-one `dev:setup` script. This command will set up everything you need, from the database to the frontend.

```bash
npm run dev:setup
```

This single command performs the following steps:

1.  Installs all project dependencies (`npm install`).
2.  Stops and removes any old Supabase Docker containers.
3.  Starts all necessary Supabase services (including database, auth, and storage) in the background.
4.  Applies any pending database migrations.
5.  Initializes the Supabase storage buckets and policies.
6.  Seeds the database with sample data.
7.  Starts the Next.js frontend development server with Turbopack.

**Note:** This is a long-running process that will occupy your terminal. Once you see the Next.js server has started, you can access the application at `http://localhost:3000`.

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

**For OOP Service Classes:**
Create tests in `tests/unit/services/ServiceName.test.ts`

```typescript
// tests/unit/services/DepartmentService.test.ts
import { DepartmentService } from '@/app/server/services/DepartmentService';
import { PrismaClient } from '@prisma/client';

describe('DepartmentService - OOP Pattern', () => {
  let departmentService: DepartmentService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      department: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    departmentService = new DepartmentService(mockPrisma);
  });

  test('should get all departments with hierarchy', async () => {
    mockPrisma.department.findMany.mockResolvedValue([
      { id: '1', name: 'Engineering', parentId: null },
      { id: '2', name: 'Backend', parentId: '1' },
    ]);

    const result = await departmentService.getAll();

    expect(result).toHaveLength(2);
    expect(result[0].level).toBe(0); // Top level
    expect(result[1].level).toBe(1); // Child level
  });
});
```

#### Creating Domain Tests (DDD Implementation)

**For Domain Entities (Pure Business Logic):**
Create tests in `tests/unit/domain/[entity]/[Entity].test.ts`

```typescript
// tests/unit/domain/task/Task.create.test.ts
import { Task, TaskStatus } from '@/domain/task/Task';
import {
  MinAssigneeRequiredError,
  MaxAssigneesReachedError,
} from '@/domain/task/errors/TaskErrors';

describe('Task Entity - DDD Pattern', () => {
  const validTaskData = {
    title: 'Test Task',
    description: 'Test Description',
    priorityBucket: 5,
    dueDate: new Date('2025-12-31'),
    status: TaskStatus.TO_DO,
    ownerId: 'user-1',
    departmentId: 'dept-1',
    projectId: null,
    parentTaskId: null,
    recurringInterval: null,
    isArchived: false,
    assignments: new Set(['user-1']),
    tags: new Set(),
  };

  describe('create', () => {
    test('should create task with valid data', () => {
      const task = Task.create(validTaskData);

      expect(task.getTitle()).toBe('Test Task');
      expect(task.getPriorityBucket()).toBe(5);
    });

    test('should enforce minimum 1 assignee rule', () => {
      expect(() =>
        Task.create({
          ...validTaskData,
          assignments: new Set(), // Empty set
        })
      ).toThrow(MinAssigneeRequiredError);
    });

    test('should enforce maximum 5 assignees rule', () => {
      expect(() =>
        Task.create({
          ...validTaskData,
          assignments: new Set(['u1', 'u2', 'u3', 'u4', 'u5', 'u6']),
        })
      ).toThrow(MaxAssigneesReachedError);
    });
  });

  describe('updateTitle', () => {
    test('should update title successfully', () => {
      const task = Task.create(validTaskData);

      task.updateTitle('Updated Title');

      expect(task.getTitle()).toBe('Updated Title');
    });

    test('should reject empty title', () => {
      const task = Task.create(validTaskData);

      expect(() => task.updateTitle('')).toThrow('Title cannot be empty');
    });
  });
});
```

**For Application Services (DDD Pattern):**
Create tests in `tests/unit/services/[Service].test.ts`

```typescript
// tests/unit/services/TaskService.test.ts
import { TaskService } from '@/services/task/TaskService';
import { ITaskRepository } from '@/repositories/ITaskRepository';

describe('TaskService - DDD Pattern', () => {
  let taskService: TaskService;
  let mockTaskRepository: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    mockTaskRepository = {
      createTask: jest.fn(),
      getTaskByIdFull: jest.fn(),
      updateTask: jest.fn(),
      validateProjectExists: jest.fn(),
      validateAssignees: jest.fn(),
      logTaskAction: jest.fn(),
    } as any;

    taskService = new TaskService(mockTaskRepository);
  });

  test('should create task via domain model', async () => {
    mockTaskRepository.validateAssignees.mockResolvedValue({
      allExist: true,
      allActive: true,
    });
    mockTaskRepository.createTask.mockResolvedValue({ id: 'task-1' });

    const result = await taskService.createTask(
      {
        title: 'New Task',
        description: 'Description',
        priority: 8,
        dueDate: new Date(),
        assigneeIds: ['user-1'],
      },
      { userId: 'user-1', role: 'STAFF', departmentId: 'dept-1' }
    );

    expect(result.id).toBe('task-1');
    expect(mockTaskRepository.createTask).toHaveBeenCalled();
  });

  test('should reject invalid project ID', async () => {
    mockTaskRepository.validateProjectExists.mockResolvedValue(false);

    await expect(
      taskService.createTask(
        {
          title: 'Task',
          description: 'Description',
          priority: 5,
          dueDate: new Date(),
          assigneeIds: ['user-1'],
          projectId: 'invalid-project',
        },
        { userId: 'user-1', role: 'STAFF', departmentId: 'dept-1' }
      )
    ).rejects.toThrow('Project not found');
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

#### Task API

##### Involved Departments Feature (SCRUM-72)

**Task responses now include `involvedDepartments` field:**

The `task.getById` endpoint returns an `involvedDepartments` array containing all unique departments represented by task assignees:

```typescript
{
  id: string;
  title: string;
  // ... other task fields
  involvedDepartments: Array<{
    id: string;
    name: string;
  }>;
}
```

**Behavior:**

- Parent department (from `task.departmentId`) appears first in the array
- Departments are derived from assignee user profiles
- Automatically updates when assignees are added/removed
- Departments are deduplicated (each appears once)
- Optimized with batched queries (single DB call for all departments)

**Example Response:**

```json
{
  "id": "task-123",
  "title": "Cross-departmental project",
  "departmentId": "eng-dept",
  "assignments": [
    { "userId": "user-1", "user": { "name": "John" } },
    { "userId": "user-2", "user": { "name": "Jane" } }
  ],
  "involvedDepartments": [
    { "id": "eng-dept", "name": "Engineering" }, // Parent department first
    { "id": "marketing-dept", "name": "Marketing" }, // From assignees
    { "id": "sales-dept", "name": "Sales" } // From assignees
  ]
}
```

**UI Components:**

- `DepartmentPill`: Displays department tags with parent highlighting (gold crown)
- `DepartmentCount`: Compact view showing parent + count with hover popup
- Used in: TaskCard, TaskCreateForm, TaskTable

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

## 📧 Email System for Task Updates ONLY

### Overview

The application uses **Resend** for sending email notifications (task updates, assignments, comments, etc.). Due to Resend's free tier limitations, the system includes a **test mode** that redirects all emails to a single verified address during development and testing.

### How Email Sending Works

#### Test Mode (Development/Testing)

When `TEST_EMAIL_RECIPIENT` is set in your `.env` file:

```bash
# .env
TEST_EMAIL_RECIPIENT=your-verified-email@gmail.com
```

**Behavior:**

- ✅ All emails are redirected to the `TEST_EMAIL_RECIPIENT` address
- ✅ Original recipient information is preserved in the email body for debugging
- ✅ Console warnings show email override in action
- ✅ Safe for development and testing without hitting rate limits

**Why This Exists:**

- Resend's free tier only allows sending to verified email addresses
- Prevents hitting rate limits during development/testing
- Allows testing email functionality without needing to verify every test user email

#### Production Mode

When `TEST_EMAIL_RECIPIENT` is **commented out or removed** from your `.env` file:

```bash
# .env
# TEST_EMAIL_RECIPIENT=your-verified-email@gmail.com   # Commented out
```

**Behavior:**

- ✅ Emails are sent to actual user email addresses
- ✅ Each recipient must have a verified email in your Resend account (free tier)
- ✅ OR upgrade to Resend paid plan for unrestricted sending
- ❌ Will fail if sending to unverified addresses on free tier

### Email Notification Types

The system sends emails for the following events:

- **Task Assignments**: When a user is assigned to a task
- **New Comments**: When someone comments on an assigned task
- **Comment Edits**: When a comment is edited on an assigned task
- **Task Updates**: When task details change (status, priority, deadline, etc.)
- **Assignment Changes**: When assignees are added/removed from a task

### Testing Email Functionality

#### Local Testing

1. Set `TEST_EMAIL_RECIPIENT` in `.env`
2. Trigger an email notification (e.g., create a task comment)
3. Check your verified email inbox
4. Email subject will indicate the notification type
5. Email body will show original recipient info for debugging

#### Integration Tests

Email sending is mocked in integration tests to avoid hitting API limits:

```typescript
// jest.setup.js - Resend is automatically mocked
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({
        data: { id: 'mock-email-id' },
        error: null,
      }),
    },
  })),
}));
```

### Environment Variables Reference

```bash
# Required: Resend API key
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx

# Required: Sender email address
RESEND_EMAIL_FROM=onboarding@resend.dev

# Optional: Test mode recipient (comment out for production)
TEST_EMAIL_RECIPIENT=your-verified-email@gmail.com
```

### Code Reference

Email sending logic is implemented in:

- [EmailService.ts](src/app/server/services/EmailService.ts) - Email sending with test mode override
- [NotificationService.ts](src/app/server/services/NotificationService.ts) - Integrates email with notifications
- [TaskService.ts](src/services/task/TaskService.ts) - Triggers notifications on task updates

## 📁 File Upload & Storage System

### Overview

The application supports file attachments for tasks using **Supabase Storage**. Files are stored in a private bucket with Row Level Security (RLS) policies to ensure users can only access files from tasks they are assigned to.

### Storage Configuration

This section covers the one-time setup required for file upload functionality.

### 2.1 Create Storage Bucket

1. Open Supabase Dashboard: **http://localhost:8000**
2. Navigate to **Storage** (left sidebar)
3. Click **Create a new bucket**
4. Configure bucket:
   - **Name**: `task-attachments`
   - **Public bucket**: ❌ **Unchecked** (keep it private)
5. Click **Additional Configuration** (expand section)
6. Configure file restrictions:
   - **File size limit**: Click "Reset file upload size for bucket"
   - Enter: `10` (10MB)
   - **Allowed MIME types**: Paste the following:
   ```
   image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip
   ```
7. Click **Create bucket**

### 2.2 Configure Policies

Go to **Storage** → Click `task-attachments` bucket → **Policies** tab → task-attachments > Click **New Policy** > For full customisation

#### Policy 1: Allow Upload (INSERT)

- **Policy Name**: `Users can upload to assigned tasks`
- **Allowed operation**: `INSERT`
- **Target Roles**: Authenticated
- **Policy Definition**:

```sql
bucket_id = 'task-attachments'
AND
(storage.foldername(name))[1] IN (
  SELECT t.id
  FROM task t
  INNER JOIN task_assignment ta ON ta."taskId" = t.id
  WHERE ta."userId" = auth.uid()::text
)
```

Click **Review** → **Save policy**

#### Policy 2: Allow Download (SELECT)

- **Policy Name**: `Users can view files from assigned tasks`
- **Allowed operation**: `SELECT`
- **Target Roles**: `Authenticated`
- **Policy Definition**:

```sql
(bucket_id = 'task-attachments')
AND
(storage.foldername(name))[1] IN (
  SELECT t.id
  FROM task t
  INNER JOIN task_assignment ta ON ta."taskId" = t.id
  WHERE ta."userId" = auth.uid()::text
)
```

Click **Review** → **Save policy**

#### Policy 3: Allow Delete (DELETE)

- **Policy Name**: `Users can delete their own uploaded files`
- **Allowed operation**: `DELETE`
- **Target Roles**: `Authenticated`
- **Policy Definition**:

```sql
(bucket_id = 'task-attachments') AND (owner = uid())
```

Click **Review** → **Save policy**

## 📊 Project Report Export

HR/Admin users can export project reports in PDF or Excel format.

**Access**: `/dashboard/hr` (HR_ADMIN role or `isHrAdmin` flag required)

**Usage**:

1. Select a project from dropdown
2. Click "Export Report"
3. Choose PDF or Excel format
4. File downloads automatically

**Implementation**:

- **Architecture**: Follows DDD pattern with repository layer
- **Backend**: `ProjectReportService` with authorization and data fetching via `IProjectRepository`
- **Frontend**: `ProjectReportExportButton` component with `exportProjectToPDF()` and `exportProjectToXLSX()` utilities
- **Authorization**: Service validates HR/Admin access before allowing export
- **Testing**: Full coverage with unit tests (34), integration tests (15), and E2E tests (2)

## 🧩 Reusable Components

### Overview

The application includes reusable UI components designed for maximum flexibility and code reuse. These components follow a composable architecture pattern where complex features are built from smaller, focused components.

### TaskTable Component

The `TaskTable` is a highly reusable component for displaying tasks with advanced features like filtering, sorting, hierarchical subtasks, and role-based permissions.

#### Features

- **Hierarchical Task Display**: Parent tasks with expandable subtasks
- **Advanced Filtering**: Filter by title, status, assignee, department
- **Multi-column Sorting**: Sort by any column with visual indicators
- **Role-based Edit Permissions**: Conditional Edit button based on `canEdit` field
- **Empty States**: Customizable empty state messages
- **Create Task Integration**: Optional Create Task button
- **Task Viewing/Editing**: Built-in modal support for task details

#### Basic Usage

```typescript
'use client';

import { TaskTable } from '@/app/components/TaskTable';
import { trpc } from '@/app/lib/trpc';

export function MyDashboard() {
  const { data, isLoading, error } = trpc.task.getUserTasks.useQuery({
    userId: user?.id || '',
    includeArchived: false,
  });

  return (
    <TaskTable
      tasks={data || []}
      title="My Tasks"
      showCreateButton={true}
      emptyStateConfig={{
        icon: '📝',
        title: 'No tasks yet',
        description: 'Create your first task to get started.',
      }}
      isLoading={isLoading}
      error={error ? new Error(error.message) : null}
    />
  );
}
```

#### Props Reference

```typescript
interface TaskTableProps {
  // Required: Array of tasks to display
  tasks: Task[];

  // Optional: Section title (default: "All Tasks")
  title?: string;

  // Optional: Show "Create Task" button (default: false)
  showCreateButton?: boolean;

  // Optional: Custom handler for Create Task button
  onCreateTask?: () => void;

  // Optional: Empty state configuration
  emptyStateConfig?: {
    icon: string; // Emoji or icon to display
    title: string; // Main message
    description: string; // Supporting text
  };

  // Optional: Loading state
  isLoading?: boolean;

  // Optional: Error state
  error?: Error | null;
}
```

#### Task Data Structure

Tasks must follow this structure (matches backend API response):

```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  priorityBucket: number;
  dueDate: string;

  // Assignments with full user details
  assignments: Array<{
    userId: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }>;

  departmentId: string;
  ownerId: string;
  projectId: string | null;
  parentTaskId: string | null;

  // Subtasks (optional, for hierarchical display)
  subtasks?: Task[];
  hasSubtasks?: boolean;

  // Role-based edit permission (optional, defaults to true)
  canEdit?: boolean;

  // Additional metadata
  isRecurring: boolean;
  recurringInterval: number | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  comments: Array<{
    id: string;
    content: string;
    authorId: string;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

#### Configuration Examples

**Example 1: Personal Dashboard (All tasks editable)**

```typescript
export function PersonalDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = trpc.task.getUserTasks.useQuery(
    { userId: user?.id || '', includeArchived: false },
    { enabled: !!user?.id }
  );

  return (
    <TaskTable
      tasks={data || []}
      title="My Tasks"
      showCreateButton={true}
      emptyStateConfig={{
        icon: '📝',
        title: 'No tasks assigned to you yet',
        description: 'Create your first task or wait for a manager to assign one to you.',
      }}
      isLoading={isLoading}
      error={error ? new Error(error.message) : null}
    />
  );
}
```

**Example 2: Department Dashboard (Role-based editing)**

```typescript
export function DepartmentDashboard() {
  const { data, isLoading, error } = trpc.task.getDepartmentTasksForUser.useQuery();

  return (
    <TaskTable
      tasks={data || []}
      title="Department Tasks"
      showCreateButton={true}
      emptyStateConfig={{
        icon: '📁',
        title: 'No tasks in your department yet',
        description: 'Create your first task or wait for tasks to be added to your department.',
      }}
      isLoading={isLoading}
      error={error ? new Error(error.message) : null}
    />
  );
}
```

**Example 3: Read-only Task View (No create button, no editing)**

```typescript
export function ArchivedTasksView() {
  const { data, isLoading, error } = trpc.task.getUserTasks.useQuery({
    userId: user?.id || '',
    includeArchived: true,
  });

  // Set canEdit=false for all tasks to disable editing
  const tasksReadOnly = data?.map(task => ({ ...task, canEdit: false })) || [];

  return (
    <TaskTable
      tasks={tasksReadOnly}
      title="Archived Tasks"
      showCreateButton={false}  // No create button
      emptyStateConfig={{
        icon: '📦',
        title: 'No archived tasks',
        description: 'Tasks you archive will appear here.',
      }}
      isLoading={isLoading}
      error={error ? new Error(error.message) : null}
    />
  );
}
```

**Example 4: Project-specific Tasks**

```typescript
export function ProjectTasksView({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = trpc.task.getProjectTasks.useQuery({
    projectId,
  });

  return (
    <TaskTable
      tasks={data || []}
      title="Project Tasks"
      showCreateButton={true}
      onCreateTask={() => {
        // Custom handler: Pre-fill project ID
        router.push(`/tasks/create?projectId=${projectId}`);
      }}
      emptyStateConfig={{
        icon: '🎯',
        title: 'No tasks in this project',
        description: 'Create the first task for this project.',
      }}
      isLoading={isLoading}
      error={error ? new Error(error.message) : null}
    />
  );
}
```

#### Toggling Features

##### Toggle Create Task Button

```typescript
// Show Create Task button
<TaskTable tasks={tasks} showCreateButton={true} />

// Hide Create Task button
<TaskTable tasks={tasks} showCreateButton={false} />

// Custom Create Task handler
<TaskTable
  tasks={tasks}
  showCreateButton={true}
  onCreateTask={() => {
    // Your custom logic here
    console.log('Opening custom create task modal...');
    setShowModal(true);
  }}
/>
```

##### Toggle Edit Permissions

```typescript
// Edit button visibility is controlled by the canEdit field in each task

// All tasks editable (canEdit: true)
const editableTasks = tasks.map(task => ({ ...task, canEdit: true }));
<TaskTable tasks={editableTasks} />

// All tasks read-only (canEdit: false)
const readOnlyTasks = tasks.map(task => ({ ...task, canEdit: false }));
<TaskTable tasks={readOnlyTasks} />

// Role-based (from backend API)
// The backend calculates canEdit based on user role and assignment
<TaskTable tasks={data || []} />  // Uses canEdit from API
```

##### Toggle Loading/Error States

```typescript
// Show loading spinner
<TaskTable tasks={[]} isLoading={true} />

// Show error message
<TaskTable tasks={[]} error={new Error('Failed to load tasks')} />

// Show data
<TaskTable tasks={data} isLoading={false} error={null} />
```

##### Customize Empty State

```typescript
// Custom empty state
<TaskTable
  tasks={[]}
  emptyStateConfig={{
    icon: '🎉',
    title: 'All caught up!',
    description: 'You have no pending tasks.',
  }}
/>

// Default empty state (if not specified)
<TaskTable tasks={[]} />
// Shows: "No tasks available"
```

#### Component Architecture

The TaskTable is composed of smaller, focused components:

```
TaskTable/
├── index.ts              # Exports TaskTable and types
├── TaskTable.tsx         # Main container component
├── TaskRow.tsx           # Individual task row with subtasks
├── Pills.tsx             # StatusPill, PriorityPill, DatePill
├── types.ts              # TypeScript interfaces
├── utils.ts              # Sorting, filtering, hierarchy logic
└── styles.ts             # Shared styling constants
```

**Component Responsibilities:**

- **TaskTable.tsx**: Container with filtering, sorting, modals, state management
- **TaskRow.tsx**: Renders individual task with conditional Edit button based on `canEdit`
- **Pills.tsx**: Visual indicators for status, priority, due dates
- **utils.ts**: Business logic for organizing tasks hierarchically
- **types.ts**: Type definitions shared across components
- **styles.ts**: Centralized styling for consistency

#### Backend Integration

The TaskTable works with two main API endpoints:

**1. Personal Tasks (All editable)**

```typescript
// Backend: src/app/server/routers/task.ts
getUserTasks: publicProcedure
  .input(
    z.object({
      userId: z.string().uuid(),
      includeArchived: z.boolean().optional().default(false),
    })
  )
  .query(async ({ ctx, input }) => {
    const tasks = await service.getUserTasks(
      input.userId,
      input.includeArchived
    );
    // All personal tasks are editable
    return tasks.map(task => ({ ...serializeTask(task), canEdit: true }));
  });
```

**2. Department Tasks (Role-based editing)**

```typescript
// Backend: src/app/server/services/TaskService.ts
async getDepartmentTasksForUser(userId: string) {
  // Fetch tasks in department hierarchy with subtasks
  const tasks = await this.prisma.task.findMany({
    where: { /* department hierarchy logic */ },
    include: {
      assignments: { /* full user details */ },
      subtasks: { /* nested subtasks */ },
      // ... other relations
    },
  });

  // Calculate canEdit based on role and assignment
  return tasks.map(task => ({
    ...task,
    canEdit: authService.canEditTask(task, user, departmentIds),
    subtasks: task.subtasks?.map(subtask => ({
      ...subtask,
      canEdit: authService.canEditTask(subtask, user, departmentIds),
    })),
  }));
}
```

**Role-based Permission Logic:**

```typescript
// Backend: src/app/server/services/AuthorizationService.ts
canEditTask(task, user, departmentHierarchy): boolean {
  // STAFF: Can only edit tasks assigned to them
  if (user.role === 'STAFF') {
    return task.assignments.some(a => a.userId === user.userId);
  }

  // MANAGER/HR_ADMIN: Can edit all tasks in hierarchy
  if (user.role === 'MANAGER' || user.role === 'HR_ADMIN') {
    return departmentHierarchy.includes(task.departmentId);
  }

  return false;
}
```

#### Best Practices

1. **Always provide loading state**: Improves user experience during data fetching
2. **Handle errors gracefully**: Show meaningful error messages
3. **Customize empty states**: Make them contextual to the view
4. **Use backend canEdit**: Don't override permissions client-side
5. **Keep tasks prop updated**: Ensure real-time updates when data changes
6. **Use type-safe data**: Follow the Task interface structure exactly

#### Migration Guide

If you have existing dashboard code, here's how to migrate to TaskTable:

**Before (Custom implementation):**

```typescript
export function OldDashboard() {
  const [filters, setFilters] = useState({});
  const [sortBy, setSortBy] = useState('dueDate');
  // ... 500+ lines of filtering, sorting, rendering logic

  return (
    <table>
      {/* Complex table markup */}
    </table>
  );
}
```

**After (TaskTable component):**

```typescript
export function NewDashboard() {
  const { data, isLoading, error } = trpc.task.getUserTasks.useQuery(/* ... */);

  return (
    <TaskTable
      tasks={data || []}
      title="My Tasks"
      showCreateButton={true}
      isLoading={isLoading}
      error={error}
    />
  );
}
```

**Benefits:**

- ✅ Reduced from ~1200 lines to ~30 lines
- ✅ Consistent UI/UX across all dashboards
- ✅ Built-in filtering, sorting, subtask support
- ✅ Role-based permissions handled automatically
- ✅ Easier to maintain and test

### TaskCard Component

The `TaskCard` is a comprehensive modal component for viewing and editing individual task details with role-based permissions, file attachments, comments, and task history.

#### Features

- **Role-based Edit Permissions**: View-only mode for users without edit access
- **Visual Permission Indicator**: Clear banner showing view-only status
- **Inline Field Editing**: Click to edit title, description, status, priority, deadline, recurring settings
- **Assignee Management**: Add/remove assignees (max 5, min 1)
- **Tag Management**: Add/remove tags with visual pills
- **File Attachments**: Upload, download, delete files (10MB max per file, 50MB total)
- **Comments System**: Add, edit, view comments with timestamps
- **Task History**: Complete audit log of all changes
- **Connected Tasks**: View and navigate to parent/subtasks
- **Conditional UI**: All edit controls hidden/disabled based on `canEdit` field

#### Basic Usage

```typescript
'use client';

import { useState } from 'react';
import { TaskCard } from '@/app/components/TaskCard';

export function TaskDetailsModal() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  return (
    <>
      <button onClick={() => setSelectedTaskId('task-123')}>
        View Task
      </button>

      {selectedTaskId && (
        <div style={{ /* modal overlay styles */ }}>
          <TaskCard
            taskId={selectedTaskId}
            onTaskChange={(newTaskId) => setSelectedTaskId(newTaskId)}
          />
          <button onClick={() => setSelectedTaskId(null)}>Close</button>
        </div>
      )}
    </>
  );
}
```

#### Props Reference

```typescript
interface TaskCardProps {
  // Required: Task ID to load and display
  taskId: string;

  // Optional: Callback when navigating to connected tasks
  onTaskChange?: (newTaskId: string) => void;
}
```

#### Permission-based Behavior

The TaskCard automatically adapts its UI based on the `canEdit` field from the backend:

**Edit Mode (canEdit: true)**

- ✅ All fields are clickable and editable
- ✅ Add/Remove Tag buttons visible
- ✅ Add Assignee input visible
- ✅ Remove Assignee button visible (managers only)
- ✅ Add Comment textarea visible
- ✅ File upload controls visible
- ✅ File delete buttons visible
- ✅ Hover effects on editable fields

**View-only Mode (canEdit: false)**

- 👁️ Yellow banner: "View-only mode: You can view this task but cannot edit it"
- ❌ All fields non-clickable (cursor: default)
- ❌ No hover effects on fields
- ❌ Add/Remove buttons hidden
- ❌ File upload section hidden
- ❌ File delete buttons hidden
- ❌ Add Comment section hidden
- ✅ Can still view all data (assignees, tags, comments, files, history)
- ✅ Can download files

#### Editable Fields

When `canEdit: true`, users can edit the following fields by clicking on them:

1. **Title**: Click the title to open inline text input
2. **Description**: Click the description to open textarea
3. **Status**: Click the status pill to open dropdown (TO_DO, IN_PROGRESS, COMPLETED, BLOCKED)
4. **Priority**: Click the priority badge to open number input (1-10)
5. **Deadline**: Click the date to open date picker
6. **Recurring Settings**: Click to toggle recurring and set interval (days)

Each field shows Save/Cancel buttons when editing, with visual feedback (blue border, hover states).

#### Task Data Structure

The TaskCard fetches task data from the `task.getById` endpoint, which returns:

```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  priorityBucket: number;
  dueDate: string;
  isRecurring: boolean;
  recurringInterval: number | null;
  ownerId: string;

  // Assignments with full user details
  assignments: Array<{
    userId: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }>;

  // Tags as string array
  tags: string[];

  // Comments with author details
  comments: Array<{
    id: string;
    content: string;
    authorId: string;
    createdAt: string;
    updatedAt: string;
  }>;

  // Permission field from backend
  canEdit: boolean;
}
```

#### Backend Integration

The TaskCard component uses the following tRPC endpoints:

**1. Fetching Task Details**

```typescript
// Backend: src/app/server/routers/task.ts
getById: publicProcedure
  .input(z.object({ taskId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const task = await service.getTaskById(input.taskId, user);

    // Calculate canEdit based on role and assignment
    const canEdit = authService.canEditTask(task, user, departmentHierarchy);

    // Include full user details for assignees
    return {
      ...serializeTask(task),
      assignments: assignmentsWithUserDetails,
      canEdit, // Permission field for frontend
    };
  });
```

**2. Permission Calculation**

```typescript
// Backend: src/app/server/services/AuthorizationService.ts
canEditTask(task, user, departmentHierarchy): boolean {
  // STAFF: Can only edit tasks assigned to them
  if (user.role === 'STAFF') {
    return task.assignments.some(a => a.userId === user.userId);
  }

  // MANAGER/HR_ADMIN: Can edit all tasks in department hierarchy
  if (user.role === 'MANAGER' || user.role === 'HR_ADMIN') {
    return departmentHierarchy.includes(task.departmentId);
  }

  return false;
}
```

**3. Update Operations**

The TaskCard uses separate tRPC endpoints for each update operation:

- `task.updateTitle` - Update task title
- `task.updateDescription` - Update description
- `task.updateStatus` - Change task status
- `task.updatePriority` - Update priority (1-10)
- `task.updateDeadline` - Change due date
- `task.updateRecurring` - Toggle recurring settings
- `task.addTag` / `task.removeTag` - Manage tags
- `task.addComment` / `task.updateComment` - Manage comments
- `task.addAssignee` / `task.removeAssignee` - Manage assignees (min 1, max 5)
- `taskFile.uploadFile` / `taskFile.deleteFile` - Manage file attachments

#### Usage Examples

**Example 1: Staff Member Viewing Assigned Task (Edit Mode)**

```typescript
// User: STAFF, Assigned: Yes
// Backend returns: canEdit: true

<TaskCard taskId="task-123" />

// Result:
// - Yellow view-only banner: NOT shown
// - All fields: Clickable and editable
// - Add buttons: Visible
// - File uploads: Enabled
```

**Example 2: Staff Member Viewing Unassigned Task (View-only Mode)**

```typescript
// User: STAFF, Assigned: No
// Backend returns: canEdit: false

<TaskCard taskId="task-456" />

// Result:
// - Yellow view-only banner: "👁️ View-only mode: You can view this task but cannot edit it"
// - All fields: Non-clickable (cursor: default)
// - Add buttons: Hidden
// - File uploads: Hidden
// - Can still: View data, download files, see history
```

**Example 3: Manager Viewing Department Task (Edit Mode)**

```typescript
// User: MANAGER, Task in department hierarchy
// Backend returns: canEdit: true

<TaskCard taskId="task-789" />

// Result:
// - Full edit access to all fields
// - Can add/remove assignees (including removing owner from assignees)
// - Can manage all aspects of the task
```

**Example 4: Navigating to Connected Tasks**

```typescript
<TaskCard
  taskId="parent-task-123"
  onTaskChange={(newTaskId) => {
    // User clicked on a subtask or parent task link
    console.log('Navigating to task:', newTaskId);
    setSelectedTaskId(newTaskId);
  }}
/>

// The ConnectedTasks component inside TaskCard shows:
// - Parent task (if exists)
// - All subtasks
// Clicking them triggers onTaskChange callback
```

#### Integration with TaskTable

The TaskCard is typically used with TaskTable for a complete task management experience:

```typescript
export function Dashboard() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { data, isLoading, error } = trpc.task.getUserTasks.useQuery();

  return (
    <>
      <TaskTable
        tasks={data || []}
        title="My Tasks"
        showCreateButton={true}
        onViewTask={(taskId) => setSelectedTaskId(taskId)}
        onEditTask={(taskId) => setSelectedTaskId(taskId)}
        isLoading={isLoading}
        error={error}
      />

      {/* Task details modal */}
      {selectedTaskId && (
        <div style={{ /* modal overlay */ }}>
          <TaskCard
            taskId={selectedTaskId}
            onTaskChange={(newTaskId) => setSelectedTaskId(newTaskId)}
          />
          <button onClick={() => setSelectedTaskId(null)}>✕ Close</button>
        </div>
      )}
    </>
  );
}
```

#### Component Features in Detail

**Assignee Management (AC7 - TM015)**

- **Add**: Enter email address, max 5 assignees (TM023)
- **Remove**: Manager-only (SCRUM-15 AC3), min 1 assignee (TM016)
- **Owner**: Can be removed from assignees but remains as owner (AC6 edge case)
- **Display**: Shows name, email, and owner badge

**Tag Management**

- **Add**: Type tag name and click "Add Tag"
- **Remove**: Click × button on tag pill
- **Display**: Visual pills with remove buttons (when editable)

**File Attachments**

- **Upload**: 10MB max per file, 50MB total storage per task
- **Allowed Types**: PDF, images (JPG, PNG, GIF), documents (DOC, DOCX), spreadsheets (XLS, XLSX), ZIP
- **Download**: Click download button (available in view-only mode)
- **Delete**: Click delete button (hidden in view-only mode)
- **Storage Progress**: Visual bar showing usage (50MB limit)

**Comments**

- **Add**: Textarea with "Add Comment" button (hidden in view-only mode)
- **Edit**: Click "✏️ Edit" button (only on own comments)
- **Display**: Author name, timestamp, "(edited)" indicator
- **Format**: Preserves line breaks with `whiteSpace: 'pre-wrap'`

**Task History**

- **Tabs**: Switch between "Comments" and "History"
- **Log Entries**: Shows all task actions (created, updated, status changed, etc.)
- **Details**: User name, action type, field changes, timestamp
- **Read-only**: History is always viewable, never editable

#### Best Practices

1. **Always use backend canEdit**: Never override the permission field client-side
2. **Handle task navigation**: Implement `onTaskChange` for connected tasks navigation
3. **Modal management**: Control modal open/close state from parent component
4. **Loading states**: TaskCard handles its own loading while fetching task data
5. **Error handling**: TaskCard displays inline error messages
6. **Real-time updates**: TaskCard refetches data after each update operation

#### Accessibility & UX

- **Visual feedback**: Hover states, focus states, active states on all interactive elements
- **Disabled states**: Non-clickable fields have `cursor: default` and no hover effects
- **Color coding**: Status (blue/green/red/gray), Priority (red/yellow/green), Overdue dates (red)
- **Success messages**: Green banner with auto-dismiss after 3 seconds
- **Error messages**: Red banner with auto-dismiss after 5 seconds
- **View-only banner**: Persistent yellow banner when `canEdit: false`

### TaskCalendar Component

Reusable calendar component for displaying tasks in calendar views with recurring task support.

**Location**: `src/app/components/Calendar/TaskCalendar.tsx`

#### Features

- **Multiple Views**: Month, Week, Day, Agenda views via React Big Calendar
- **3 Calendar Types**: Personal (user tasks), Departmental (manager view), Project (all project tasks)
- **Visual Indicators**:
  - Status colors (blue/green/yellow/orange/gray)
  - Priority borders (red/yellow/green)
  - Dashed borders for recurring task forecasts
  - Overdue styling (orange + red border)
- **Recurring Tasks**: Duration-based forecast generation (gray dashed events)
- **Interactive Features**: Click to view task details, export to iCal format
- **Smart Display**: Shows max 4 events per day, remaining hidden behind "+more" button

#### Basic Usage

```tsx
<TaskCalendar calendarType='personal' selectedTags={[]} isWideView={true} />
```

#### Recurring Task Behavior

Recurring tasks display **forecast occurrences** (gray dashed events) on the calendar based on task duration:

- **Original Task**: Shown with normal status color and solid border
- **Forecast Occurrences**: Shown with gray background and dashed border
- **Generation Logic**: Forecasts generate while `nextStart ≤ originalEnd` (duration-based)
- **Completed Tasks**: Do not generate forecasts (prevents duplicates)

When a recurring task is marked complete, a new occurrence is automatically created with:

- `createdAt` and `dueDate` shifted by `recurringInterval` days
- Status reset to `TO_DO`
- All other fields preserved (title, description, priority, assignments, etc.)

#### Related Tests

- **Unit Tests**: `tests/unit/components/Calendar/utils/generateRecurringEvents.test.ts`
- **E2E Tests**: `tests/e2e/calendar/calendar-personal.spec.ts`

## 📁 Project Structure

```
all-in-one/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Seed script
│   ├── data/              # Seed data JSON files
│   └── migrations/        # Migration history
├── src/
│   ├── app/
│   │   ├── server/       # Backend API Layer
│   │   │   ├── services/ # OOP Service Classes (simpler domains)
│   │   │   ├── routers/  # tRPC routers (thin wrappers)
│   │   │   ├── types/    # Shared TypeScript types
│   │   │   └── trpc.ts   # tRPC configuration
│   │   └── ...           # Next.js app directory
│   ├── domain/           # DDD Domain Layer (complex domains)
│   │   └── task/         # Task domain (rich entities)
│   │       ├── Task.ts            # Aggregate Root
│   │       ├── PriorityBucket.ts  # Value Object
│   │       └── errors/            # Domain errors
│   ├── services/         # DDD Application Layer
│   │   ├── task/         # Task use cases
│   │   └── storage/      # Storage service
│   └── repositories/     # DDD Infrastructure Layer
│       ├── ITaskRepository.ts       # Repository interface
│       └── PrismaTaskRepository.ts  # Prisma adapter
├── tests/                # Test suite organization
│   ├── unit/
│   │   ├── domain/       # DDD domain entity tests (pure logic)
│   │   ├── services/     # Service layer tests (OOP + DDD)
│   │   ├── components/   # React component tests
│   │   └── lib/          # Utility function tests
│   ├── integration/      # Integration tests (database + services)
│   └── e2e/              # End-to-end tests (Playwright)
├── supabase/             # Supabase Docker configuration
├── OOP.md                # OOP & DDD Architecture documentation
└── .env.example          # Environment template
```

### Backend Architecture (Hybrid: OOP + DDD)

This project uses **two architectural patterns** based on domain complexity:

#### OOP Service Layer (Simpler Domains)

- **Service Layer** (`src/app/server/services/`): TypeScript classes for business logic
- **Router Layer** (`src/app/server/routers/`): Thin tRPC wrappers delegating to services
- **Used for**: Department, UserProfile, Team, Project, Comment, Notification
- **Pattern**: Anemic domain model with service layer orchestration

#### Domain-Driven Design (Complex Domains)

- **Domain Layer** (`src/domain/task/`): Rich entities with business logic
- **Application Layer** (`src/services/task/`): Use case orchestration
- **Infrastructure Layer** (`src/repositories/`): Database abstraction
- **Presentation Layer** (`src/app/server/routers/`): tRPC API endpoints
- **Used for**: Task Management (complex rules, rich behavior)
- **Pattern**: Clean architecture with rich domain model

For complete architecture details, implementation guide, and examples, see [OOP.md](./OOP.md).

You can start editing by modifying `src/app/page.tsx`. The page auto-updates as you edit.
