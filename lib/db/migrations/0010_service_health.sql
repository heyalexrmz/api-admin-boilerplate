ALTER TYPE "public"."credit_ledger_reason" ADD VALUE IF NOT EXISTS 'ticket_refund' AFTER 'ticket_submission';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worker_heartbeat" (
  "worker_id" text PRIMARY KEY NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_status" (
  "mode" text PRIMARY KEY NOT NULL,
  "status" text NOT NULL,
  "components" text NOT NULL,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_override" (
  "mode" text NOT NULL,
  "component" text NOT NULL,
  "status" text NOT NULL,
  "reason" text NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "service_override_mode_component_pk" PRIMARY KEY("mode","component")
);
