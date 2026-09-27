import { BrevoClient } from "@getbrevo/brevo";
import { env } from "../../config/env";
import { AppError } from "../errors/AppError";
import { logger } from "../../config/logger";

const brevo = new BrevoClient({ apiKey: env.BREVO_API_KEY });

const FROM = { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM };

// ============================================================
// ENVOI GÉNÉRIQUE
// ============================================================

interface SendEmailOptions {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  attachments?: Array<{ name: string; content: string }>; // base64
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  try {
    await brevo.transactionalEmails.sendTransacEmail({
      sender: FROM,
      to: [{ email: options.to, name: options.toName ?? options.to }],
      subject: options.subject,
      htmlContent: options.htmlContent,
      textContent: options.textContent,
      attachment: options.attachments,
    });

    logger.info({ to: options.to, subject: options.subject }, "📧 Email envoyé");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur Brevo";
    logger.error({ err: error, to: options.to }, "❌ Échec envoi email");
    throw new AppError(`Échec envoi email : ${message}`, 500);
  }
}