import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../security/jwt";
import { AppError } from "../errors/AppError";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

// 🆕 On utilise un type qui évite le conflit avec Passport
export interface AuthRequest extends Request {
  user?: any;
  file?: any;
}

// ============================================================
// MIDDLEWARE OBLIGATOIRE
// ============================================================
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Token manquant", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = verifyToken(token);

    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, payload.id))
      .limit(1);

    if (!user) throw new AppError("Utilisateur introuvable", 401);

    req.user = user;
    next();
  } catch (error) {
    next(new AppError("Non authentifié", 401));
  }
}

// ============================================================
// MIDDLEWARE OPTIONNEL
// ============================================================
export async function authOptionalMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = verifyToken(token);

    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, payload.id))
      .limit(1);

    if (user) req.user = user;
    next();
  } catch {
    next();
  }
}

// ============================================================
// 🆕 MIDDLEWARE QUERY OR HEADER (pour la facture par exemple)
// ============================================================
export async function authMiddlewareQueryOrHeader(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // On regarde d'abord le header
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "");
    }

    // Sinon, on regarde dans le query (?token=...)
    if (!token && typeof req.query.token === "string") {
      token = req.query.token;
    }

    if (!token) {
      throw new AppError("Token manquant", 401);
    }

    const payload = verifyToken(token);

    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, payload.id))
      .limit(1);

    if (!user) throw new AppError("Utilisateur introuvable", 401);

    req.user = user;
    next();
  } catch (error) {
    next(new AppError("Non authentifié", 401));
  }
}