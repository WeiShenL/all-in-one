-- AlterTable: Change priority from enum to integer for Task table
-- Map enum values: LOW->3, MEDIUM->5, HIGH->8 to preserve data
ALTER TABLE "public"."task"
  ALTER COLUMN "priority" DROP DEFAULT,
  ALTER COLUMN "priority" TYPE INTEGER USING (
    CASE priority
      WHEN 'LOW' THEN 3
      WHEN 'MEDIUM' THEN 5
      WHEN 'HIGH' THEN 8
      ELSE 5
    END
  ),
  ALTER COLUMN "priority" SET DEFAULT 5;

-- AlterTable: Change priority from enum to integer for Project table
ALTER TABLE "public"."project"
  ALTER COLUMN "priority" DROP DEFAULT,
  ALTER COLUMN "priority" TYPE INTEGER USING (
    CASE priority
      WHEN 'LOW' THEN 3
      WHEN 'MEDIUM' THEN 5
      WHEN 'HIGH' THEN 8
      ELSE 5
    END
  ),
  ALTER COLUMN "priority" SET DEFAULT 5;
