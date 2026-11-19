import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL manquant dans .env");
  }

  console.log("🔄 Migration en cours...");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("✅ Migrations appliquées avec succès");

  await pool.end();
}

main().catch((err) => {
  console.error("❌ Erreur de migration :", err);
  process.exit(1);
});