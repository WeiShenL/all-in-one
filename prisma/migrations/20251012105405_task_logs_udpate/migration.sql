/*
  Warnings:

  - The values [STATUS_CHANGED,COMMENT_ADDED,FILE_UPLOADED,ASSIGNMENT_CHANGED,DESCRIPTION_CHANGED] on the enum `LogAction` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `field` to the `task_log` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."LogAction_new" AS ENUM ('CREATED', 'UPDATED', 'ARCHIVED', 'UNARCHIVED', 'DELETED', 'RECURRING_TASK_GENERATED');
ALTER TABLE "public"."task_log" ALTER COLUMN "action" TYPE "public"."LogAction_new" USING ("action"::text::"public"."LogAction_new");
ALTER TYPE "public"."LogAction" RENAME TO "LogAction_old";
ALTER TYPE "public"."LogAction_new" RENAME TO "LogAction";
DROP TYPE "public"."LogAction_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."task_log" ADD COLUMN     "field" TEXT NOT NULL;
