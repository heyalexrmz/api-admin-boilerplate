ALTER TYPE "public"."job_type" ADD VALUE IF NOT EXISTS 'expire_ticket';--> statement-breakpoint
ALTER TABLE "webhook_event_log" ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamp with time zone;--> statement-breakpoint
