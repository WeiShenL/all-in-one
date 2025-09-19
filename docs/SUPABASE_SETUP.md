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

### Local Development

Create a `.env.local` file in the project root with your actual values:

```bash
# Staging Database
STAGING_DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL_STAGING="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING="[YOUR-ANON-KEY]"
SUPABASE_SERVICE_ROLE_KEY_STAGING="[YOUR-SERVICE-ROLE-KEY]"

# Production Database
PRODUCTION_DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL_PRODUCTION="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY_PRODUCTION="[YOUR-ANON-KEY]"
SUPABASE_SERVICE_ROLE_KEY_PRODUCTION="[YOUR-SERVICE-ROLE-KEY]"

# Environment flag
NEXT_PUBLIC_ENV="development"  # or "production"
```

### Important Notes
- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
- Service role keys should NEVER be prefixed with `NEXT_PUBLIC_`
- The `.env.local` file is gitignored and should never be committed

## Database Migrations

### Creating Migrations

Migrations are SQL files that define database schema changes. They're stored in `supabase/migrations/`.

To create a new migration:

1. Create a new SQL file in `supabase/migrations/` with a sequential number:
   ```
   supabase/migrations/002_add_posts_table.sql
   ```

2. Write your SQL commands:
   ```sql
   CREATE TABLE posts (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     title VARCHAR(255) NOT NULL,
     content TEXT,
     author_id UUID REFERENCES users(id),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

### Applying Migrations

#### Using Supabase CLI (Recommended)

First, install the Supabase CLI:
- **Windows**: Download from [Supabase CLI Releases](https://github.com/supabase/cli/releases)
- **Mac**: `brew install supabase/tap/supabase`
- **Linux**: See [installation guide](https://supabase.com/docs/guides/cli/getting-started)

Then apply migrations:

```bash
# For staging
supabase db push --db-url "$STAGING_DATABASE_URL"

# For production
supabase db push --db-url "$PRODUCTION_DATABASE_URL"
```

#### Manual Application

Alternatively, you can run migrations manually:
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste your migration SQL
3. Execute the query

### Migration Best Practices

1. **Always test migrations on staging first**
2. **Keep migrations idempotent** (use `IF NOT EXISTS`, etc.)
3. **Version control all migrations** in the `supabase/migrations/` folder
4. **Document breaking changes** in migration files
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

| Variable | Development/Preview | Production |
|----------|-------------------|------------|
| `NEXT_PUBLIC_ENV` | `staging` | `production` |
| `STAGING_DATABASE_URL` | ✓ Set | ✓ Set |
| `PRODUCTION_DATABASE_URL` | Optional | ✓ Set |
| `NEXT_PUBLIC_SUPABASE_URL_*` | Use staging values | Use production values |

## Using Supabase in Code

### Client-Side Usage

```typescript
import { supabase } from '@/lib/supabase/client'

// Example: Fetch data
const { data, error } = await supabase
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })

// Example: Insert data
const { data, error } = await supabase
  .from('posts')
  .insert({ title: 'New Post', content: 'Content here' })
```

### Server-Side Usage (API Routes)

```typescript
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // Admin client bypasses RLS
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
  
  return Response.json({ data })
}
```

### Authentication

```typescript
import { supabase } from '@/lib/supabase/client'

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
})

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
})

// Sign out
await supabase.auth.signOut()
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
   console.log('Environment:', process.env.NEXT_PUBLIC_ENV)
   console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL_STAGING)
   ```

2. **Validate environment setup**:
   ```typescript
   import { validateEnvVars } from '@/lib/supabase/server'
   
   const { isValid, missing } = validateEnvVars()
   if (!isValid) {
     console.error('Missing env vars:', missing)
   }
   ```

3. **Test database connection**:
   ```typescript
   const { data, error } = await supabase
     .from('users')
     .select('count')
   
   if (error) console.error('Database error:', error)
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