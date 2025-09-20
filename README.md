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

   The default placeholders in the `.env` file will work for local development.

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

   This command explicitly tells Docker to use the `.env` file from the project root, ensuring a reliable startup. The first run may take several minutes to download all the necessary container images.

4. **Install Next.js Dependencies**
   In a new terminal, from the project root:

   ```bash
       npm install
   ```

5. **Start the Next.js Development Server**
   ```bash
       npm run dev
   ```
6. **Accessing the Services**
   - **Next.js App**: [http://localhost:3000](http://localhost:3000)
   - **Supabase Studio**: [http://localhost:8000](http://localhost:8000)

7. **Stopping the Services**
   To stop all running containers, make sure you are still inside the `supabase` directory and run:

   ```bash
   docker compose --env-file ../.env down
   ```

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 with TypeScript, App Router, Turbopack
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Development**: Docker, Docker Compose
- **Code Quality**: ESLint, Prettier, Husky pre-commit hooks

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
npm run lint        # Check for linting issues
npm run lint:fix    # Fix auto-fixable linting issues
npm run format      # Format all files with Prettier
npm run format:check # Check formatting without fixing
```

### Project Structure

all-in-one/  
├── src/app/ # Next.js app directory
├── supabase/ # Supabase Docker configuration
├── .env.example # Environment variables template
└── package.json # Node.js dependencies

You can start editing by modifying `src/app/page.tsx`. The page auto-updates as you edit.

## 📚 Learn More

### Next.js Resources

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [Learn Next.js](https://nextjs.org/learn) - interactive Next.js tutorial

### Supabase Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Self-Hosting with Docker](https://supabase.com/docs/guides/hosting/docker)

## 🚀 Deployment

### Next.js Deployment

Deploy your Next.js app using the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

### Supabase Production

For production Supabase deployment, see the [hosting documentation](https://supabase.com/docs/guides/hosting/docker#securing-your-services) and ensure you update all default credentials.
