# Supabase Database Setup Guide

This guide explains how to set up and work with Supabase databases for our Next.js application in both staging and production environments.

## Table of Contents

1. [Overview](#overview)
2. [Initial Setup](#initial-setup)
3. [Environment Variables](#environment-variables)
4. [Database Migrations](#database-migrations)
5. [Vercel Deployment](#vercel-deployment)
6. [Using Supabase in Code](#using-supabase-in-code)
7. [Troubleshooting](#troubleshooting)

## Overview

Our application uses Supabase as a managed PostgreSQL database provider with two separate projects:

- **Staging Database**: For development and testing
- **Production Database**: For live production data

## Initial Setup

### 1. Create Supabase Projects

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create two new projects:
   - One for staging (e.g., `yourapp-staging`)
   - One for production (e.g., `yourapp-production`)
3. Wait for both projects to finish provisioning

### 2. Get Connection Strings

For each project:

1. Navigate to **Settings** → **Database**
2. Copy the following values:
   - **Connection string** (URI format)
   - **Direct connection string** (for migrations)

Also get the API keys:

1. Navigate to **Settings** → **API**
2. Copy:
   - **Project URL**
   - **Anon/Public key** (safe for client-side)
   - **Service role key** (server-side only - keep secret!)

## Environment Variables

### Environment Configuration

Copy `.env.example` to `.env` and update with your actual values:

```bash
############
# Database Connection - Local Development (uncommented = active)
############
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/postgres"
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/postgres"

############
# Database Connection - STAGING (comment out local, uncomment staging)
############
# DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true"
# DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

############
# Supabase Connection - Local Development (uncommented = active)
############
API_EXTERNAL_URL=http://localhost:8000
NEXT_PUBLIC_API_EXTERNAL_URL=http://localhost:8000
NEXT_PUBLIC_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

############
# Supabase Connection - STAGING (comment out local, uncomment staging)
############
# API_EXTERNAL_URL=https://[PROJECT-REF].supabase.co
# NEXT_PUBLIC_API_EXTERNAL_URL=https://[PROJECT-REF].supabase.co
# NEXT_PUBLIC_ANON_KEY=[STAGING_ANON_KEY]
```

### Switching Environments

To switch between environments, comment/uncomment the appropriate sections:

**For Local Development (default):**

- Database and Supabase sections are uncommented
- Uses local Supabase instance

**For Staging:**

- Comment out Local sections (add `#` to each line)
- Uncomment STAGING sections (remove `#`)
- Replace placeholders with actual staging values

**For Production:**

- Comment out other environments
- Uncomment PRODUCTION sections
- Replace placeholders with actual production values

### Important Notes

- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
- Service role keys should NEVER be prefixed with `NEXT_PUBLIC_`
- The `.env` file is gitignored and should never be committed
- No environment detection logic in code - switching happens at the `.env` level

## Database Migrations

### Creating Migrations

We use **Prisma** for database schema management and migrations. Migrations are stored in `prisma/migrations/`.

#### Create a New Migration

1. Modify your `prisma/schema.prisma` file:

   ```prisma
   model Post {
     id        String   @id @default(cuid())
     title     String
     content   String?
     authorId  String
     author    User     @relation(fields: [authorId], references: [id])
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
   }
   ```

2. Generate the migration:

   ```bash
   npx prisma migrate dev --name add_posts_table
   ```

3. This creates a new migration in `prisma/migrations/[timestamp]_add_posts_table/`

### Applying Migrations

#### Using Our Scripts

**Step 1**: Switch environment in `.env` file

- Comment out current environment section
- Uncomment target environment section (staging/production)

**Step 2**: Run migration

```bash
# Apply migrations to whatever environment is active in .env
npm run db:migrate

# OR push schema directly (for development)
npm run db:push

# Alternative: Direct Prisma commands
npx prisma migrate deploy
npx prisma db push
```

#### Manual Application

1. Switch environment in `.env` file (comment/uncomment appropriate sections)
2. Run: `npx prisma migrate deploy`

### Migration Best Practices

1. **Always test migrations on staging first**
2. **Keep migrations safe** - Prisma handles this automatically
3. **Version control all migrations** in the `prisma/migrations/` folder
4. **Document breaking changes** in migration commit messages
5. **Never modify existing migration files** - create new ones instead

## Vercel Deployment

### Setting Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add all the environment variables from your `.env.local`
4. Set the appropriate values for each environment:
   - **Development**: Staging database values
   - **Preview**: Staging database values
   - **Production**: Production database values

### Environment-Specific Variables

Vercel allows you to set different values per environment:

| Variable                     | Development/Preview | Production            |
| ---------------------------- | ------------------- | --------------------- |
| `NEXT_PUBLIC_ENV`            | `staging`           | `production`          |
| `STAGING_DATABASE_URL`       | ✓ Set               | ✓ Set                 |
| `PRODUCTION_DATABASE_URL`    | Optional            | ✓ Set                 |
| `NEXT_PUBLIC_SUPABASE_URL_*` | Use staging values  | Use production values |

## Using Supabase in Code

### Client-Side Usage

```typescript
import { supabase } from '@/lib/supabase/client';

// Example: Fetch data
const { data, error } = await supabase
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false });

// Example: Insert data
const { data, error } = await supabase
  .from('posts')
  .insert({ title: 'New Post', content: 'Content here' });
```

### Server-Side Usage (API Routes)

```typescript
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: Request) {
  // Admin client bypasses RLS
  const { data, error } = await supabaseAdmin.from('users').select('*');

  return Response.json({ data });
}
```

### Authentication

```typescript
import { supabase } from '@/lib/supabase/client';

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

// Sign out
await supabase.auth.signOut();
```

## Troubleshooting

### Common Issues

#### 1. "Missing environment variables" error

- **Solution**: Ensure all required environment variables are set in `.env.local` and Vercel

#### 2. "Permission denied" database errors

- **Solution**: Check Row Level Security (RLS) policies in your database

#### 3. "Connection refused" errors

- **Solution**: Verify your database URL is correct and the project is active

#### 4. Migrations not applying

- **Solution**: Check that you're using the correct database URL for your environment

### Debugging Tips

1. **Check environment variables**:

   ```typescript
   // Add to any page/component temporarily
   console.log('Environment:', process.env.NEXT_PUBLIC_ENV);
   console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL_STAGING);
   ```

2. **Validate environment setup**:

   ```typescript
   import { validateEnvVars } from '@/lib/supabase/server';

   const { isValid, missing } = validateEnvVars();
   if (!isValid) {
     console.error('Missing env vars:', missing);
   }
   ```

3. **Test database connection**:

   ```typescript
   const { data, error } = await supabase.from('users').select('count');

   if (error) console.error('Database error:', error);
   ```

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)

## Support

For issues or questions:

1. Check this documentation first
2. Review the Supabase dashboard logs
3. Ask in the team Slack channel
4. Create an issue in the GitHub repository
