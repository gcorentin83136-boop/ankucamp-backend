// ============================================================
// Script one-shot : créer un compte admin directement
// Usage : npx tsx scripts/create-admin.ts EMAIL PASSWORD
// ============================================================

import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../src/core/db";
import { users, userSettings } from "../src/core/db/schema";

const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];

if (!EMAIL || !PASSWORD) {
  console.error("❌ Usage : npx tsx scripts/create-admin.ts EMAIL PASSWORD");
  process.exit(1);
}

async function main() {
  // 1. Vérifie si l'email existe déjà
  const [existing] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, EMAIL))
    .limit(1);

  if (existing) {
    // Passer le user existant en admin
    await db
      .update(users)
      .set({ role: "admin", email_verified: 1 })
      .where(eq(users.id, existing.id));
    console.log(`✅ User #${existing.id} promu admin (${EMAIL})`);
    process.exit(0);
  }

  // 2. Créer le user
  const password_hash = await bcrypt.hash(PASSWORD, 10);
  const ts = Date.now();

  const [created] = await db
    .insert(users)
    .values({
      first_name: "Admin",
      last_name: "ANKU",
      username: `admin_${ts}`,
      email: EMAIL,
      password_hash,
      role: "admin",
      provider: "local",
      email_verified: 1,
    })
    .returning();

  // 3. Créer les settings
  await db
    .insert(userSettings)
    .values({ user_id: created.id })
    .onConflictDoNothing();

  console.log(`✅ Admin créé : #${created.id} (${EMAIL})`);
  console.log(`   Username : @${created.username}`);
  console.log(`   Password : ${PASSWORD}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
