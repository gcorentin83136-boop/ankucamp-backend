import { renderBaseLayout } from "../layouts/baseLayout";
import { renderButton } from "../layouts/components";
import { COLORS } from "../layouts/theme";

interface AccountDeletionData {
  firstName: string;
  scheduledDate: Date;
  cancelUrl: string;
}

export function accountDeletionScheduledTemplate(
  data: AccountDeletionData
): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const { firstName, scheduledDate, cancelUrl } = data;

  const scheduledFormatted = scheduledDate.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const subject = "⚠️ Suppression de ton compte ANKU programmée";

  const content = `
    <p style="margin: 0 0 16px 0;">Bonjour <strong>${firstName}</strong>,</p>

    <p style="margin: 0 0 16px 0;">
      Nous avons bien reçu ta demande de <strong>suppression de compte</strong>.
    </p>

    <div style="background: #fef2f2; border-left: 4px solid ${COLORS.danger}; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0; color: #7f1d1d; font-size: 15px; line-height: 1.6;">
        🗓️ Ton compte sera définitivement supprimé le <strong>${scheduledFormatted}</strong>.
      </p>
    </div>

    <p style="margin: 0 0 16px 0;">
      <strong>Tu as 30 jours pour changer d'avis.</strong>
      Pendant ce temps, ton compte reste actif normalement.
    </p>

    <p style="margin: 0 0 16px 0;">
      Si tu veux annuler la suppression, clique sur le bouton ci-dessous :
    </p>

    ${renderButton(cancelUrl, "Annuler la suppression ✓")}

    <div style="margin: 32px 0 0 0; padding: 16px; background: #f9fafb; border-radius: 8px; font-size: 13px; color: #4b5563; line-height: 1.7;">
      <p style="margin: 0 0 8px 0;"><strong>Que se passera-t-il ensuite ?</strong></p>
      <ul style="margin: 0; padding-left: 20px;">
        <li>Ton profil deviendra anonyme</li>
        <li>Tes publications et commentaires seront supprimés</li>
        <li>Tes commandes et factures seront conservées 10 ans (obligation légale)</li>
        <li>Tu ne pourras plus te connecter avec cette adresse email</li>
      </ul>
    </div>

    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      Tu peux annuler cette suppression à tout moment depuis tes paramètres.
    </p>
  `;

  const htmlContent = renderBaseLayout({
    title: "Suppression de compte programmée ⚠️",
    content,
    preheader: `Ton compte sera supprimé le ${scheduledFormatted}`,
  });

  const textContent = `
Bonjour ${firstName},

Nous avons bien reçu ta demande de suppression de compte.

Ton compte sera définitivement supprimé le ${scheduledFormatted}.

Tu as 30 jours pour changer d'avis. Pendant ce temps, ton compte reste actif.

Pour annuler la suppression : ${cancelUrl}

L'équipe ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}