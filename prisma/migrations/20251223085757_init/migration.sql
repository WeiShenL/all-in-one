-- CreateIndex
CREATE INDEX "task_isArchived_departmentId_idx" ON "task"("isArchived", "departmentId");

-- CreateIndex
CREATE INDEX "task_isArchived_status_idx" ON "task"("isArchived", "status");

-- CreateIndex
CREATE INDEX "task_departmentId_status_isArchived_idx" ON "task"("departmentId", "status", "isArchived");

-- CreateIndex
CREATE INDEX "task_isArchived_dueDate_idx" ON "task"("isArchived", "dueDate");

-- CreateIndex
CREATE INDEX "task_assignment_userId_idx" ON "task_assignment"("userId");

-- CreateIndex
CREATE INDEX "task_assignment_userId_taskId_idx" ON "task_assignment"("userId", "taskId");
