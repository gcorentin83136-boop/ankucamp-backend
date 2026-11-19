import { Response } from "express";
import { AuthRequest } from "../../../middlewares/auth.middleware";
import { AppError } from "../../../errors/AppError";
import {
  listSessions,
  revokeSession,
  revokeAllOtherSessions,
} from "./sessions.service";

// ============================================================
// Helper : extrait le JWT du header Authorization
// ============================================================

function extractToken(req: AuthRequest): string | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return undefined;
  return authHeader.slice(7); // retire "Bearer "
}

// ============================================================
// GET /settings/sessions
// ============================================================

export async function list(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const currentToken = extractToken(req);
  const sessions = await listSessions(req.user.id, currentToken);

  return res.json({
    success: true,
    count: sessions.length,
    sessions,
  });
}

// ============================================================
// DELETE /settings/sessions/:id
// ============================================================

export async function revoke(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const sessionId = Number(req.params.id);
  if (isNaN(sessionId) || sessionId <= 0) {
    throw new AppError("ID de session invalide", 400);
  }

  const currentToken = extractToken(req);
  await revokeSession(req.user.id, sessionId, currentToken);

  return res.json({
    success: true,
    message: "Session révoquée",
  });
}

// ============================================================
// DELETE /settings/sessions/all
// ============================================================

export async function revokeAll(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const currentToken = extractToken(req);
  const count = await revokeAllOtherSessions(req.user.id, currentToken);

  return res.json({
    success: true,
    message: `${count} session(s) révoquée(s). Tu restes connecté sur cet appareil.`,
    count,
  });
}