import { desc } from "drizzle-orm";
import { db } from "../src/core/db";
import { kycRequests } from "../src/core/db/schema";

async function main() {
  const rows = await db
    .select()
    .from(kycRequests)
    .orderBy(desc(kycRequests.id))
    .limit(5);

  console.log("=== 5 dernières KYC ===");
  console.table(
    rows.map((x: any) => ({
      id: x.id,
      user_id: x.user_id,
      status: x.status,
      type: x.type,
      admin_id: x.admin_id,
      reviewed_at: x.reviewed_at,
      rejection_reason: x.rejection_reason,
    }))
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
