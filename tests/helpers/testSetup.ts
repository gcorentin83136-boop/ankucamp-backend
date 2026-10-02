import { afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/core/db/schema";

/**
 * Pool PostgreSQL dédié aux tests.
 * Utilise DATABASE_URL_TEST si dispo, sinon DATABASE_URL.
 */
const testDatabaseUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("Aucune URL de test disponible (DATABASE_URL_TEST ou DATABASE_URL)");
}

if (
  testDatabaseUrl.includes("ankucamp") &&
  !testDatabaseUrl.includes("ankucamp_test")
) {
  console.warn(
    "⚠️  ATTENTION : les tests tournent sur la DB principale. " +
      "Ajoute DATABASE_URL_TEST dans .env pour isoler."
  );
}

export const testPool = new Pool({ connectionString: testDatabaseUrl });
export const testDb = drizzle(testPool, { schema });

/**
 * Nettoie toutes les tables entre chaque test.
 * L'ordre est important à cause des FK.
 */
export async function cleanDatabase() {
  await testPool.query(`
    TRUNCATE TABLE
      notifications,
      message_reactions,
      message_reads,
      messages,
      conversation_participants,
      conversations,
      post_likes,
      post_comments,
      post_shares,
      posts,
      friendships,
      follows,
      user_2fa,
      user_sessions,
      user_settings,
      legal_acceptances,
      data_export_requests,
      account_deletion_requests,
      carts,
      wishlists,
      promo_uses,
      promo_codes,
      event_likes,
      event_registrations,
      events,
      article_likes,
      articles,
      audit_logs,
      content_reports,
      kyc_requests,
      user_badges,
      payments,
      refund_requests,
      order_items,
      orders,
      products,
      shop_categories,
      shops,
      categories,
      users
    RESTART IDENTITY CASCADE
  `);
}

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await testPool.end();
});