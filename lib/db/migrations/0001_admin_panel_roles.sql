DO $$ BEGIN
  CREATE TYPE "public"."platform_role" AS ENUM('user', 'superadmin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "platform_role" "platform_role" DEFAULT 'user' NOT NULL;
