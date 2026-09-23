import { env } from "./config/env";
import app from "./app";
import { testConnection } from "./core/db";

async function bootstrap() {
  console.log("🚀 Démarrage du serveur ANKUCAMP...");
  console.log(`   Environnement : ${env.NODE_ENV}`);
  console.log(`   Port          : ${env.PORT}`);

  await testConnection();

  app.listen(env.PORT, () => {
    console.log(`✅ API ANKUCAMP en écoute sur http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("❌ Erreur fatale au démarrage :", err);
  process.exit(1);
});