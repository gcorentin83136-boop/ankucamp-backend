import { Request, Response } from "express";
import { pool } from "../../db";

/**
 * GET /health
 * Vérifie que l'API et la DB répondent.
 */
export async function healthCheck(_req: Request, res: Response) {
  const startedAt = Date.now();

  try {
    // Test rapide : on demande à PostgreSQL l'heure actuelle
    await pool.query("SELECT NOW()");

    return res.json({
      success: true,
      status: "ok",
      database: "connected",
      uptime: process.uptime(),
      latency_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue";

    return res.status(503).json({
      success: false,
      status: "error",
      database: "disconnected",
      uptime: process.uptime(),
      latency_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}