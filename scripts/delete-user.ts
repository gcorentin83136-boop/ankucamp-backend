// ============================================================
// Script one-shot : supprimer un compte + TOUTES ses dépendances
// Usage : npx tsx scripts/delete-user.ts EMAIL
// ============================================================

import { eq } from "drizzle-orm";
import { db } from "../src/core/db";
import {
  users,
  userSessions,
  userSettings,
  legalAcceptances,
  dataExportRequests,
  accountDeletionRequests,
  kycRequests,
} from "../src/core/db/schema";

const EMAIL = process.argv[2];

if (!EMAIL) {
  console.error("❌ Usage : npx tsx scripts/delete-user.ts EMAIL");
  process.exit(1);
}

async function main() {
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, EMAIL))
    .limit(1);

  if (!user) {
    console.log(`ℹ️  Aucun user avec l'email ${EMAIL}`);
    process.exit(0);
  }

  const uid = user.id;
  console.log(`🗑️  Suppression du user #${uid} (${user.email})`);

  await db.delete(userSessions).where(eq(userSessions.user_id, uid));
  console.log("   ✅ user_sessions");

  await db.delete(userSettings).where(eq(userSettings.user_id, uid));
  console.log("   ✅ user_settings");

  await db.delete(legalAcceptances).where(eq(legalAcceptances.user_id, uid));
  console.log("   ✅ legal_acceptances");

  await db.delete(dataExportRequests).where(eq(dataExportRequests.user_id, uid));
  console.log("   ✅ data_export_requests");

  await db
    .delete(accountDeletionRequests)
    .where(eq(accountDeletionRequests.user_id, uid));
  console.log("   ✅ account_deletion_requests");

  await db.delete(kycRequests).where(eq(kycRequests.user_id, uid));
  console.log("   ✅ kyc_requests");

  await db.delete(users).where(eq(users.id, uid));
  console.log("   ✅ users");

  console.log(`\n🎉 Compte ${EMAIL} supprimé définitivement.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erreur :", err);
  process.exit(1);
});
