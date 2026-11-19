import { eq, or } from "drizzle-orm";
import { db } from "../src/core/db";
import { kycRequests, users } from "../src/core/db/schema";

async function main() {
  // 1. Récupérer les user_ids qui existent encore
  const existingUsers = await db.select({ id: users.id }).from(users);
  const validIds = new Set(existingUsers.map((u) => u.id));
  console.log("Users valides :", [...validIds]);

  // 2. Lister toutes les KYC
  const all = await db.select().from(kycRequests);
  console.log("KYC avant :", all.length);

  // 3. Supprimer les KYC orphelines (user_id qui n'existe plus)
  const orphans = all.filter((k) => !validIds.has(k.user_id));
  for (const o of orphans) {
    await db.delete(kycRequests).where(eq(kycRequests.id, o.id));
    console.log(`   🗑️  KYC orpheline #${o.id} (user_id ${o.user_id}) supprimée`);
  }

  // 4. Supprimer les KYC pending de ton user actuel (pour repartir clean)
  const mine = all.filter(
    (k) => validIds.has(k.user_id) && k.status === "pending"
  );
  for (const m of mine) {
    await db.delete(kycRequests).where(eq(kycRequests.id, m.id));
    console.log(`   🗑️  KYC pending #${m.id} (user_id ${m.user_id}) supprimée`);
  }

  // 5. Reset verification_status à 'none' pour les users concernés
  for (const uid of new Set(mine.map((m) => m.user_id))) {
    await db
      .update(users)
      .set({ verification_status: "none" })
      .where(eq(users.id, uid));
    console.log(`   ♻️  user #${uid} → verification_status = 'none'`);
  }

  const after = await db.select().from(kycRequests);
  console.log("KYC après :", after.length);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
