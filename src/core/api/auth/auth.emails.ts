import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { sendEmail } from "../../emails/email.service";
import { welcomeTemplate } from "../../emails/templates/welcome";
import { forgotPasswordTemplate } from "../../emails/templates/forgotPassword";
import { env } from "../../../config/env";

const FRONTEND_URL =
  env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://ankucamp.com";

const ACTIVATION_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL = 60 * 60 * 1000; // 1h

/**
 * Génère un token aléatoire sécurisé.
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Envoie un email d'activation de compte.
 */
export async function sendActivationEmail(
  userId: number,
  firstName: string,
  email: string
): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL);

  await db
    .update(users)
    .set({
      activation_token: token,
      activation_token_expires: expiresAt,
    })
    .where(eq(users.id, userId));

  const activationUrl = `${FRONTEND_URL}/auth/activate?token=${token}`;

  const { subject, htmlContent, textContent } = welcomeTemplate({
    firstName,
    activationUrl,
  });

  await sendEmail({
    to: email,
    toName: firstName,
    subject,
    htmlContent,
    textContent,
  });
}

/**
 * Envoie un email de réinitialisation de mot de passe.
 */
export async function sendResetPasswordEmail(email: string): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Sécurité : ne pas révéler si l'email existe ou non
  if (!user) {
    return;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL);

  await db
    .update(users)
    .set({
      reset_password_token: token,
      reset_password_token_expires: expiresAt,
    })
    .where(eq(users.id, user.id));

  const resetUrl = `${FRONTEND_URL}/auth/reset-password?token=${token}`;

  const { subject, htmlContent, textContent } = forgotPasswordTemplate({
    firstName: user.first_name,
    resetUrl,
  });

  await sendEmail({
    to: email,
    toName: user.first_name,
    subject,
    htmlContent,
    textContent,
  });
}