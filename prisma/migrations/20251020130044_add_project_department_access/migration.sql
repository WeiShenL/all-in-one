-- CreateTable
CREATE TABLE "public"."project_department_access" (
    "projectId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_department_access_pkey" PRIMARY KEY ("projectId","departmentId")
);

-- CreateIndex
CREATE INDEX "project_department_access_departmentId_idx" ON "public"."project_department_access"("departmentId");

-- AddForeignKey
ALTER TABLE "public"."project_department_access" ADD CONSTRAINT "project_department_access_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_department_access" ADD CONSTRAINT "project_department_access_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
