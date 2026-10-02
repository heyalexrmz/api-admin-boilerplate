ALTER TYPE "public"."ticket_status" ADD VALUE IF NOT EXISTS 'not_invoiceable' AFTER 'failed';
