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

2.  **Set up Environment Variables**
    In the project **root**, create your local environment file by copying the template.

    ```bash
    cp .env.example .env
    ```

    The default placeholders in the `.env` file will work for local development.
    
3.  **Start the Supabase Stack**
    All Docker commands must be run from *inside* the `supabase` directory.

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

5.  **Run the Database Migration**
    With the Supabase database running, apply the schema to your database using Prisma Migrate. This command reads your `prisma/schema.prisma` file and creates the corresponding tables.

    ```bash
    npx prisma migrate dev --name init
    ```

6.  **Seed the Database (Optional)**
    To populate your database with initial data (e.g., user roles), run the seed script.

    ```bash
    npx prisma db seed
    ```

7. **Start the Next.js Development Server**
    ```bash
    npm run dev
    ```

8.  **Accessing the Services**
    - **Next.js App**: [http://localhost:3000](http://localhost:3000)
    - **Supabase Studio**: [http://localhost:8000](http://localhost:8000)(Use credentials from `.env` file if prompted)

### When You Pull New Changes

If someone else has made database changes:

```bash
# Apply new migrations
npx prisma migrate deploy

# Regenerate Prisma Client
npx prisma generate

# Start development
npm run dev
```

### Making Database Schema Changes

1. **Edit** `prisma/schema.prisma`
2. **Create migration**:
   ```bash
   npx prisma migrate dev --name your_change_description
   ```
3. **Commit** the generated migration files to Git

### Stopping the Services

```bash
cd supabase
docker compose --env-file ../.env down
```

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

## 🛠️ Tech Stack
- **Frontend**: Next.js 15 with TypeScript, App Router
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Database ORM**: Prisma
- **Development**: Docker, Docker Compose

### Project Structure
```
all-in-one/
├── prisma/               # Prisma schema and seed script
├── src/
│   ├── app/              # Next.js app directory
│   └── generated/        # Auto-generated files (e.g., Prisma Client)
├── supabase/             # Supabase Docker configuration
├── .env.example          # Environment variables template
└── package.json          # Node.js dependencies
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