-- CreateTable
CREATE TABLE "public"."project_collaborator" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_collaborator_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateIndex
CREATE INDEX "project_collaborator_userId_idx" ON "public"."project_collaborator"("userId");

-- CreateIndex
CREATE INDEX "project_collaborator_departmentId_idx" ON "public"."project_collaborator"("departmentId");

-- CreateIndex
CREATE INDEX "project_collaborator_projectId_departmentId_idx" ON "public"."project_collaborator"("projectId", "departmentId");

-- AddForeignKey
ALTER TABLE "public"."project_collaborator" ADD CONSTRAINT "project_collaborator_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_collaborator" ADD CONSTRAINT "project_collaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_collaborator" ADD CONSTRAINT "project_collaborator_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
