import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { logger } from "../../config/logger";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant dans .env");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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