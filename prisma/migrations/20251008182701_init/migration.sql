/*
  Warnings:

  - You are about to drop the column `isRecurring` on the `task` table. All the data in the column will be lost.
  - You are about to drop the column `recurrenceDays` on the `task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."task" DROP COLUMN "isRecurring",
DROP COLUMN "recurrenceDays";
