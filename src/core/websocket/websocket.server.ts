import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { socketAuthMiddleware, AuthenticatedSocket } from "./socket.auth";
import { registerSocketHandlers } from "./socket.handlers";

let io: Server | null = null;

/**
 * Initialise Socket.io sur le serveur HTTP.
 */
export function initWebSocket(httpServer: HttpServer): Server {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin:
        env.NODE_ENV === "development"
          ? [
              "http://localhost:3000",
              "http://localhost:5173",
              "http://127.0.0.1:3000",
            ]
          : ["https://ankucamp.com"],
      credentials: true,
    },
    pingTimeout: 25000,
    pingInterval: 20000,
  });

  // Auth middleware
  io.use((socket, next) => {
    socketAuthMiddleware(socket as AuthenticatedSocket, next);
  });

  // Connection handler
  io.on("connection", (socket) => {
    registerSocketHandlers(io!, socket as AuthenticatedSocket);
  });

  logger.info("🔌 Serveur WebSocket (Socket.io) initialisé");

  return io;
}

/**
 * Renvoie l'instance Socket.io (utile pour émettre depuis les services REST).
 */
export function getIO(): Server {
  if (!io) {
    throw new Error(
      "Socket.io non initialisé. Appelle initWebSocket d'abord."
    );
  }
  return io;
}