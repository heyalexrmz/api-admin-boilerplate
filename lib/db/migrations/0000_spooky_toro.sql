DO $$ BEGIN
  CREATE TYPE "public"."api_key_mode" AS ENUM('live', 'test');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."document_kind" AS ENUM('ticket_image', 'csf_pdf', 'invoice_pdf', 'invoice_xml', 'supporting_document');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."document_status" AS ENUM('pending', 'stored', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'finalized', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."job_type" AS ENUM('submit_ticket', 'refresh_ticket', 'redeliver_ticket', 'dispatch_webhook');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."taxpayer_status" AS ENUM('active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."ticket_status" AS ENUM('received', 'queued', 'processing', 'finalized', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."usage_metric" AS ENUM('tickets_submitted', 'documents_stored', 'deliveries_sent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

ALTER TABLE "api_key" ADD COLUMN IF NOT EXISTS "mode" "api_key_mode" DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "request_log" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook" ALTER COLUMN "created_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook" ADD COLUMN IF NOT EXISTS "created_by_api_key_id" uuid;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "plan" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "monthly_ticket_quota" integer,
  "monthly_document_quota" integer,
  "rate_limit_per_minute" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "plan_name_unique" UNIQUE("name")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "taxpayer" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL REFERENCES "public"."organization"("id") ON DELETE cascade,
  "rfc" text NOT NULL,
  "legal_name" text,
  "display_name" text,
  "status" "taxpayer_status" DEFAULT 'active' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ticket" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL REFERENCES "public"."organization"("id") ON DELETE cascade,
  "taxpayer_id" uuid NOT NULL REFERENCES "public"."taxpayer"("id") ON DELETE restrict,
  "idempotency_key" text,
  "provider" text,
  "provider_request_id" text,
  "mode" text DEFAULT 'live' NOT NULL,
  "status" "ticket_status" DEFAULT 'received' NOT NULL,
  "status_rank" integer DEFAULT 0 NOT NULL,
  "original_file_name" text,
  "error_code" text,
  "error_type" text,
  "error_message" text,
  "submit_request" jsonb,
  "last_response" jsonb,
  "upstream_raw" jsonb,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processing_started_at" timestamp with time zone,
  "finalized_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL REFERENCES "public"."organization"("id") ON DELETE cascade,
  "taxpayer_id" uuid REFERENCES "public"."taxpayer"("id") ON DELETE set null,
  "kind" "document_kind" NOT NULL,
  "status" "document_status" DEFAULT 'pending' NOT NULL,
  "original_file_name" text NOT NULL,
  "content_type" text NOT NULL,
  "bytes" integer,
  "checksum_sha256" text,
  "storage_bucket" text NOT NULL,
  "storage_key" text NOT NULL,
  "source_url" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "invoice" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL REFERENCES "public"."organization"("id") ON DELETE cascade,
  "taxpayer_id" uuid NOT NULL REFERENCES "public"."taxpayer"("id") ON DELETE restrict,
  "ticket_id" uuid NOT NULL REFERENCES "public"."ticket"("id") ON DELETE cascade,
  "status" "invoice_status" DEFAULT 'pending' NOT NULL,
  "sat_uuid" text,
  "series" text,
  "folio" text,
  "issuer_taxpayer" text,
  "issuer_rfc" text,
  "total" numeric(14, 2),
  "invoice_date" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ticket_document" (
  "ticket_id" uuid NOT NULL REFERENCES "public"."ticket"("id") ON DELETE cascade,
  "document_id" uuid NOT NULL REFERENCES "public"."document"("id") ON DELETE cascade,
  "role" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "invoice_document" (
  "invoice_id" uuid NOT NULL REFERENCES "public"."invoice"("id") ON DELETE cascade,
  "document_id" uuid NOT NULL REFERENCES "public"."document"("id") ON DELETE cascade,
  "role" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "idempotency_record" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL REFERENCES "public"."organization"("id") ON DELETE cascade,
  "idempotency_key" text NOT NULL,
  "request_fingerprint" text NOT NULL,
  "response_status" integer,
  "response_body" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "job" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL REFERENCES "public"."organization"("id") ON DELETE cascade,
  "type" "job_type" NOT NULL,
  "status" "job_status" DEFAULT 'pending' NOT NULL,
  "payload" jsonb NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "run_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "locked_by" text,
  "last_error" text,
  "idempotency_key" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "usage_counter" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL REFERENCES "public"."organization"("id") ON DELETE cascade,
  "period" text NOT NULL,
  "metric" "usage_metric" NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "webhook" ADD CONSTRAINT "webhook_created_by_api_key_id_api_key_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_key"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "taxpayer_org_idx" ON "taxpayer" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "taxpayer_org_rfc_unique" ON "taxpayer" USING btree ("organization_id","rfc");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_org_idx" ON "ticket" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_taxpayer_idx" ON "ticket" USING btree ("taxpayer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_status_idx" ON "ticket" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_org_idempotency_unique" ON "ticket" USING btree ("organization_id","idempotency_key") WHERE "idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_org_idx" ON "document" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_taxpayer_idx" ON "document" USING btree ("taxpayer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_storage_key_unique" ON "document" USING btree ("storage_bucket","storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_ticket_unique" ON "invoice" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_org_idx" ON "invoice" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_taxpayer_idx" ON "invoice" USING btree ("taxpayer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_document_unique" ON "ticket_document" USING btree ("ticket_id","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_document_role_unique" ON "ticket_document" USING btree ("ticket_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_document_unique" ON "invoice_document" USING btree ("invoice_id","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_document_role_unique" ON "invoice_document" USING btree ("invoice_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_org_key_unique" ON "idempotency_record" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_queue_idx" ON "job" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_idempotency_unique" ON "job" USING btree ("organization_id","type","idempotency_key") WHERE "idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usage_counter_unique" ON "usage_counter" USING btree ("organization_id","period","metric");
