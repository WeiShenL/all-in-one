-- CreateIndex
CREATE INDEX "task_isArchived_parentTaskId_departmentId_idx" ON "task"("isArchived", "parentTaskId", "departmentId");

-- CreateIndex
CREATE INDEX "task_parentTaskId_isArchived_status_idx" ON "task"("parentTaskId", "isArchived", "status");

-- CreateIndex
CREATE INDEX "task_projectId_isArchived_status_idx" ON "task"("projectId", "isArchived", "status");
