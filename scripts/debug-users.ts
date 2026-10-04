import { db } from "../src/core/db";
import { users } from "../src/core/db/schema";

async function main() {
  const u = await db.select().from(users);
  console.log("=== USERS ===");
  console.table(
    u.map((x: any) => ({
      id: x.id,
      email: x.email,
      role: x.role,
      email_verified: x.email_verified,
      verification_status: x.verification_status,
    }))
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
