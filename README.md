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

3. **Run the Automated Setup Script**
   From the project root, run the `dev:setup` script. This single command will handle all the necessary setup steps for you.

   ```bash
   npm run dev:setup
   ```

   This script automates the following:
   - Installs all dependencies (`npm install`)
   - Starts the Supabase services using Docker
   - Applies database migrations
   - Seeds the database with sample data
   - Sets up Supabase storage
   - Starts the Next.js development server

   **Note:** This is a long-running process that will occupy your terminal. Wait for the script to finish and for the Next.js server to start.

4. **Accessing the Services**
   - **Next.js App**: [http://localhost:3000](http://localhost:3000)
   - **Supabase Studio**: [http://localhost:8000](http://localhost:8000)(Use credentials from `.env` file if prompted)
   - **Prisma Studio**: [http://localhost:5555](http://localhost:5555)(You'll need to run `npx prisma studio`)

5. **Stopping the Services**

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

For more advanced database management and development practices, see [DEVELOPMENT.md](./DEVELOPMENT.md).

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 with TypeScript, App Router
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime), tRPC
- **API Layer**: tRPC with Hybrid Architecture (OOP + DDD)
- **Database ORM**: Prisma
- **Development**: Docker, Docker Compose
- **Code Quality**: ESLint, Prettier, Husky pre-commit hooks
- **Testing**: Jest, React Testing Library, Playwright

## 🏗️ Architecture

This project uses a **Hybrid Backend Architecture** combining two patterns based on domain complexity:

### OOP Service Layer (Simpler Domains)

- **Pattern**: Anemic domain model with service layer orchestration
- **Used for**: Department, UserProfile, Team, Project, Comment, Notification
- **Benefits**: Clear separation, easy to maintain, suitable for CRUD operations

### Domain-Driven Design (Complex Domains)

- **Pattern**: Rich domain models with clean architecture
- **Used for**: Task Management (complex business rules, rich behavior)
- **Layers**: Domain → Application → Infrastructure → Presentation
- **Benefits**: Enforced invariants, database-agnostic, highly testable

### Key Features

- **Encapsulation**: Business logic isolated in appropriate layers
- **Testability**: Comprehensive test coverage (unit, integration, e2e)
- **Type Safety**: Full TypeScript support across all layers
- **Flexibility**: Choose architecture pattern based on domain complexity

For detailed architecture documentation, patterns, and implementation guide, see [OOP.md](./OOP.md).

## 🧪 Testing

This project uses a comprehensive testing strategy:

- **Unit Tests** (Jest) - Fast, isolated component and utility tests
- **Integration Tests** (Jest) - Database and API tests
- **E2E Tests** (Playwright) - Full user flow tests

### Quick Start

```bash
# Run ALL tests sequentially (unit → integration → E2E)
npm test

# Run only unit tests (fast, no database required)
npm run test:unit

# Run only integration tests (requires database)
npm run test:integration

# Run only E2E tests (requires database)
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:debug

# Run tests with coverage
npm run test:coverage
```

**For detailed information:**

- Test structure and organization
- Writing tests (components, services, database operations)
- Test best practices and guidelines
- CI/CD pipeline details
- Coverage reporting

See the comprehensive testing guide in [DEVELOPMENT.md](./DEVELOPMENT.md#-testing).

For development practices, code quality standards, authentication details, and project structure, see [DEVELOPMENT.md](./DEVELOPMENT.md).

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
