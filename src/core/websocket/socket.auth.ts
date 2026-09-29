import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { env } from "../../config/env";

interface JWTPayload {
  id: number;
  email: string;
  role: "professionnel" | "particulier";
}

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: number;
    email: string;
    username: string;
    firstName: string;
  };
}

/**
 * Middleware d'authentification Socket.io.
 *
 * Le client doit envoyer le JWT dans :
 *   io(url, { auth: { token: "eyJ..." } })
 * OU :
 *   io(url, { query: { token: "eyJ..." } })
 */
export async function socketAuthMiddleware(
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) {
  try {
    let token: string | undefined;

    if (socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    } else if (socket.handshake.query?.token) {
      token = socket.handshake.query.token as string;
    }

    if (!token) {
      return next(new Error("Token manquant"));
    }

    if (token.startsWith("Bearer ")) {
      token = token.slice(7);
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        first_name: users.first_name,
      })
      .from(users)
      .where(eq(users.id, payload.id))
      .limit(1);

    if (!user) {
      return next(new Error("Utilisateur introuvable"));
    }

    socket.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.first_name,
    };

    console.log(`🔌 Socket auth OK : user #${user.id} (@${user.username})`);

    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token invalide";
    console.error("❌ Socket auth error:", message);
    next(new Error("Token invalide"));
  }
}