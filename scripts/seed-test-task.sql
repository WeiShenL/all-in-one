-- Test Data for File Upload Feature
-- Creates a test task assigned to user: userID
--
-- Usage in Supabase SQL Editor:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy and paste this entire script
-- 3. Click "Run" or press Ctrl+Enter

-- Create test task
INSERT INTO task (
  id,
  title,
  description,
  status,
  priority,
  "dueDate",
  "ownerId",
  "departmentId",
  "createdAt",
  "updatedAt"
)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  'Test Task for File Upload',
  'This is a test task for testing file upload functionality. Upload files to test the complete workflow.',
  'TO_DO',
  'MEDIUM',
  '2025-12-31T00:00:00.000Z',
  '75311644-d73e-4d9f-a941-1a729114d9fb',  -- user ID
  'dept-consultancy-001',  -- department ID
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  "updatedAt" = NOW();

-- Assign test user to the task
INSERT INTO task_assignment (
  "taskId",
  "userId",
  "assignedById",
  "assignedAt"
)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  '75311644-d73e-4d9f-a941-1a729114d9fb',  -- user ID
  '75311644-d73e-4d9f-a941-1a729114d9fb',  -- assigned by themselves (for testing)
  NOW()
)
ON CONFLICT ("taskId", "userId") DO UPDATE SET
  "assignedAt" = NOW();

-- Verify the created data
SELECT
  '✅ Created test task' as status,
  t.id as task_id,
  t.title,
  t.status,
  t.priority,
  u.name as owner_name,
  u.email as owner_email
FROM task t
JOIN user_profile u ON t."ownerId" = u.id
WHERE t.id = '123e4567-e89b-12d3-a456-426614174000';

SELECT
  '✅ Task assignment created' as status,
  ta."taskId" as task_id,
  u.name as assigned_user,
  u.email as user_email
FROM task_assignment ta
JOIN user_profile u ON ta."userId" = u.id
WHERE ta."taskId" = '123e4567-e89b-12d3-a456-426614174000';
