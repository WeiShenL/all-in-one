-- Create function and trigger for syncing auth.users to UserProfile
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_namespace WHERE nspname = 'auth') THEN
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
      INSERT INTO public."user_profile" (id, email, name, role, "departmentId", "createdAt", "updatedAt")
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'STAFF')::public."UserRole",
        COALESCE(NEW.raw_user_meta_data->>'departmentId', 'default-dept-id'),
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
