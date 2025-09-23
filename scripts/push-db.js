import { exec } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const env = process.argv[2]; // 'staging' or 'production'
if (!env) {
  console.error('Please specify an environment: staging or production');
  process.exit(1);
}

const dbUrl =
  env === 'staging'
    ? process.env.STAGING_DATABASE_URL
    : process.env.PRODUCTION_DATABASE_URL;

if (!dbUrl || dbUrl.includes('[YOUR-PASSWORD]')) {
  console.error(
    `Database URL for ${env} is not correctly configured in .env.local`
  );
  process.exit(1);
}

const command = `npx supabase db push --db-url "${dbUrl}"`;

console.warn(`Executing: ${command}`);

const child = exec(command);

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

child.on('close', code => {
  console.warn(`Child process exited with code ${code}`);
  process.exit(code);
});
