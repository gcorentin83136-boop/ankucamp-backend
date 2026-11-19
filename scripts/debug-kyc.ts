import { db } from "../src/core/db";
import { kycRequests } from "../src/core/db/schema";

async function main() {
  const k = await db.select().from(kycRequests);
  console.log("=== KYC_REQUESTS ===");
  console.table(
    k.map((x: any) => ({
      id: x.id,
      user_id: x.user_id,
      status: x.status,
      siret: x.siret,
    }))
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
