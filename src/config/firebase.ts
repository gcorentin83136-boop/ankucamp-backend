import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";
import { env } from "./env";
import { logger } from "./logger";

// ============================================================
// INITIALISATION FIREBASE ADMIN
// ============================================================

let messagingInstance: Messaging | null = null;

/**
 * Initialise Firebase Admin (une seule fois).
 * En mode test, on SKIP l'init pour éviter d'appeler la vraie API.
 */
function initFirebase(): Messaging | null {
  if (env.NODE_ENV === "test") {
    logger.info("🔥 Firebase : skip en mode test");
    return null;
  }

  // Déjà initialisé ?
  if (getApps().length > 0) {
    logger.info("🔥 Firebase : déjà initialisé");
    return getMessaging();
  }

  try {
    // Décode la clé base64
    const json = Buffer.from(
      env.FIREBASE_SERVICE_ACCOUNT_BASE64,
      "base64"
    ).toString("utf-8");

    const serviceAccount = JSON.parse(json);

    // Init Firebase
    initializeApp({
      credential: cert(serviceAccount),
    });

    logger.info("🔥 Firebase Admin initialisé");
    return getMessaging();
  } catch (err) {
    logger.error({ err }, "❌ Erreur initialisation Firebase");
    return null;
  }
}

// ============================================================
// GETTER MESSAGING (lazy + memoized)
// ============================================================

export function getFirebaseMessaging(): Messaging | null {
  if (messagingInstance === null) {
    messagingInstance = initFirebase();
  }
  return messagingInstance;
}

// ============================================================
// HELPER : ENVOYER UN PUSH À UN TOKEN
// ============================================================

interface PushPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Envoie un push notification à UN device via son token FCM.
 * Renvoie true si succès, false sinon.
 */
export async function sendPushToToken(payload: PushPayload): Promise<boolean> {
  const messaging = getFirebaseMessaging();

  // En mode test : on ne peut pas envoyer, on retourne true (simulation)
  if (!messaging) {
    logger.debug(
      { token: payload.token.slice(0, 20) + "..." },
      "🔥 Push simulé (Firebase non initialisé)"
    );
    return true;
  }

  try {
    await messaging.send({
      token: payload.token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data ?? {},
    });

    return true;
  } catch (err: any) {
    // Cas courant : token invalide (user a désinstallé l'app)
    if (
      err.code === "messaging/registration-token-not-registered" ||
      err.code === "messaging/invalid-registration-token"
    ) {
      logger.warn(
        { token: payload.token.slice(0, 20) + "..." },
        "⚠️ Token FCM invalide (à supprimer)"
      );
      return false;
    }

    logger.error({ err, token: payload.token }, "❌ Erreur envoi push");
    return false;
  }
}

// ============================================================
// HELPER : ENVOYER UN PUSH À PLUSIEURS TOKENS
// ============================================================

/**
 * Envoie un push à PLUSIEURS tokens (multi-device).
 * Renvoie la liste des tokens invalides (à supprimer en DB).
 */
export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<string[]> {
  const invalidTokens: string[] = [];

  for (const token of tokens) {
    const success = await sendPushToToken({ token, title, body, data });
    if (!success) {
      invalidTokens.push(token);
    }
  }

  return invalidTokens;
}