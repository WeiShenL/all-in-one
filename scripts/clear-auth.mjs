import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_API_EXTERNAL_URL;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('  - NEXT_PUBLIC_API_EXTERNAL_URL');
  if (!serviceRoleKey) console.error('  - SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

console.log('🧹 Clearing auth.users table...');

// List all users
const {
  data: { users },
  error: listError,
} = await supabase.auth.admin.listUsers();

if (listError) {
  console.error('❌ Failed to list users:', listError.message);
  process.exit(1);
}

if (!users || users.length === 0) {
  console.log('✅ No users to clear');
  process.exit(0);
}

console.log(`Found ${users.length} users to delete...`);

// Delete each user
let deletedCount = 0;
for (const user of users) {
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.warn(`⚠️  Failed to delete ${user.email}:`, deleteError.message);
  } else {
    deletedCount++;
  }
}

console.log(`✅ Cleared ${deletedCount}/${users.length} users from auth.users`);
