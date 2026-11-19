import crypto from "crypto";
import { eq, and, desc, ne, lt, sql } from "drizzle-orm";
import { db } from "../../../db";
import { userSessions } from "../../../db/schema";
import { AppError } from "../../../errors/AppError";

const MAX_SESSIONS_PER_USER = 10;

// ============================================================
// HELPERS
// ============================================================

/**
 * Hash le JWT pour stockage sécurisé (jamais le JWT en clair).
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Devine un nom d'appareil à partir du user-agent.
 * Ex: "Chrome sur Windows", "Safari sur iPhone"
 */
function guessDeviceInfo(userAgent?: string): string {
  if (!userAgent) return "Appareil inconnu";

  const ua = userAgent.toLowerCase();

  // OS
  let os = "Inconnu";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os") || ua.includes("macintosh")) os = "macOS";
  else if (ua.includes("iphone")) os = "iPhone";
  else if (ua.includes("ipad")) os = "iPad";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("linux")) os = "Linux";

  // Navigateur
  let browser = "Inconnu";
  if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("chrome")) browser = "Chrome";
  else if (ua.includes("safari")) browser = "Safari";
  else if (ua.includes("firefox")) browser = "Firefox";

  if (os === "Inconnu" && browser === "Inconnu") return "Appareil inconnu";

  return `${browser} sur ${os}`;
}

/**
 * Extrait l'IP réelle (gère les proxies).
 */
function extractIp(req: any): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ips.trim();
  }

  return req.ip ?? req.socket?.remoteAddress ?? null;
}

// ============================================================
// CRÉATION / NETTOYAGE
// ============================================================

/**
 * Crée une nouvelle session pour un user.
 * Nettoie les sessions expirées + garde max 10 sessions.
 */
export async function createSession(
  userId: number,
  token: string,
  req: any
): Promise<void> {
  const token_hash = hashToken(token);
  const user_agent = req.headers["user-agent"] ?? null;
  const ip_address = extractIp(req);
  const device_info = guessDeviceInfo(user_agent ?? undefined);

  // Expiration = 7 jours (aligné avec la durée du JWT)
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Nettoyage : sessions expirées
  await db
    .delete(userSessions)
    .where(
      and(
        eq(userSessions.user_id, userId),
        lt(userSessions.expires_at, new Date())
      )
    );

  // Créer la nouvelle session
  await db.insert(userSessions).values({
    user_id: userId,
    token_hash,
    device_info,
    ip_address,
    user_agent,
    expires_at,
  });

  // Vérifier la limite de 10 sessions
  const sessions = await db
    .select({ id: userSessions.id })
    .from(userSessions)
    .where(eq(userSessions.user_id, userId))
    .orderBy(desc(userSessions.created_at));

  if (sessions.length > MAX_SESSIONS_PER_USER) {
    // Supprimer les plus anciennes
    const toDelete = sessions.slice(MAX_SESSIONS_PER_USER);
    for (const s of toDelete) {
      await db.delete(userSessions).where(eq(userSessions.id, s.id));
    }

    console.log(
      `🧹 ${toDelete.length} session(s) ancienne(s) supprimée(s) pour user #${userId} (limite ${MAX_SESSIONS_PER_USER})`
    );
  }

  console.log(
    `🔐 Session créée pour user #${userId} (${device_info}, IP: ${ip_address})`
  );
}

/**
 * Supprime une session (logout).
 */
export async function deleteSession(token: string): Promise<void> {
  const token_hash = hashToken(token);

  await db.delete(userSessions).where(eq(userSessions.token_hash, token_hash));

  console.log(`🚪 Session supprimée (token_hash: ${token_hash.slice(0, 8)}...)`);
}

// ============================================================
// LECTURE
// ============================================================

/**
 * Liste les sessions actives d'un user.
 * Marque la session courante avec `is_current: true`.
 */
export async function listSessions(userId: number, currentToken?: string) {
  const currentHash = currentToken ? hashToken(currentToken) : null;

  const sessions = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.user_id, userId))
    .orderBy(desc(userSessions.last_active_at));

  return sessions.map((s) => ({
    id: s.id,
    device_info: s.device_info,
    ip_address: s.ip_address,
    created_at: s.created_at,
    last_active_at: s.last_active_at,
    expires_at: s.expires_at,
    is_current: currentHash === s.token_hash,
  }));
}

// ============================================================
// RÉVOCATION
// ============================================================

/**
 * Révoque une session spécifique (sauf si c'est la session courante).
 */
export async function revokeSession(
  userId: number,
  sessionId: number,
  currentToken?: string
): Promise<void> {
  const currentHash = currentToken ? hashToken(currentToken) : null;

  const [session] = await db
    .select()
    .from(userSessions)
    .where(
      and(eq(userSessions.id, sessionId), eq(userSessions.user_id, userId))
    )
    .limit(1);

  if (!session) {
    throw new AppError("Session introuvable", 404);
  }

  if (session.token_hash === currentHash) {
    throw new AppError(
      "Impossible de révoquer la session courante. Utilise le logout.",
      400
    );
  }

  await db.delete(userSessions).where(eq(userSessions.id, sessionId));

  console.log(`🚪 Session #${sessionId} révoquée pour user #${userId}`);
}

/**
 * Révoque TOUTES les autres sessions (garde la session courante).
 */
export async function revokeAllOtherSessions(
  userId: number,
  currentToken?: string
): Promise<number> {
  const currentHash = currentToken ? hashToken(currentToken) : null;

  if (!currentHash) {
    // Pas de session courante → tout supprimer
    const deleted = await db
      .delete(userSessions)
      .where(eq(userSessions.user_id, userId))
      .returning({ id: userSessions.id });

    return deleted.length;
  }

  const deleted = await db
    .delete(userSessions)
    .where(
      and(
        eq(userSessions.user_id, userId),
        ne(userSessions.token_hash, currentHash)
      )
    )
    .returning({ id: userSessions.id });

  console.log(
    `🚪 ${deleted.length} session(s) révoquée(s) pour user #${userId}`
  );

  return deleted.length;
}