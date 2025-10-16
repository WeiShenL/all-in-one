/*
  Warnings:

  - Made the column `name` on table `user_profile` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."user_profile" ADD COLUMN     "isHrAdmin" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "name" SET NOT NULL;

-- Update the trigger function to handle isHrAdmin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $func$
BEGIN
  -- Note: departmentId is required but we need a default department
  -- First ensure a default department exists
  INSERT INTO public."department" (id, name, "isActive", "createdAt", "updatedAt")
  VALUES (
    'default-dept-id',
    'Default Department',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert new user profile
  INSERT INTO public."user_profile" (id, email, name, role, "departmentId", "isHrAdmin", "createdAt", "updatedAt")
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'STAFF')::public."UserRole",
    COALESCE(NEW.raw_user_meta_data->>'departmentId', 'default-dept-id'),
    COALESCE((NEW.raw_user_meta_data->>'isHrAdmin')::boolean, false),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
