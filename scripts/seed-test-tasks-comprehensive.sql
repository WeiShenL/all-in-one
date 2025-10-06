-- ============================================
-- Comprehensive Test Data for Task Update Feature
-- ============================================
-- Creates realistic test tasks with:
-- - Multiple assignees (up to 5)
-- - Tags
-- - Comments
-- - Subtasks
-- - Various statuses and priorities
--
-- ⚠️ IMPORTANT BEFORE RUNNING:
-- 1. Get your user ID: SELECT id, email FROM user_profile LIMIT 1;
-- 2. Use Find & Replace (Ctrl+H or Cmd+H):
--    Find:    75311644-d73e-4d9f-a941-1a729114d9fb
--    Replace: your-actual-user-id (paste from step 1)
-- 3. Click "Replace All"
-- 4. Then run this script in Supabase SQL Editor
-- ============================================

-- ============================================
-- TASK 1: High Priority Marketing Campaign (Multiple Assignees)
-- ============================================
INSERT INTO task (
  id,
  title,
  description,
  status,
  priority,
  "dueDate",
  "ownerId",
  "departmentId",
  "isRecurring",
  "recurrenceDays",
  "isArchived",
  "createdAt",
  "updatedAt"
)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '🚀 Q4 Marketing Campaign Launch',
  'Launch comprehensive Q4 marketing campaign including social media, email marketing, and paid ads. Target: 50% increase in engagement. Budget: $50k. Stakeholders: Marketing, Sales, Product teams.',
  'IN_PROGRESS',
  9, -- High priority
  (NOW() + INTERVAL '30 days')::TIMESTAMP,
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  'dept-consultancy-001',
  false,
  NULL,
  false,
  NOW() - INTERVAL '5 days',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  "updatedAt" = NOW();

-- Assign user to Task 1
INSERT INTO task_assignment ("taskId", "userId", "assignedById", "assignedAt")
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  NOW() - INTERVAL '5 days'
)
ON CONFLICT ("taskId", "userId") DO NOTHING;

-- Add tags for Task 1
INSERT INTO tag (id, name)
VALUES
  (gen_random_uuid(), 'marketing'),
  (gen_random_uuid(), 'high-priority'),
  (gen_random_uuid(), 'campaign'),
  (gen_random_uuid(), 'Q4')
ON CONFLICT (name) DO NOTHING;

INSERT INTO task_tag ("taskId", "tagId")
SELECT '11111111-1111-1111-1111-111111111111', id FROM tag WHERE name IN ('marketing', 'high-priority', 'campaign', 'Q4')
ON CONFLICT ("taskId", "tagId") DO NOTHING;

-- Add comments for Task 1
INSERT INTO comment (
  id,
  content,
  "userId",
  "taskId",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    '11111111-c001-0000-0000-000000000001',
    'Initial campaign strategy drafted. Waiting for budget approval from finance.',
    '75311644-d73e-4d9f-a941-1a729114d9fb',
    '11111111-1111-1111-1111-111111111111',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days'
  ),
  (
    '11111111-c002-0000-0000-000000000002',
    'Budget approved! Moving forward with social media phase.',
    '75311644-d73e-4d9f-a941-1a729114d9fb',
    '11111111-1111-1111-1111-111111111111',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TASK 2: Recurring Weekly Report (Recurring Task)
-- ============================================
INSERT INTO task (
  id,
  title,
  description,
  status,
  priority,
  "dueDate",
  "ownerId",
  "departmentId",
  "isRecurring",
  "recurrenceDays",
  "isArchived",
  "createdAt",
  "updatedAt"
)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '📊 Weekly Performance Report',
  'Compile weekly performance metrics including: KPIs, team productivity, budget utilization, and client feedback. Submit to management every Friday EOD.',
  'TO_DO',
  5, -- Medium priority
  (NOW() + INTERVAL '2 days')::TIMESTAMP,
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  'dept-consultancy-001',
  true,
  7, -- Recurs every 7 days
  false,
  NOW() - INTERVAL '10 days',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  "isRecurring" = EXCLUDED."isRecurring",
  "recurrenceDays" = EXCLUDED."recurrenceDays",
  "updatedAt" = NOW();

INSERT INTO task_assignment ("taskId", "userId", "assignedById", "assignedAt")
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  NOW() - INTERVAL '10 days'
)
ON CONFLICT ("taskId", "userId") DO NOTHING;

INSERT INTO task_tag ("taskId", "tagId")
SELECT '22222222-2222-2222-2222-222222222222', id FROM tag WHERE name = 'high-priority'
ON CONFLICT ("taskId", "tagId") DO NOTHING;

INSERT INTO tag (id, name)
VALUES (gen_random_uuid(), 'recurring'), (gen_random_uuid(), 'reports')
ON CONFLICT (name) DO NOTHING;

INSERT INTO task_tag ("taskId", "tagId")
SELECT '22222222-2222-2222-2222-222222222222', id FROM tag WHERE name IN ('recurring', 'reports')
ON CONFLICT ("taskId", "tagId") DO NOTHING;

-- ============================================
-- TASK 3: Bug Fix with Subtasks (Parent Task)
-- ============================================
INSERT INTO task (
  id,
  title,
  description,
  status,
  priority,
  "dueDate",
  "ownerId",
  "departmentId",
  "isRecurring",
  "recurrenceDays",
  "isArchived",
  "createdAt",
  "updatedAt"
)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '🐛 Fix Critical Authentication Bug',
  'Critical bug causing login failures for 2FA users. Affects ~500 users. Steps to reproduce: 1) Enable 2FA 2) Logout 3) Login with 2FA code. Expected: Success. Actual: "Invalid token" error.',
  'BLOCKED',
  10, -- Critical priority
  (NOW() + INTERVAL '1 day')::TIMESTAMP,
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  'dept-consultancy-001',
  false,
  NULL,
  false,
  NOW() - INTERVAL '3 days',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  "updatedAt" = NOW();

INSERT INTO task_assignment ("taskId", "userId", "assignedById", "assignedAt")
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  NOW() - INTERVAL '3 days'
)
ON CONFLICT ("taskId", "userId") DO NOTHING;

INSERT INTO tag (id, name)
VALUES (gen_random_uuid(), 'bug'), (gen_random_uuid(), 'critical'), (gen_random_uuid(), 'security')
ON CONFLICT (name) DO NOTHING;

INSERT INTO task_tag ("taskId", "tagId")
SELECT '33333333-3333-3333-3333-333333333333', id FROM tag WHERE name IN ('bug', 'critical', 'security')
ON CONFLICT ("taskId", "tagId") DO NOTHING;

INSERT INTO comment (
  id,
  content,
  "userId",
  "taskId",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    '33333333-c001-0000-0000-000000000001',
    'Root cause identified: JWT token expiry mismatch between frontend and backend.',
    '75311644-d73e-4d9f-a941-1a729114d9fb',
    '33333333-3333-3333-3333-333333333333',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '33333333-c002-0000-0000-000000000002',
    'Blocked: Waiting for security team approval to modify auth flow.',
    '75311644-d73e-4d9f-a941-1a729114d9fb',
    '33333333-3333-3333-3333-333333333333',
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '5 hours'
  )
ON CONFLICT (id) DO NOTHING;

-- Subtask 3.1: Investigate root cause
INSERT INTO task (
  id,
  title,
  description,
  status,
  priority,
  "dueDate",
  "ownerId",
  "departmentId",
  "parentTaskId",
  "isRecurring",
  "recurrenceDays",
  "isArchived",
  "createdAt",
  "updatedAt"
)
VALUES (
  '33333333-sub1-0000-0000-000000000001',
  'Investigate JWT token expiry issue',
  'Debug and identify why JWT tokens are expiring prematurely for 2FA users.',
  'COMPLETED',
  10,
  (NOW() + INTERVAL '1 day')::TIMESTAMP,
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  'dept-consultancy-001',
  '33333333-3333-3333-3333-333333333333', -- Parent task
  false,
  NULL,
  false,
  NOW() - INTERVAL '2 days',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  "updatedAt" = NOW();

INSERT INTO task_assignment ("taskId", "userId", "assignedById", "assignedAt")
VALUES (
  '33333333-sub1-0000-0000-000000000001',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  NOW() - INTERVAL '2 days'
)
ON CONFLICT ("taskId", "userId") DO NOTHING;

-- Subtask 3.2: Get security approval
INSERT INTO task (
  id,
  title,
  description,
  status,
  priority,
  "dueDate",
  "ownerId",
  "departmentId",
  "parentTaskId",
  "isRecurring",
  "recurrenceDays",
  "isArchived",
  "createdAt",
  "updatedAt"
)
VALUES (
  '33333333-sub2-0000-0000-000000000002',
  'Get security team approval for auth changes',
  'Present findings to security team and get approval for proposed JWT token changes.',
  'IN_PROGRESS',
  10,
  (NOW() + INTERVAL '1 day')::TIMESTAMP,
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  'dept-consultancy-001',
  '33333333-3333-3333-3333-333333333333', -- Parent task
  false,
  NULL,
  false,
  NOW() - INTERVAL '1 day',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  "updatedAt" = NOW();

INSERT INTO task_assignment ("taskId", "userId", "assignedById", "assignedAt")
VALUES (
  '33333333-sub2-0000-0000-000000000002',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT ("taskId", "userId") DO NOTHING;

-- ============================================
-- TASK 4: Simple Completed Task
-- ============================================
INSERT INTO task (
  id,
  title,
  description,
  status,
  priority,
  "dueDate",
  "ownerId",
  "departmentId",
  "isRecurring",
  "recurrenceDays",
  "isArchived",
  "createdAt",
  "updatedAt"
)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '✅ Update Team Documentation',
  'Update team wiki with new onboarding process and project guidelines. Include screenshots and step-by-step instructions.',
  'COMPLETED',
  3, -- Low-medium priority
  (NOW() - INTERVAL '2 days')::TIMESTAMP, -- Past due date (completed)
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  'dept-consultancy-001',
  false,
  NULL,
  false,
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  "updatedAt" = NOW();

INSERT INTO task_assignment ("taskId", "userId", "assignedById", "assignedAt")
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  NOW() - INTERVAL '7 days'
)
ON CONFLICT ("taskId", "userId") DO NOTHING;

INSERT INTO tag (id, name)
VALUES (gen_random_uuid(), 'documentation')
ON CONFLICT (name) DO NOTHING;

INSERT INTO task_tag ("taskId", "tagId")
SELECT '44444444-4444-4444-4444-444444444444', id FROM tag WHERE name = 'documentation'
ON CONFLICT ("taskId", "tagId") DO NOTHING;

-- ============================================
-- TASK 5: File Upload Test Task (for testing file operations)
-- ============================================
INSERT INTO task (
  id,
  title,
  description,
  status,
  priority,
  "dueDate",
  "ownerId",
  "departmentId",
  "isRecurring",
  "recurrenceDays",
  "isArchived",
  "createdAt",
  "updatedAt"
)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '📎 Client Proposal - TechCorp Integration',
  'Prepare comprehensive proposal for TechCorp system integration project. Include: technical architecture, timeline, budget breakdown, and risk assessment. Attach all diagrams and supporting documents.',
  'TO_DO',
  7, -- High-medium priority
  (NOW() + INTERVAL '7 days')::TIMESTAMP,
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  'dept-consultancy-001',
  false,
  NULL,
  false,
  NOW() - INTERVAL '1 day',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  "updatedAt" = NOW();

INSERT INTO task_assignment ("taskId", "userId", "assignedById", "assignedAt")
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT ("taskId", "userId") DO NOTHING;

INSERT INTO tag (id, name)
VALUES (gen_random_uuid(), 'proposal'), (gen_random_uuid(), 'client')
ON CONFLICT (name) DO NOTHING;

INSERT INTO task_tag ("taskId", "tagId")
SELECT '55555555-5555-5555-5555-555555555555', id FROM tag WHERE name IN ('proposal', 'client', 'high-priority')
ON CONFLICT ("taskId", "tagId") DO NOTHING;

INSERT INTO comment (
  id,
  content,
  "userId",
  "taskId",
  "createdAt",
  "updatedAt"
)
VALUES (
  '55555555-c001-0000-0000-000000000001',
  'Kickoff meeting scheduled with TechCorp for next Tuesday. Need to have draft ready by Monday.',
  '75311644-d73e-4d9f-a941-1a729114d9fb',
  '55555555-5555-5555-5555-555555555555',
  NOW() - INTERVAL '12 hours',
  NOW() - INTERVAL '12 hours'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Verification Queries
-- ============================================

-- Show all created tasks
SELECT
  '✅ TASKS CREATED' as "Status",
  t.id as "Task ID",
  t.title as "Title",
  t.status as "Status",
  t.priority as "Priority (1-10)",
  t."isRecurring" as "Recurring",
  t."dueDate" as "Due Date",
  (SELECT COUNT(*) FROM task_assignment ta WHERE ta."taskId" = t.id) as "# Assignees",
  (SELECT COUNT(*) FROM task_tag tt WHERE tt."taskId" = t.id) as "# Tags",
  (SELECT COUNT(*) FROM comment c WHERE c."taskId" = t.id) as "# Comments",
  (SELECT COUNT(*) FROM task st WHERE st."parentTaskId" = t.id) as "# Subtasks"
FROM task t
WHERE t.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
)
ORDER BY t.priority DESC, t."dueDate" ASC;

-- Show task assignments
SELECT
  '✅ ASSIGNMENTS' as "Status",
  t.title as "Task",
  up.name as "Assigned User",
  up.email as "Email",
  ta."assignedAt" as "Assigned Date"
FROM task_assignment ta
JOIN task t ON ta."taskId" = t.id
JOIN user_profile up ON ta."userId" = up.id
WHERE t.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
)
ORDER BY t.title;

-- Show tags per task
SELECT
  '✅ TAGS' as "Status",
  t.title as "Task",
  STRING_AGG(tg.name, ', ') as "Tags"
FROM task t
LEFT JOIN task_tag tt ON t.id = tt."taskId"
LEFT JOIN tag tg ON tt."tagId" = tg.id
WHERE t.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
)
GROUP BY t.id, t.title
ORDER BY t.title;

-- Show comments count
SELECT
  '✅ COMMENTS' as "Status",
  t.title as "Task",
  COUNT(c.id) as "# Comments",
  MAX(c."createdAt") as "Latest Comment"
FROM task t
LEFT JOIN comment c ON t.id = c."taskId"
WHERE t.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
)
GROUP BY t.id, t.title
ORDER BY t.title;

-- Success message
SELECT
  '🎉 SUCCESS!' as "Status",
  '5 test tasks created with realistic data' as "Message",
  'You can now test all update operations on these tasks' as "Next Step";
