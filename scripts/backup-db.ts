import "dotenv/config";
import { runBackup } from "../src/core/api/backup/backup.service";

async function main() {
  console.log("💾 Backup de la base de données ANKUCAMP...\n");

  try {
    const result = await runBackup();

    console.log("✅ Backup créé avec succès !\n");
    console.log(`   📁 Fichier   : ${result.filename}`);
    console.log(`   📂 Chemin    : ${result.path}`);
    console.log(
      `   📦 Taille    : ${(result.size_bytes / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(`   ⏱️  Durée     : ${(result.duration_ms / 1000).toFixed(2)}s`);
    console.log(`   🗑️  Supprimés : ${result.deleted} ancien(s)\n`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur :", err);
    process.exit(1);
  }
}

main();