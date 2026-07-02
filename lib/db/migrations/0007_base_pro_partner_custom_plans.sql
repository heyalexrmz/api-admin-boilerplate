INSERT INTO "plan" ("id", "name", "ticket_credit_allowance", "refill_frequency", "is_default", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'Base', 20, 'monthly', true, now(), now()),
  (gen_random_uuid(), 'Pro', 50, 'monthly', false, now(), now()),
  (gen_random_uuid(), 'Partner', 100, 'monthly', false, now(), now()),
  (gen_random_uuid(), 'Custom', 0, 'monthly', false, now(), now())
ON CONFLICT ("name") DO UPDATE SET
  "ticket_credit_allowance" = EXCLUDED."ticket_credit_allowance",
  "refill_frequency" = EXCLUDED."refill_frequency",
  "is_default" = EXCLUDED."is_default",
  "updated_at" = now();--> statement-breakpoint
UPDATE "plan"
SET "is_default" = false, "updated_at" = now()
WHERE "name" <> 'Base' AND "is_default" = true;--> statement-breakpoint
WITH "base_plan" AS (
  SELECT "id", "ticket_credit_allowance"
  FROM "plan"
  WHERE "name" = 'Base'
  LIMIT 1
),
"starter_accounts" AS (
  SELECT
    "credit_account"."organization_id",
    "credit_account"."plan_id" AS "previous_plan_id",
    "credit_account"."balance" AS "previous_balance",
    "base_plan"."id" AS "base_plan_id",
    "base_plan"."ticket_credit_allowance" AS "base_allowance"
  FROM "credit_account"
  INNER JOIN "plan" ON "plan"."id" = "credit_account"."plan_id"
  CROSS JOIN "base_plan"
  WHERE "plan"."name" = 'Starter'
)
INSERT INTO "credit_ledger_entry" (
  "organization_id",
  "account_organization_id",
  "plan_id",
  "delta",
  "balance_after",
  "reason",
  "metadata",
  "created_at"
)
SELECT
  "organization_id",
  "organization_id",
  "base_plan_id",
  "base_allowance" - "previous_balance",
  "base_allowance",
  'manual_adjustment',
  jsonb_build_object(
    'reason', 'starter_to_base_migration',
    'previous_plan_id', "previous_plan_id",
    'previous_balance', "previous_balance"
  ),
  now()
FROM "starter_accounts"
WHERE "previous_balance" <> "base_allowance";--> statement-breakpoint
WITH "base_plan" AS (
  SELECT "id", "ticket_credit_allowance"
  FROM "plan"
  WHERE "name" = 'Base'
  LIMIT 1
)
UPDATE "credit_account"
SET
  "plan_id" = "base_plan"."id",
  "balance" = "base_plan"."ticket_credit_allowance",
  "last_refill_at" = now(),
  "next_refill_at" = now() + interval '1 month',
  "updated_at" = now()
FROM "plan" AS "current_plan", "base_plan"
WHERE "credit_account"."plan_id" = "current_plan"."id"
  AND "current_plan"."name" = 'Starter';--> statement-breakpoint
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
  WHERE "name" = 'Base'
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
  '{"source":"base_plan_migration"}'::jsonb,
  now()
FROM "credit_account"
INNER JOIN "plan" ON "plan"."id" = "credit_account"."plan_id"
WHERE "plan"."name" = 'Base'
  AND NOT EXISTS (
    SELECT 1
    FROM "credit_ledger_entry"
    WHERE "credit_ledger_entry"."account_organization_id" = "credit_account"."organization_id"
      AND "credit_ledger_entry"."reason" = 'initial_grant'
  );
