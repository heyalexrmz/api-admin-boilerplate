import { sql } from "drizzle-orm";
import { db } from "../lib/db";

async function main() {
  try {
    // Run after schema changes commit: PostgreSQL cannot use a newly added enum
    // value in the transaction that adds it. Production uses db:push, not migrate.
    const result = await db.execute(sql`
      update ticket
      set status = 'not_invoiceable', status_rank = 100
      where status = 'failed' and error_code = 'NOT_INVOICEABLE'
    `);
    console.log(`Reclassified ${result.rowCount ?? 0} non-invoiceable tickets.`);
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error("Could not reclassify non-invoiceable tickets:", error);
  process.exitCode = 1;
});
