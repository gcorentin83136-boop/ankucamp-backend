import { createServer } from "http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import app from "./app";
import { testConnection } from "./core/db";
import { startReviewScheduler } from "./core/api/orders/orders.scheduler";
import { startAccountDeletionScheduler } from "./core/api/settings/gdpr/accountDeletion.scheduler";
import { initWebSocket } from "./core/websocket/websocket.server";

async function bootstrap() {
  logger.info("🚀 Démarrage du serveur ANKUCAMP...");
  logger.info(`   Environnement : ${env.NODE_ENV}`);
  logger.info(`   Port          : ${env.PORT}`);

  await testConnection();

  // Crée un serveur HTTP wrappé par Express
  const httpServer = createServer(app);

  // Init Socket.io sur ce serveur HTTP
  if (env.NODE_ENV !== "test") {
    initWebSocket(httpServer);
  }

  httpServer.listen(env.PORT, () => {
    logger.info(`✅ API ANKUCAMP en écoute sur http://localhost:${env.PORT}`);
    logger.info(`🔌 WebSocket disponible sur ws://localhost:${env.PORT}`);

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