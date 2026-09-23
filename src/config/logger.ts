import pino from "pino";
import { env } from "./env";

/**
 * En mode test, on n'affiche AUCUN log (pollue la sortie Vitest).
 * En dev, pino-pretty pour un affichage coloré.
 * En prod, JSON brut.
 */
const isTest = env.NODE_ENV === "test";
const isDev = env.NODE_ENV === "development";

export const logger = pino({
  level: isTest ? "silent" : isDev ? "debug" : "info",
  ...(isDev
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