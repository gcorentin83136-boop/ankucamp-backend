import { db } from "../src/core/db";
import { users } from "../src/core/db/schema";
import { eq, isNotNull } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      suspended_until: users.suspended_until,
      suspension_reason: users.suspension_reason,
    })
    .from(users)
    .where(isNotNull(users.suspended_until));

  console.log("Users suspendus :", rows.length);
  console.table(rows);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
