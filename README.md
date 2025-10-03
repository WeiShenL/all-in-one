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

For more advanced database management and development practices, see [DEVELOPMENT.md](./DEVELOPMENT.md).

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 with TypeScript, App Router
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime), tRPC
- **API Layer**: tRPC with OOP Service Architecture
- **Database ORM**: Prisma
- **Development**: Docker, Docker Compose
- **Code Quality**: ESLint, Prettier, Husky pre-commit hooks

## 🏗️ Architecture

This project uses an **Object-Oriented Programming (OOP) architecture** for the backend:

- **Service Layer Pattern**: Business logic encapsulated in TypeScript classes
- **Full CRUD Operations**: Complete service classes for all entities
- **OOP Principles**: Encapsulation, Inheritance, Single Responsibility, Dependency Injection
- **tRPC Integration**: Thin router wrappers delegate to service classes
- **Fully Tested**: Comprehensive unit and integration test coverage

For detailed architecture documentation and implementation guide, see [OOP.md](./OOP.md).

## 🧪 Testing

This project uses Jest and React Testing Library for testing.

### Quick Start

```bash
# Run all tests
npm test

# Run only unit tests (fast, isolated)
npm run test:unit

# Run only integration tests (requires database)
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

For detailed testing guidelines, best practices, and examples, see [DEVELOPMENT.md](./DEVELOPMENT.md).

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
