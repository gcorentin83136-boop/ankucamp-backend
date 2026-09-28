import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/core/db";
import { users } from "../src/core/db/schema";

async function main() {
  await db
    .update(users)
    .set({ email: "g.corentin.83136+SELLER@gmail.com" })
    .where(eq(users.id, 15));

  console.log("✅ Email vendeur mis à jour vers g.corentin.83136+SELLER@gmail.com");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});