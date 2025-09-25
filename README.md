# all-in-one

A Next.js application with Supabase backend, designed for local development with Docker.

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js](https://nodejs.org/) (18.17 or later)

### Local Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/WeiShenL/all-in-one
   cd all-in-one
   ```

2. **Set up Environment Variables**
   In the project **root**, create your local environment file by copying the template.

   ```bash
   cp .env.example .env
   ```

   **⚠️ IMPORTANT: Environment Switching**

   The `.env` file uses **comment-based environment switching**:
   - **Local Development (default)**: Database and Supabase sections are uncommented
   - **Staging**: Comment out Local sections, uncomment STAGING sections
   - **Production**: Comment out other sections, uncomment PRODUCTION sections

   **Always ensure only ONE environment is uncommented at a time.**

   The default configuration will work for local development.

3. **Start the Supabase Stack**
   All Docker commands must be run from _inside_ the `supabase` directory.

   First, navigate into the folder:

   ```bash
   cd supabase
   ```

   Then, start all the services using the following command:

   ```bash
   docker compose --env-file ../.env up -d
   ```

   The first run may take several minutes to download all the necessary container images. Once done, navigate back to the project root:

   ```bash
   cd ..
   ```

4. **Install Next.js Dependencies**
   In a new terminal, from the project root:

   ```bash
   npm install
   ```

5. **Run the Database Migration**
   With the Supabase database running, apply the schema to your database using Prisma Migrate. This command reads your `prisma/schema.prisma` file and creates the corresponding tables.

   ```bash
   npx prisma migrate dev --name init
   ```

   **Verify Database Connection (Optional)**
   Test your Prisma Client setup:

   ```bash
   npx prisma studio
   ```

6. **Seed the Database**
   To populate your database with initial data (e.g., user roles), run the seed script.

   ```bash
   npx prisma db seed
   ```

7. **Start the Next.js Development Server**

   ```bash
   npm run dev
   ```

8. **Accessing the Services**
   - **Next.js App**: [http://localhost:3000](http://localhost:3000)
   - **Supabase Studio**: [http://localhost:8000](http://localhost:8000)(Use credentials from `.env` file if prompted)
   - **Prisma Studio**: [http://localhost:5555](http://localhost:5555)(You'll need to run `npx prisma studio`)

9. **Stopping the Services**
   ```bash
   cd supabase
   docker compose --env-file ../.env down
   ```

### When You Pull New Changes

If someone else has made database changes:

```bash
# Apply new migrations
npx prisma migrate deploy
# OR use our script: npm run db:migrate

# Regenerate Prisma Client
npx prisma generate

# Start development
npm run dev
```

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

## 🌱 Database Seeding

### Seed Data Structure

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

### Running the Seed

To populate your database with sample data:

```bash
npx prisma db seed
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 with TypeScript, App Router
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Database ORM**: Prisma
- **Development**: Docker, Docker Compose
- **Code Quality**: ESLint, Prettier, Husky pre-commit hooks

## 🧪 Testing

This project uses Jest and React Testing Library for comprehensive unit and integration testing.

### Running Tests

```bash
npm test
```

### Run tests in watch mode (automatically re-run on file changes)

```bash
npm run test:watch
```

### Run tests with coverage report

```bash
npm run test:coverage
```

### Coverage Reports

Coverage reports are generated in the `coverage/` directory when running `npm run test:coverage`:

- **Text summary**: Displayed in terminal
- **HTML report**: Open `coverage/index.html` in your browser for detailed visual coverage
- **LCOV format**: `coverage/lcov.info` for integration with external tools

### Test Structure

- **Test files**: Located in `__tests__` folders or use `.test.tsx` suffix
- **Component tests**: Focus on user interactions, rendering, and accessibility
- **Coverage goal**: Aim for comprehensive coverage of business logic and critical components

### Writing Tests

This project follows React Testing Library best practices for writing maintainable, user-focused tests.

**Test file structure:**

- Place test files in `__tests__` folders or use `.test.tsx` suffix
- Test files should mirror your component structure (e.g., `components/Button.tsx` → `components/__tests__/Button.test.tsx`)

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

### Project Structure

```
all-in-one/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Seed script
│   ├── data/              # Seed data JSON files
│   └── migrations/        # Migration history
├── src/
│   ├── app/              # Next.js app directory
│   └── generated/        # Auto-generated Prisma Client
├── supabase/             # Supabase Docker configuration
└── .env.example          # Environment template
```

You can start editing by modifying `src/app/page.tsx`. The page auto-updates as you edit.

## 📚 Learn More

### Next.js Resources

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [Learn Next.js](https://nextjs.org/learn) - interactive Next.js tutorial

### Supabase Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Self-Hosting with Docker](https://supabase.com/docs/guides/hosting/docker)

### Prisma Resources

- [Prisma Documentation](https://www.prisma.io/docs/orm/prisma-schema/overview)

## 🚀 Deployment

### Next.js Deployment

Deploy your Next.js app using the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

### Supabase Production

For production Supabase deployment, see the [hosting documentation](https://supabase.com/docs/guides/hosting/docker#securing-your-services) and ensure you update all default credentials.
