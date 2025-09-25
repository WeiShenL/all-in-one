#!/usr/bin/env node

/**
 * Migration Runner Script
 *
 * This script helps apply Prisma database migrations.
 * Environment is determined by .env configuration (comment/uncomment sections).
 * Usage: npm run db:migrate
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

async function runMigrations() {
  console.warn(`\n🚀 Prisma Migration Runner`);
  console.warn(`==========================\n`);
  console.warn(`Environment is determined by .env configuration`);
  console.warn(
    `Make sure to uncomment the correct environment section in .env\n`
  );

  // Using comment-based environment switching - DATABASE_URL contains active environment
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error(`❌ Error: DATABASE_URL not found in environment variables`);
    console.error(
      `Please ensure your .env file has the correct environment uncommented`
    );
    process.exit(1);
  }

  console.warn(`📍 Active DATABASE_URL detected`);
  console.warn(`📁 Migrations directory: prisma/migrations/`);

  // Check if migrations directory exists
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ Error: prisma/migrations/ directory not found');
    console.error(
      'Run `npx prisma migrate dev --name init` to create your first migration'
    );
    process.exit(1);
  }

  // List migration directories (Prisma creates folders for each migration)
  const migrationDirs = fs
    .readdirSync(migrationsDir)
    .filter(item => {
      const itemPath = path.join(migrationsDir, item);
      return fs.statSync(itemPath).isDirectory();
    })
    .sort();

  if (migrationDirs.length === 0) {
    console.warn('ℹ️  No migration files found');
    console.warn(
      'Run `npx prisma migrate dev --name your_migration_name` to create migrations'
    );
    process.exit(0);
  }

  console.warn(`\n📋 Found ${migrationDirs.length} migration(s):`);
  migrationDirs.forEach(dir => {
    console.warn(`   - ${dir}`);
  });

  // Check if this might be production by looking at the database URL
  if (dbUrl.includes('supabase.co') && !dbUrl.includes('localhost')) {
    console.warn(
      '\n⚠️  WARNING: Detected remote database URL (possible production)!'
    );
    console.warn(`Database: ${dbUrl.substring(0, 50)}...`);
    const confirm = await question('Type "yes" to continue: ');
    if (confirm.toLowerCase() !== 'yes') {
      console.warn('❌ Migration cancelled');
      process.exit(0);
    }
  }

  console.warn('\n🔄 Applying migrations...\n');

  // Check if Prisma CLI is installed
  try {
    execSync('npx prisma --version', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ Error: Prisma CLI not found. Details:', error.message);
    console.error('Please install Prisma: npm install prisma');
    process.exit(1);
  }

  // Apply migrations using Prisma
  try {
    const command = `npx prisma migrate deploy`;
    console.warn(`\n🔄 Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    console.warn('\n✅ Migrations applied successfully!');
  } catch (error) {
    console.error('\n❌ Error applying migrations:', error.message);
    process.exit(1);
  }

  rl.close();
}

// Handle uncaught errors
process.on('unhandledRejection', error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the script
runMigrations().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
