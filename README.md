# all-in-one

A Smart Task Management System, developed for All-In-One, a leading digital transformation company.

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

4. **Accessing the Services**
   - **Next.js App**: [http://localhost:3000](http://localhost:3000)
   - **Supabase Studio**: [http://localhost:8000](http://localhost:8000) (Use credentials from `.env` file if prompted)
   - **Prisma Studio**: [http://localhost:5555](http://localhost:5555) (You'll need to run `npx prisma studio`)

5. **Stopping the Services**

   ```bash
   cd supabase
   docker compose --env-file ../.env down
   ```

### When You Pull New Changes

If someone else has made database changes:

```bash
# Apply new migrations
npm run db:migrate

# Regenerate Prisma Client
npx prisma generate

# Start development
npm run dev
```

For more advanced database management and development practices, see [DEVELOPMENT.md](./DEVELOPMENT.md).

### Other Useful Commands

```bash
npm run db:reset          # Reset database (clear + reseed)
npm run lint              # Check for linting
npm run lint:fix          # Auto-fix linting issues
npm run format            # Format code with Prettier
npm run type-check        # TypeScript type checking
```

## 🛠️ Tech Stack

<p align="center"><strong>UI</strong></p>
<p align="center">
<a href="https://react.dev/"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg" alt="React" height="50" width="50"/></a>&nbsp;&nbsp;
<a href="https://www.typescriptlang.org"><img src="https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg" alt="Typescript" height="50" width="50"/></a>&nbsp;&nbsp;
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript"><img src="https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png" alt="JavaScript" height="50" width="50"/></a>&nbsp;&nbsp;
<a href="https://tailwindcss.com"><img src="https://upload.wikimedia.org/wikipedia/commons/d/d5/Tailwind_CSS_Logo.svg" alt="Tailwind" height="50" width="50"/></a>&nbsp;&nbsp;
<a href="https://nextjs.org"><img src="https://www.svgrepo.com/show/354113/nextjs-icon.svg" alt="Next.js" height="50" width="50"/></a>&nbsp;&nbsp;
<a href="https://nextjs.org/docs/app/api-reference/turbopack"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTAnox03Lsj1FgQTzP1Wfg5qpH7ZoImCSUc7g&s" alt="Next.js" height="50" width="50"/></a>&nbsp;&nbsp;
<a href="https://supabase.com/"><img src="https://www.vectorlogo.zone/logos/supabase/supabase-icon.svg" alt="Supabase" height="50" width="50"/></a>&nbsp;&nbsp;
<br>
<i>React · Typescript · JavaScript · Tailwind CSS · Next.js · Turbopack · Supabase Auth</i>
</p>
<br>

<p align="center"><strong>API Layer</strong></p>
<p align="center">
<a href="https://trpc.io"><img src="https://trpc.io/img/logo.svg" alt="tRPC" height="50" width="50"/></a>&nbsp;&nbsp;
<br>
<i>tRPC</i>
</p>
<br>

<p align="center"><strong>Database</strong></p>
<p align="center">
<a href="https://www.prisma.io"><img src="https://raw.githubusercontent.com/prisma/presskit/main/Assets/Preview-Prisma-LightLogo.png" alt="Prisma" height="50"/></a>&nbsp;&nbsp;
<a href="https://supabase.com/"><img src="https://www.vectorlogo.zone/logos/supabase/supabase-icon.svg" alt="Supabase" height="50" width="50" /></a>&nbsp;&nbsp;
<br>
<i>Prisma ORM · Supabase</i>
</p>
<br>

<p align="center"><strong>DevSecOps</strong></p>
<p align="center">
<a href="https://github.com/features/actions"><img src="https://avatars.githubusercontent.com/u/44036562?s=200&v=4" alt="GitHub Actions" height="50" width="50" /></a>&nbsp;&nbsp;
<a href="https://codeql.github.com"><img src="https://avatars.githubusercontent.com/u/87730430?s=200&v=4" alt="GitHub CodeQL" height="50" width="50" /></a>&nbsp;&nbsp;
<a href="https://vercel.com"><img src="https://www.svgrepo.com/show/354513/vercel-icon.svg" alt="Vercel Deployment" height="50" width="50" /></a>&nbsp;&nbsp;
<a href="https://gitleaks.io"><img src="https://gitleaks.io/logo.png" alt="Git Leaks" height="50" width="50" /></a>&nbsp;&nbsp;
<a href="https://eslint.org"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/ESLint_logo.svg/1200px-ESLint_logo.svg.png" alt="ESLint 8" height="50" width="50" /></a>&nbsp;&nbsp;

<br>
<i>GitHub Actions · GitHub CodeQL · Vercel Deployment · GitLeaks · ESLint 8</i>
</p>
<br>

<p align="center"><strong>Testing Frameworks</strong></p>
<p align="center">
<a href="https://jestjs.io"><img src="https://e7.pngegg.com/pngimages/755/519/png-clipart-jest-logo-tech-companies-thumbnail.png" alt="Jest" height="50" width="50" /></a>&nbsp;&nbsp;
<a href="https://playwright.dev"><img src="https://playwright.dev/img/playwright-logo.svg" alt="Playwright" height="50" /></a>&nbsp;&nbsp;
<br>
<i>Jest · Playwright</i>
</p>
<br>

<p align="center"><strong>External API</strong></p>
<p align="center">
<a href="https://resend.com"><img src="https://avatars.githubusercontent.com/u/109384852?s=280&v=4" alt="Resend" height="50" width="50"/></a>&nbsp;&nbsp;
<br>
<i>Resend API</i>
</p>
<br>

<p align="center"><strong>Other Technologies</strong></p>
<p align="center">
<a href="https://www.docker.com/"><img src="https://upload.wikimedia.org/wikipedia/commons/4/4e/Docker_%28container_engine%29_logo.svg" alt="Docker" height="50" /></a>&nbsp;&nbsp;
<a href="https://supabase.com/"><img src="https://www.vectorlogo.zone/logos/supabase/supabase-icon.svg" alt="Supabase" height="50" width="50" /></a>&nbsp;&nbsp;
<br>
<i>Docker Compose · Supabase Realtime</i>
</p>
<br>

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

Note: Remember to run setup command with docker running first. (if using local deployment)

```bash
npm run dev:setup
```

Here are the commands:

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
