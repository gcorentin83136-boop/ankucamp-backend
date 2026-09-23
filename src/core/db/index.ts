import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

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
    console.log("✅ PostgreSQL connecté :", result.rows[0].now);
  } catch (error) {
    console.error("❌ Erreur de connexion PostgreSQL :", error);
    process.exit(1);
  }
}