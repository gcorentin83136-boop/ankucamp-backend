import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { logger } from "../../config/logger";

// En mode test, on utilise une DB dédiée pour ne pas polluer la dev
const databaseUrl =
  process.env.NODE_ENV === "test"
    ? process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL
    : process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL manquant dans .env");
}

export const pool = new Pool({
  connectionString: databaseUrl,
});

export const db = drizzle(pool, { schema });

export async function testConnection() {
  try {
    const result = await pool.query("SELECT NOW()");
    logger.info({ timestamp: result.rows[0].now }, "✅ PostgreSQL connecté");
  } catch (error) {
    logger.fatal({ err: error }, "❌ Erreur de connexion PostgreSQL");
    process.exit(1);
  }
}