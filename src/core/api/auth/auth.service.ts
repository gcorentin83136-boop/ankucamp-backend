import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users, userSettings } from "../../db/schema";
import { signToken } from "../../security/jwt";
import { AppError } from "../../errors/AppError";
import type { RegisterInput, LoginInput } from "./auth.validation";
import { sendActivationEmail, sendResetPasswordEmail } from "./auth.emails";
import { generateUsername } from "../../utils/username";
import {
  createSession,
  deleteSession,
} from "../settings/sessions/sessions.service";
import { is2FAEnabled, create2FATempToken } from "./2fa/2fa.service";

const SALT_ROUNDS = 10;

const publicColumns = {
  id: users.id,
  first_name: users.first_name,
  last_name: users.last_name,
  username: users.username,
  email: users.email,
  birth_year: users.birth_year,
  address: users.address,
  city: users.city,
  postal_code: users.postal_code,
  country: users.country,
  avatar_url: users.avatar_url,
  cover_url: users.cover_url,
  bio: users.bio,
  website: users.website,
  location: users.location,
  is_private: users.is_private,
  provider: users.provider,
  role: users.role,
  email_verified: users.email_verified,
  created_at: users.created_at,
};

export async function registerUser(input: RegisterInput) {
  const { email, password } = input;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError("Cet email est déjà utilisé", 400);
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const { password: _password, ...dataWithoutPassword } = input;

  const username = await generateUsername(input.first_name, input.last_name);

  const [created] = await db
    .insert(users)
    .values({
      ...dataWithoutPassword,
      username,
      password_hash,
      provider: "local",
    })
    .returning(publicColumns);

  try {
    const [existingSettings] = await db
      .select({ id: userSettings.id })
      .from(userSettings)
      .where(eq(userSettings.user_id, created.id))
      .limit(1);

    if (!existingSettings) {
      await db.insert(userSettings).values({ user_id: created.id });
      console.log(`⚙️  user_settings créés pour user #${created.id}`);
    }
  } catch (err) {
    console.error("❌ Erreur création user_settings:", err);
  }

  sendActivationEmail(created.id, created.first_name, created.email).catch(
    (err) => console.error("Erreur envoi email activation:", err)
  );

  return created;
}

/**
 * Login avec création de session.
 * Retourne :
 *  - { user, token } si pas de 2FA
 *  - { requires_2fa: true, temp_token } si 2FA activée (le user doit valider via /auth/2fa/validate)
 */
export async function loginUser(
  input: LoginInput,
  req?: any
): Promise<
  | { user: any; token: string; requires_2fa?: false }
  | { requires_2fa: true; temp_token: string; user?: never; token?: never }
> {
  const { email, password } = input;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.password_hash) {
    throw new AppError("Email ou mot de passe incorrect", 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError("Email ou mot de passe incorrect", 401);
  }

  // ⚡ Si 2FA activée → on renvoie un temp_token, on ne crée PAS de session
  const has2FA = await is2FAEnabled(user.id);
  if (has2FA) {
    const temp_token = create2FATempToken(user.id);
    return { requires_2fa: true, temp_token };
  }

  // Sinon : login normal
  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role as "professionnel" | "particulier",
  });

  if (req) {
    try {
      await createSession(user.id, token, req);
    } catch (err) {
      console.error("❌ Erreur création session:", err);
    }
  }

  return {
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    },
    token,
  };
}

export async function logoutUser(token: string) {
  await deleteSession(token);
  return { success: true, message: "Déconnecté" };
}

export async function activateAccount(token: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.activation_token, token))
    .limit(1);

  if (!user) {
    throw new AppError("Token d'activation invalide", 400);
  }

  if (
    user.activation_token_expires &&
    user.activation_token_expires < new Date()
  ) {
    throw new AppError("Token d'activation expiré", 400);
  }

  await db
    .update(users)
    .set({
      email_verified: 1,
      activation_token: null,
      activation_token_expires: null,
    })
    .where(eq(users.id, user.id));

  return { success: true, message: "Compte activé" };
}

export async function forgotPassword(email: string) {
  await sendResetPasswordEmail(email);
  return {
    success: true,
    message: "Si cet email existe, un lien a été envoyé",
  };
}

export async function resetPassword(token: string, newPassword: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.reset_password_token, token))
    .limit(1);

  if (!user) {
    throw new AppError("Token de réinitialisation invalide", 400);
  }

  if (
    user.reset_password_token_expires &&
    user.reset_password_token_expires < new Date()
  ) {
    throw new AppError("Token de réinitialisation expiré", 400);
  }

  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await db
    .update(users)
    .set({
      password_hash,
      reset_password_token: null,
      reset_password_token_expires: null,
    })
    .where(eq(users.id, user.id));

  return { success: true, message: "Mot de passe réinitialisé" };
}