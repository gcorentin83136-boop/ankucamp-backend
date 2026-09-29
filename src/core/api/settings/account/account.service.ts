import bcrypt from "bcrypt";
import { eq, and, ne } from "drizzle-orm";
import { db } from "../../../db";
import { users, userSessions } from "../../../db/schema";
import { AppError } from "../../../errors/AppError";
import type {
  ChangeEmailInput,
  ChangePasswordInput,
  ChangeUsernameInput,
  UpdateInfoInput,
  DeactivateAccountInput,
} from "./account.validation";

const SALT_ROUNDS = 10;

// ============================================================
// HELPERS PRIVÉS
// ============================================================

async function getUserWithPassword(userId: number) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  return user;
}

async function verifyPassword(userId: number, password: string) {
  const user = await getUserWithPassword(userId);

  if (!user.password_hash) {
    throw new AppError(
      "Ce compte utilise une connexion OAuth (Google). Aucun mot de passe à vérifier.",
      400
    );
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError("Mot de passe incorrect", 401);
  }

  return user;
}

// ============================================================
// LECTURE DES INFOS
// ============================================================

export async function getAccountInfo(userId: number) {
  const [user] = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      email: users.email,
      birth_year: users.birth_year,
      provider: users.provider,
      email_verified: users.email_verified,
      role: users.role,
      created_at: users.created_at,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  return user;
}

// ============================================================
// CHANGEMENT D'EMAIL
// ============================================================

export async function changeEmail(userId: number, input: ChangeEmailInput) {
  const { new_email, password } = input;

  // Vérifier le mot de passe
  await verifyPassword(userId, password);

  // Vérifier que le nouvel email n'est pas déjà pris
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, new_email), ne(users.id, userId)))
    .limit(1);

  if (existing) {
    throw new AppError("Cet email est déjà utilisé par un autre compte", 400);
  }

  // Update
  const [updated] = await db
    .update(users)
    .set({
      email: new_email,
      email_verified: 0, // On redemande la vérification
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      email_verified: users.email_verified,
    });

  console.log(`📧 Email modifié pour user #${userId} → ${new_email}`);

  return updated;
}

// ============================================================
// CHANGEMENT DE MOT DE PASSE
// ============================================================

export async function changePassword(
  userId: number,
  input: ChangePasswordInput
) {
  const { current_password, new_password } = input;

  // Vérifier l'ancien mot de passe
  await verifyPassword(userId, current_password);

  // Hash le nouveau
  const password_hash = await bcrypt.hash(new_password, SALT_ROUNDS);

  // Update
  await db
    .update(users)
    .set({ password_hash })
    .where(eq(users.id, userId));

  // Sécurité : révoquer TOUTES les autres sessions actives (sauf la courante)
  // Note : on ne connaît pas la session courante ici, donc on laisse le service
  // appelant passer le token_hash à conserver s'il le souhaite.
  // Ici, on révoque tout sauf si on nous passe un tokenHash.
  await db.delete(userSessions).where(eq(userSessions.user_id, userId));

  console.log(`🔐 Mot de passe modifié pour user #${userId} + sessions révoquées`);

  return { success: true };
}

// ============================================================
// CHANGEMENT DE USERNAME
// ============================================================

export async function changeUsername(
  userId: number,
  input: ChangeUsernameInput
) {
  const { new_username, password } = input;

  // Vérifier le mot de passe
  await verifyPassword(userId, password);

  // Vérifier que le username n'est pas déjà pris
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, new_username), ne(users.id, userId)))
    .limit(1);

  if (existing) {
    throw new AppError("Ce username est déjà utilisé", 400);
  }

  // Update
  const [updated] = await db
    .update(users)
    .set({ username: new_username })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
    });

  console.log(`👤 Username modifié pour user #${userId} → @${new_username}`);

  return updated;
}

// ============================================================
// MODIFICATION DES INFOS PERSONNELLES
// ============================================================

export async function updatePersonalInfo(
  userId: number,
  input: UpdateInfoInput
) {
  const cleanData: any = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) cleanData[key] = value;
  }

  if (Object.keys(cleanData).length === 0) {
    throw new AppError("Aucune donnée à mettre à jour", 400);
  }

  const [updated] = await db
    .update(users)
    .set(cleanData)
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      birth_year: users.birth_year,
    });

  console.log(`📝 Infos personnelles modifiées pour user #${userId}`);

  return updated;
}

// ============================================================
// DÉSACTIVATION DE COMPTE
// ============================================================

/**
 * Désactive temporairement le compte (soft delete).
 * Note : on n'a pas de champ `is_deactivated` pour l'instant.
 * On utilise `email_verified = -1` comme flag de désactivation.
 * À remplacer par un vrai champ plus tard.
 */
export async function deactivateAccount(
  userId: number,
  input: DeactivateAccountInput
) {
  const { password, reason } = input;

  // Vérifier le mot de passe
  await verifyPassword(userId, password);

  // Marquer le compte comme désactivé
  await db
    .update(users)
    .set({ email_verified: -1 }) // -1 = désactivé
    .where(eq(users.id, userId));

  // Révoquer toutes les sessions
  await db.delete(userSessions).where(eq(userSessions.user_id, userId));

  console.log(
    `🚫 Compte #${userId} désactivé. Raison : ${reason ?? "(non renseignée)"}`
  );

  return { success: true };
}