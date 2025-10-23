-- Data Migration Script: Populate ProjectCollaborator from existing TaskAssignments
--
-- This script migrates from department-level access (ProjectDepartmentAccess)
-- to user-level access (ProjectCollaborator) by:
-- 1. Finding all users who are assigned to tasks within projects
-- 2. Creating ProjectCollaborator entries for each unique (projectId, userId) pair
-- 3. Including the user's departmentId for department-level queries

-- Insert collaborators based on task assignments
-- Logic: If a user is assigned to any task in a project, they become a collaborator
INSERT INTO "public"."project_collaborator" ("projectId", "userId", "departmentId", "addedAt")
SELECT DISTINCT
    t."projectId",
    ta."userId",
    u."departmentId",
    NOW() as "addedAt"
FROM "public"."task_assignment" ta
INNER JOIN "public"."task" t ON ta."taskId" = t.id
INNER JOIN "public"."user_profile" u ON ta."userId" = u.id
WHERE t."projectId" IS NOT NULL  -- Only tasks that belong to a project
  AND t."isArchived" = false     -- Only active tasks
  AND u."isActive" = true         -- Only active users
ON CONFLICT ("projectId", "userId") DO NOTHING;  -- Skip duplicates

-- Verification query: Count how many collaborators were created
-- SELECT
--     COUNT(*) as total_collaborators,
--     COUNT(DISTINCT "projectId") as projects_with_collaborators,
--     COUNT(DISTINCT "userId") as unique_collaborators,
--     COUNT(DISTINCT "departmentId") as departments_involved
-- FROM "public"."project_collaborator";

-- Verification query: Show collaborators per project
-- SELECT
--     p.name as project_name,
--     COUNT(pc."userId") as collaborator_count,
--     COUNT(DISTINCT pc."departmentId") as department_count
-- FROM "public"."project_collaborator" pc
-- INNER JOIN "public"."project" p ON pc."projectId" = p.id
-- GROUP BY p.id, p.name
-- ORDER BY collaborator_count DESC;

