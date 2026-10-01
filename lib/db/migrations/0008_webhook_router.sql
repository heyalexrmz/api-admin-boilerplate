CREATE TABLE "upstream_webhook_delivery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" text NOT NULL,
  "destination" text NOT NULL,
  "raw_body" text NOT NULL,
  "status" "job_status" DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 12 NOT NULL,
  "run_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "locked_by" text,
  "last_error" text,
  "http_status" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);--> statement-breakpoint
CREATE UNIQUE INDEX "upstream_webhook_delivery_event_destination_uidx" ON "upstream_webhook_delivery" ("event_id", "destination");--> statement-breakpoint
CREATE INDEX "upstream_webhook_delivery_queue_idx" ON "upstream_webhook_delivery" ("status", "run_at");
