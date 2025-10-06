/*
  Warnings:

  - The `priority` column on the `project` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `priority` column on the `task` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."project" DROP COLUMN "priority",
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "public"."task" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurrenceDays" INTEGER,
DROP COLUMN "priority",
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 5;

-- DropEnum
DROP TYPE "public"."TaskPriority";