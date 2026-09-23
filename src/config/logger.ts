import pino from "pino";
import { env } from "./env";

/**
 * Logger Pino configuré selon l'environnement.
 * - dev  : affichage coloré et lisible via pino-pretty
 * - prod : JSON brut (compatible Datadog, CloudWatch, Logtail, etc.)
 */
export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});