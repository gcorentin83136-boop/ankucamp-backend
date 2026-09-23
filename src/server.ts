import { env } from "./config/env";
import { logger } from "./config/logger";
import app from "./app";
import { testConnection } from "./core/db";

async function bootstrap() {
  logger.info("🚀 Démarrage du serveur ANKUCAMP...");
  logger.info(`   Environnement : ${env.NODE_ENV}`);
  logger.info(`   Port          : ${env.PORT}`);

  await testConnection();

  app.listen(env.PORT, () => {
    logger.info(`✅ API ANKUCAMP en écoute sur http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, "❌ Erreur fatale au démarrage");
  process.exit(1);
});