import { eq } from "drizzle-orm";
import { db } from "../src/core/db";
import { refundRequests, payments, orders } from "../src/core/db/schema";

async function main() {
  await db.update(refundRequests).set({
    status: "pending",
    admin_id: null,
    admin_comment: null,
    processed_at: null,
    stripe_refund_id: null,
  });
  await db.update(payments).set({ status: "succeeded" });
  await db.update(orders).set({ status: "delivered" });
  console.log("OK : tout reset en pending");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
