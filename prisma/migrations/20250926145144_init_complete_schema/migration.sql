-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('STAFF', 'MANAGER', 'HR_ADMIN');

-- CreateEnum
CREATE TYPE "public"."TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('TO_DO', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('TASK_ASSIGNED', 'TASK_UPDATED', 'COMMENT_ADDED', 'DEADLINE_REMINDER', 'TASK_OVERDUE', 'TASK_DELETED', 'TASK_REASSIGNED');

-- CreateEnum
CREATE TYPE "public"."LogAction" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'COMMENT_ADDED', 'FILE_UPLOADED', 'ASSIGNMENT_CHANGED', 'DESCRIPTION_CHANGED', 'ARCHIVED', 'DELETED');

-- CreateTable
CREATE TABLE "public"."department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_profile" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'STAFF',
    "departmentId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT NOT NULL,
    "leaderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team_member" (
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("teamId","userId")
);

-- CreateTable
CREATE TABLE "public"."project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" "public"."TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "status" "public"."ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "departmentId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "public"."TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'TO_DO',
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT,
    "departmentId" TEXT NOT NULL,
    "parentTaskId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_assignment" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignment_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "public"."comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_file" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_tag" (
    "taskId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "task_tag_pkey" PRIMARY KEY ("taskId","tagId")
);

-- CreateTable
CREATE TABLE "public"."task_log" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "public"."LogAction" NOT NULL,
    "changes" JSONB,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "taskId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."calendar_event" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_parentId_idx" ON "public"."department"("parentId");

-- CreateIndex
CREATE INDEX "department_managerId_idx" ON "public"."department"("managerId");

-- CreateIndex
CREATE INDEX "department_isActive_idx" ON "public"."department"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_email_key" ON "public"."user_profile"("email");

-- CreateIndex
CREATE INDEX "user_profile_email_idx" ON "public"."user_profile"("email");

-- CreateIndex
CREATE INDEX "user_profile_role_idx" ON "public"."user_profile"("role");

-- CreateIndex
CREATE INDEX "user_profile_departmentId_idx" ON "public"."user_profile"("departmentId");

-- CreateIndex
CREATE INDEX "user_profile_isActive_idx" ON "public"."user_profile"("isActive");

-- CreateIndex
CREATE INDEX "team_departmentId_idx" ON "public"."team"("departmentId");

-- CreateIndex
CREATE INDEX "team_leaderId_idx" ON "public"."team"("leaderId");

-- CreateIndex
CREATE INDEX "team_isActive_idx" ON "public"."team"("isActive");

-- CreateIndex
CREATE INDEX "project_departmentId_idx" ON "public"."project"("departmentId");

-- CreateIndex
CREATE INDEX "project_creatorId_idx" ON "public"."project"("creatorId");

-- CreateIndex
CREATE INDEX "project_status_idx" ON "public"."project"("status");

-- CreateIndex
CREATE INDEX "project_isArchived_idx" ON "public"."project"("isArchived");

-- CreateIndex
CREATE INDEX "project_dueDate_idx" ON "public"."project"("dueDate");

-- CreateIndex
CREATE INDEX "task_ownerId_idx" ON "public"."task"("ownerId");

-- CreateIndex
CREATE INDEX "task_projectId_idx" ON "public"."task"("projectId");

-- CreateIndex
CREATE INDEX "task_departmentId_idx" ON "public"."task"("departmentId");

-- CreateIndex
CREATE INDEX "task_parentTaskId_idx" ON "public"."task"("parentTaskId");

-- CreateIndex
CREATE INDEX "task_status_idx" ON "public"."task"("status");

-- CreateIndex
CREATE INDEX "task_dueDate_idx" ON "public"."task"("dueDate");

-- CreateIndex
CREATE INDEX "task_isArchived_idx" ON "public"."task"("isArchived");

-- CreateIndex
CREATE INDEX "task_createdAt_idx" ON "public"."task"("createdAt");

-- CreateIndex
CREATE INDEX "task_assignment_assignedById_idx" ON "public"."task_assignment"("assignedById");

-- CreateIndex
CREATE INDEX "comment_taskId_idx" ON "public"."comment"("taskId");

-- CreateIndex
CREATE INDEX "comment_userId_idx" ON "public"."comment"("userId");

-- CreateIndex
CREATE INDEX "comment_createdAt_idx" ON "public"."comment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "task_file_storagePath_key" ON "public"."task_file"("storagePath");

-- CreateIndex
CREATE INDEX "task_file_taskId_idx" ON "public"."task_file"("taskId");

-- CreateIndex
CREATE INDEX "task_file_uploadedById_idx" ON "public"."task_file"("uploadedById");

-- CreateIndex
CREATE INDEX "task_file_uploadedAt_idx" ON "public"."task_file"("uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tag_name_key" ON "public"."tag"("name");

-- CreateIndex
CREATE INDEX "task_log_taskId_idx" ON "public"."task_log"("taskId");

-- CreateIndex
CREATE INDEX "task_log_userId_idx" ON "public"."task_log"("userId");

-- CreateIndex
CREATE INDEX "task_log_timestamp_idx" ON "public"."task_log"("timestamp");

-- CreateIndex
CREATE INDEX "task_log_action_idx" ON "public"."task_log"("action");

-- CreateIndex
CREATE INDEX "notification_userId_idx" ON "public"."notification"("userId");

-- CreateIndex
CREATE INDEX "notification_isRead_idx" ON "public"."notification"("isRead");

-- CreateIndex
CREATE INDEX "notification_createdAt_idx" ON "public"."notification"("createdAt");

-- CreateIndex
CREATE INDEX "notification_type_idx" ON "public"."notification"("type");

-- CreateIndex
CREATE INDEX "notification_taskId_idx" ON "public"."notification"("taskId");

-- CreateIndex
CREATE INDEX "calendar_event_userId_idx" ON "public"."calendar_event"("userId");

-- CreateIndex
CREATE INDEX "calendar_event_eventDate_idx" ON "public"."calendar_event"("eventDate");

-- CreateIndex
CREATE INDEX "calendar_event_taskId_idx" ON "public"."calendar_event"("taskId");

-- CreateIndex
CREATE INDEX "calendar_event_isCompleted_idx" ON "public"."calendar_event"("isCompleted");

-- AddForeignKey
ALTER TABLE "public"."department" ADD CONSTRAINT "department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department" ADD CONSTRAINT "department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_profile" ADD CONSTRAINT "user_profile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team" ADD CONSTRAINT "team_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team" ADD CONSTRAINT "team_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "public"."user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member" ADD CONSTRAINT "team_member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member" ADD CONSTRAINT "team_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project" ADD CONSTRAINT "project_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project" ADD CONSTRAINT "project_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "public"."user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task" ADD CONSTRAINT "task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task" ADD CONSTRAINT "task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task" ADD CONSTRAINT "task_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task" ADD CONSTRAINT "task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "public"."task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_assignment" ADD CONSTRAINT "task_assignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_assignment" ADD CONSTRAINT "task_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_assignment" ADD CONSTRAINT "task_assignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "public"."user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comment" ADD CONSTRAINT "comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comment" ADD CONSTRAINT "comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_file" ADD CONSTRAINT "task_file_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_file" ADD CONSTRAINT "task_file_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_tag" ADD CONSTRAINT "task_tag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_tag" ADD CONSTRAINT "task_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_log" ADD CONSTRAINT "task_log_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_log" ADD CONSTRAINT "task_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification" ADD CONSTRAINT "notification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."calendar_event" ADD CONSTRAINT "calendar_event_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."calendar_event" ADD CONSTRAINT "calendar_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
