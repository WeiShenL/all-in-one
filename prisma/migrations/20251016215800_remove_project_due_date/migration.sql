-- DropIndex
DROP INDEX IF EXISTS "project_dueDate_idx";

-- AlterTable
ALTER TABLE "project" DROP COLUMN IF EXISTS "dueDate";

-- CreateIndex
CREATE UNIQUE INDEX "project_name_key" ON "project"("name");
