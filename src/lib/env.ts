import { z } from 'zod';

/**
 * Environment Variable Validation
 *
 * Validates all required environment variables at startup to fail fast
 * if configuration is missing or invalid.
 *
 * This prevents runtime errors and makes deployment issues immediately visible.
 */

const envSchema = z.object({
  // Node Environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Database Configuration (Required)
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid PostgreSQL connection string')
    .refine(
      url => url.startsWith('postgresql://'),
      'DATABASE_URL must be a PostgreSQL connection string'
    ),
  DIRECT_URL: z
    .string()
    .url('DIRECT_URL must be a valid PostgreSQL connection string')
    .refine(
      url => url.startsWith('postgresql://'),
      'DIRECT_URL must be a PostgreSQL connection string'
    ),

  // Supabase Configuration (Required)
  NEXT_PUBLIC_API_EXTERNAL_URL: z
    .string()
    .url('NEXT_PUBLIC_API_EXTERNAL_URL must be a valid URL'),
  NEXT_PUBLIC_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_ANON_KEY is required'),
  SERVICE_ROLE_KEY: z.string().min(1, 'SERVICE_ROLE_KEY is required'),

  // Site Configuration (Required)
  SITE_URL: z
    .string()
    .url('SITE_URL must be a valid URL')
    .default('http://localhost:3000'),

  // Cron Job Security (Required in Production)
  CRON_SECRET: z.string().optional(),

  // Email Configuration (Required for notifications)
  RESEND_API_KEY: z.string().optional(),
  RESEND_EMAIL_FROM: z.string().email().optional(),
  TEST_EMAIL_RECIPIENT: z.string().email().optional(),

  // Optional JWT Configuration
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRY: z.string().default('3600'),
});

/**
 * Additional validation rules based on environment
 */
const envWithRefinements = envSchema
  .refine(
    data => {
      // In production, CRON_SECRET must be set
      if (data.NODE_ENV === 'production' && !data.CRON_SECRET) {
        return false;
      }
      return true;
    },
    {
      message: 'CRON_SECRET is required in production environment',
      path: ['CRON_SECRET'],
    }
  )
  .refine(
    data => {
      // If RESEND_API_KEY is set, RESEND_EMAIL_FROM must also be set
      if (data.RESEND_API_KEY && !data.RESEND_EMAIL_FROM) {
        return false;
      }
      return true;
    },
    {
      message: 'RESEND_EMAIL_FROM is required when RESEND_API_KEY is set',
      path: ['RESEND_EMAIL_FROM'],
    }
  );

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns typed configuration
 * Throws detailed error if validation fails
 */
function validateEnv(): Env {
  const parsed = envWithRefinements.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    throw new Error(
      'Invalid environment variables. Check the console for details.'
    );
  }

  return parsed.data;
}

// Validate on module load (fail fast at startup)
export const env = validateEnv();

/**
 * Helper to check if we're in production
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * Helper to check if we're in development
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Helper to check if we're in test mode
 */
export const isTest = env.NODE_ENV === 'test';

/**
 * Usage:
 *
 * import { env } from '@/lib/env';
 *
 * // TypeScript will autocomplete and type-check
 * const dbUrl = env.DATABASE_URL;
 * const apiUrl = env.NEXT_PUBLIC_API_EXTERNAL_URL;
 */
