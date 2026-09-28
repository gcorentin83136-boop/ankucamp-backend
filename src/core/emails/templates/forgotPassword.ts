import { renderBaseLayout } from "../layouts/baseLayout";
import { renderButton } from "../layouts/components";

interface ForgotPasswordData {
  firstName: string;
  resetUrl: string;
}

export function forgotPasswordTemplate(data: ForgotPasswordData): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const { firstName, resetUrl } = data;

  const subject = "🔐 Réinitialisation de ton mot de passe ANKU";

  const content = `
    <p style="margin: 0 0 16px 0;">Bonjour <strong>${firstName}</strong>,</p>

    <p style="margin: 0 0 16px 0;">
      Tu as demandé à réinitialiser ton mot de passe ANKU.
      Clique sur le bouton ci-dessous pour en choisir un nouveau :
    </p>

    ${renderButton(resetUrl, "Réinitialiser mon mot de passe")}

    <p style="margin: 24px 0 0 0; padding: 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; font-size: 14px; color: #991b1b;">
      ⚠️ <strong>Sécurité</strong> : ce lien est valable <strong>1 heure</strong>.
      Si tu n'es pas à l'origine de cette demande, ignore cet email —
      ton mot de passe restera inchangé.
    </p>

    <p style="margin: 24px 0 0 0;">
      À bientôt,<br>
      <strong>L'équipe ANKU</strong>
    </p>
  `;

  const htmlContent = renderBaseLayout({
    title: "Réinitialisation du mot de passe",
    content,
    preheader: "Choisis un nouveau mot de passe ANKU",
  });

  const textContent = `
Bonjour ${firstName},

Tu as demandé à réinitialiser ton mot de passe ANKU.

Clique ici : ${resetUrl}

Ce lien est valable 1 heure.

Si tu n'es pas à l'origine de cette demande, ignore cet email.

L'équipe ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}