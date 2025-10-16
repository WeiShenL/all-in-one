-- AlterTable
ALTER TABLE "public"."task" ADD COLUMN     "startDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "task_startDate_idx" ON "public"."task"("startDate");
