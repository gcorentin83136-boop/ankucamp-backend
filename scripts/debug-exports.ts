import { db } from "../src/core/db";
import { dataExportRequests } from "../src/core/db/schema";
import { desc } from "drizzle-orm";

async function main() {
  const rows = await db
    .select()
    .from(dataExportRequests)
    .orderBy(desc(dataExportRequests.id))
    .limit(10);
  console.log("=== 10 dernières demandes d'export ===");
  console.table(rows);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
