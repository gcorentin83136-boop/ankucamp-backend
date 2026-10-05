// ============================================================
// Script : créer une KYC pending pour tester l'admin
// Usage : npx tsx scripts/seed-kyc.ts
// ============================================================

import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../src/core/db";
import {
  users,
  userSettings,
  kycRequests,
} from "../src/core/db/schema";

async function main() {
  const ts = Date.now();
  const email = `kyctest-${ts}@anku.local`;
  const password_hash = await bcrypt.hash("Test1234!", 10);

  // 1. Créer un user pro (avec email vérifié)
  const [user] = await db
    .insert(users)
    .values({
      first_name: "Test",
      last_name: "Producteur",
      username: `kyctest_${ts}`,
      email,
      password_hash,
      role: "professionnel",
      provider: "local",
      email_verified: 1,
      verification_status: "pending",
      city: "Lyon",
      postal_code: "69001",
      address: "1 rue de Test",
    })
    .returning();

  // 2. Settings
  await db
    .insert(userSettings)
    .values({ user_id: user.id })
    .onConflictDoNothing();

  // 3. KYC pending
  const [kyc] = await db
    .insert(kycRequests)
    .values({
      user_id: user.id,
      status: "pending",
      type: "agriculteur",
      siret: "81323658500010", // SENISO (SIRET actif)
      siret_verified: 1,
      siret_data: JSON.stringify({
        siren: "813236585",
        nom_complet: "SENISO",
        activite_principale: "01.11Z",
        etat_administratif: "A",
        date_creation: "2015-09-01",
        adresse: "Rue de la République, 01700 Beynost",
      }),
      documents: JSON.stringify([
        "https://res.cloudinary.com/tco89xfh/image/upload/v1/anku/kyc/fake-kbis.pdf",
        "https://res.cloudinary.com/tco89xfh/image/upload/v1/anku/kyc/fake-cni.jpg",
      ]),
    })
    .returning();

  console.log(`✅ User créé : #${user.id} (@${user.username})`);
  console.log(`   Email    : ${email}`);
  console.log(`   Password : Test1234!`);
  console.log(`   KYC #${kyc.id} en attente`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
