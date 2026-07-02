
-- 1. Add 'admin' to enum (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'admin') THEN
    ALTER TYPE public.app_role ADD VALUE 'admin';
  END IF;
END $$;
