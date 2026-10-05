import { db } from "../src/core/db";
import { refundRequests } from "../src/core/db/schema";
import { desc } from "drizzle-orm";

async function main() {
  const rows = await db.select().from(refundRequests).orderBy(desc(refundRequests.id)).limit(3);
  console.table(rows.map((r) => ({
    id: r.id,
    status: r.status,
    stripe_refund_id: r.stripe_refund_id,
    admin_comment: r.admin_comment,
  })));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
