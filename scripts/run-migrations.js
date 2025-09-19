#!/usr/bin/env node

/**
 * Migration Runner Script
 * 
 * This script helps apply database migrations to Supabase projects.
 * Usage: npm run migrate:staging or npm run migrate:production
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

async function runMigrations() {
  const environment = process.argv[2] || 'staging';
  
  console.log(`\n🚀 Database Migration Runner`);
  console.log(`===========================\n`);
  
  // Determine which database URL to use
  const dbUrlKey = environment === 'production' 
    ? 'PRODUCTION_DATABASE_URL' 
    : 'STAGING_DATABASE_URL';
  
  const dbUrl = process.env[dbUrlKey];
  
  if (!dbUrl) {
    console.error(`❌ Error: ${dbUrlKey} not found in environment variables`);
    console.error(`Please ensure your .env.local file contains ${dbUrlKey}`);
    process.exit(1);
  }
  
  console.log(`📍 Target environment: ${environment.toUpperCase()}`);
  console.log(`📁 Migrations directory: supabase/migrations/`);
  
  // Check if migrations directory exists
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ Error: supabase/migrations/ directory not found');
    process.exit(1);
  }
  
  // List migration files
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  if (migrationFiles.length === 0) {
    console.log('ℹ️  No migration files found');
    process.exit(0);
  }
  
  console.log(`\n📋 Found ${migrationFiles.length} migration file(s):`);
  migrationFiles.forEach(file => {
    console.log(`   - ${file}`);
  });
  
  // Confirm before applying to production
  if (environment === 'production') {
    console.log('\n⚠️  WARNING: You are about to apply migrations to PRODUCTION!');
    const confirm = await question('Type "yes" to continue: ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ Migration cancelled');
      process.exit(0);
    }
  }
  
  console.log('\n🔄 Applying migrations...\n');
  
  // Check if supabase CLI is installed
  try {
    execSync('supabase --version', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ Error: Supabase CLI not found');
    console.error('Please install it from: https://github.com/supabase/cli#install-the-cli');
    process.exit(1);
  }
  
  // Apply migrations using Supabase CLI
  try {
    const command = `supabase db push --db-url "${dbUrl}"`;
    execSync(command, { stdio: 'inherit' });
    console.log('\n✅ Migrations applied successfully!');
  } catch (error) {
    console.error('\n❌ Error applying migrations:', error.message);
    process.exit(1);
  }
  
  rl.close();
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the script
runMigrations().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});