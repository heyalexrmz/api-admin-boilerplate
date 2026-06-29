DO $$ BEGIN
  CREATE TYPE "public"."credit_ledger_reason" AS ENUM('initial_grant', 'refill', 'ticket_submission', 'manual_adjustment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."refill_frequency" AS ENUM('daily', 'weekly', 'monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "ticket_credit_allowance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "refill_frequency" "refill_frequency" DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_account" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"last_refill_at" timestamp with time zone,
	"next_refill_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_ledger_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"account_organization_id" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" "credit_ledger_reason" NOT NULL,
	"ticket_id" uuid,
	"request_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_account" ADD CONSTRAINT "credit_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_account" ADD CONSTRAINT "credit_account_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_ledger_entry" ADD CONSTRAINT "credit_ledger_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_ledger_entry" ADD CONSTRAINT "credit_ledger_entry_account_organization_id_credit_account_organization_id_fk" FOREIGN KEY ("account_organization_id") REFERENCES "public"."credit_account"("organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_ledger_entry" ADD CONSTRAINT "credit_ledger_entry_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_account_plan_idx" ON "credit_account" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_account_next_refill_idx" ON "credit_account" USING btree ("next_refill_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_ledger_entry_org_created_idx" ON "credit_ledger_entry" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_ledger_entry_ticket_idx" ON "credit_ledger_entry" USING btree ("ticket_id");--> statement-breakpoint
INSERT INTO "plan" ("id", "name", "ticket_credit_allowance", "refill_frequency", "is_default", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'Starter', 100, 'monthly', true, now(), now())
ON CONFLICT ("name") DO UPDATE SET
  "ticket_credit_allowance" = EXCLUDED."ticket_credit_allowance",
  "refill_frequency" = EXCLUDED."refill_frequency",
  "is_default" = true,
  "updated_at" = now();--> statement-breakpoint
INSERT INTO "credit_account" ("organization_id", "plan_id", "balance", "last_refill_at", "next_refill_at", "created_at", "updated_at")
SELECT
  "organization"."id",
  "plan"."id",
  "plan"."ticket_credit_allowance",
  now(),
  now() + interval '1 month',
  now(),
  now()
FROM "organization"
CROSS JOIN LATERAL (
  SELECT "id", "ticket_credit_allowance"
  FROM "plan"
  WHERE "is_default" = true
  ORDER BY "created_at" DESC
  LIMIT 1
) "plan"
ON CONFLICT ("organization_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "credit_ledger_entry" ("organization_id", "account_organization_id", "plan_id", "delta", "balance_after", "reason", "metadata", "created_at")
SELECT
  "credit_account"."organization_id",
  "credit_account"."organization_id",
  "credit_account"."plan_id",
  "credit_account"."balance",
  "credit_account"."balance",
  'initial_grant',
  '{"source":"migration"}'::jsonb,
  now()
FROM "credit_account"
WHERE NOT EXISTS (
  SELECT 1
  FROM "credit_ledger_entry"
  WHERE "credit_ledger_entry"."account_organization_id" = "credit_account"."organization_id"
    AND "credit_ledger_entry"."reason" = 'initial_grant'
);