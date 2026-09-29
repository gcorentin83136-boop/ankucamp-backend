import { env } from "./config/env";
import { logger } from "./config/logger";
import app from "./app";
import { testConnection } from "./core/db";
import { startReviewScheduler } from "./core/api/orders/orders.scheduler";
import { startAccountDeletionScheduler } from "./core/api/settings/gdpr/accountDeletion.scheduler";

async function bootstrap() {
  logger.info("🚀 Démarrage du serveur ANKUCAMP...");
  logger.info(`   Environnement : ${env.NODE_ENV}`);
  logger.info(`   Port          : ${env.PORT}`);

  await testConnection();

  app.listen(env.PORT, () => {
    logger.info(`✅ API ANKUCAMP en écoute sur http://localhost:${env.PORT}`);

    // Démarrer les schedulers (sauf en test)
    if (env.NODE_ENV !== "test") {
      startReviewScheduler();
      startAccountDeletionScheduler();
    }
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, "❌ Erreur fatale au démarrage");
  process.exit(1);
});