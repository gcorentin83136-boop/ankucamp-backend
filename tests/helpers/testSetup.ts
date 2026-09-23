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
      messages,
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