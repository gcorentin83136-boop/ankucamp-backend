import { generateTOTP } from "../src/core/api/auth/2fa/2fa.service";
import { eq } from "drizzle-orm";
import { db } from "../src/core/db";
import { userTwoFactor } from "../src/core/db/schema";

const email = process.argv[2];
if (!email) { console.error("Usage: npx tsx scripts/totp-now.ts EMAIL"); process.exit(1); }

async function main() {
  const { users } = await import("../src/core/db/schema");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) { console.error("User introuvable"); process.exit(1); }

  const [row] = await db.select().from(userTwoFactor).where(eq(userTwoFactor.user_id, user.id)).limit(1);
  if (!row) { console.error("Pas de 2FA setup"); process.exit(1); }

  console.log("Code TOTP actuel :", generateTOTP(row.secret));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
