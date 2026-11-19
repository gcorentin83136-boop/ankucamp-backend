import { db } from "../src/core/db";
import { accountDeletionRequests } from "../src/core/db/schema";
import { desc } from "drizzle-orm";

async function main() {
  const rows = await db
    .select()
    .from(accountDeletionRequests)
    .orderBy(desc(accountDeletionRequests.id))
    .limit(10);
  console.log("=== 10 dernières demandes de suppression ===");
  console.table(rows);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
