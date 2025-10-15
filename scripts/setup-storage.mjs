import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
import dotenv from 'dotenv';

const { Client } = pkg;

// Load environment variables from .env
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_API_EXTERNAL_URL;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY; // Admin key
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !serviceRoleKey || !databaseUrl) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) {
    console.error('  - NEXT_PUBLIC_API_EXTERNAL_URL');
  }
  if (!serviceRoleKey) {
    console.error('  - SERVICE_ROLE_KEY');
  }
  if (!databaseUrl) {
    console.error('  - DATABASE_URL');
  }
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setupStorage() {
  console.warn('🔧 Setting up storage bucket...');

  // 1. Create bucket via API
  const { data: bucket, error: bucketError } =
    await supabase.storage.createBucket('task-attachments', {
      public: false,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: [
        'image/*',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'application/zip',
      ],
    });

  if (bucketError && !bucketError.message.includes('already exists')) {
    throw bucketError;
  }

  console.warn('✅ Bucket ready:', bucket || 'already exists');

  // 2. Create policies via direct SQL connection
  console.warn('🔧 Creating RLS policies...');

  const pgClient = new Client({ connectionString: databaseUrl });
  await pgClient.connect();

  try {
    await pgClient.query(`
      DROP POLICY IF EXISTS "Users can upload to assigned tasks" ON storage.objects;
      DROP POLICY IF EXISTS "Users can view files from assigned tasks" ON storage.objects;
      DROP POLICY IF EXISTS "Users can delete their own uploaded files" ON storage.objects;

      CREATE POLICY "Users can upload to assigned tasks"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'task-attachments'
        AND (storage.foldername(name))[1] IN (
          SELECT t.id FROM task t
          INNER JOIN task_assignment ta ON ta."taskId" = t.id
          WHERE ta."userId" = auth.uid()::text
        )
      );

      CREATE POLICY "Users can view files from assigned tasks"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'task-attachments'
        AND (storage.foldername(name))[1] IN (
          SELECT t.id FROM task t
          INNER JOIN task_assignment ta ON ta."taskId" = t.id
          WHERE ta."userId" = auth.uid()::text
        )
      );

      CREATE POLICY "Users can delete their own uploaded files"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'task-attachments' AND owner = auth.uid());
    `);

    console.warn('✅ Policies created successfully');
  } finally {
    await pgClient.end();
  }
}

setupStorage()
  .then(() => console.warn('✅ Storage setup complete'))
  .catch(err => {
    console.error('❌ Setup failed:', err);
    process.exit(1);
  });
