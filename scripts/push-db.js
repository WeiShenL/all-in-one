/**
 * Database Push Script
 *
 * This script pushes Prisma schema directly to database.
 * Environment is determined by .env configuration (comment/uncomment sections).
 * Usage: npm run db:push
 */

import { exec } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

// Environment is determined by which section is uncommented in .env
console.warn(
  'Environment is determined by .env configuration (comment/uncomment sections)'
);
console.warn(
  'Make sure to uncomment the correct environment section in .env\n'
);

// Since we use comment-based switching, DATABASE_URL contains the active environment
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl || dbUrl.includes('[YOUR-PASSWORD]')) {
  console.error(
    `DATABASE_URL is not correctly configured in .env. Make sure to uncomment the appropriate environment section.`
  );
  process.exit(1);
}

const command = `npx prisma migrate deploy`;

console.warn(`Executing: ${command}`);

const child = exec(command);

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

child.on('close', code => {
  console.warn(`Child process exited with code ${code}`);
  process.exit(code);
});
