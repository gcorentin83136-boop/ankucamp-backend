import { renderBaseLayout } from "../layouts/baseLayout";
import { renderButton } from "../layouts/components";

interface DataExportData {
  firstName: string;
  downloadUrl: string;
  expiresAt: Date;
}

export function dataExportTemplate(data: DataExportData): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const { firstName, downloadUrl, expiresAt } = data;

  const expiresFormatted = expiresAt.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const subject = "📦 Ton export de données ANKU est prêt";

  const content = `
    <p style="margin: 0 0 16px 0;">Bonjour <strong>${firstName}</strong>,</p>

    <p style="margin: 0 0 16px 0;">
      Conformément au <strong>RGPD</strong> (article 20 — droit à la portabilité),
      tu as demandé une copie de toutes tes données personnelles ANKU.
    </p>

    <p style="margin: 0 0 16px 0;">
      Ton archive est prête ! Elle contient :
    </p>

    <ul style="margin: 0 0 16px 0; padding-left: 24px; color: #4b5563; line-height: 1.8;">
      <li>Ton profil et tes paramètres</li>
      <li>Tes publications, commentaires et likes</li>
      <li>Tes amis et abonnements</li>
      <li>Tes commandes et avis</li>
      <li>Tes notifications et messages</li>
    </ul>

    ${renderButton(downloadUrl, "Télécharger mes données 📦")}

    <p style="margin: 24px 0 0 0; padding: 16px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; font-size: 14px; color: #78350f;">
      ⏰ <strong>Ce lien expire le ${expiresFormatted}</strong>.
      Passé ce délai, tu devras refaire une demande depuis tes paramètres.
    </p>

    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      Si tu n'es pas à l'origine de cette demande, contacte-nous immédiatement à
      <a href="mailto:contact@ankucamp.com" style="color: #10b981;">contact@ankucamp.com</a>.
    </p>
  `;

  const htmlContent = renderBaseLayout({
    title: "Ton export de données 📦",
    content,
    preheader: `Télécharge tes données ANKU (expire le ${expiresFormatted})`,
  });

  const textContent = `
Bonjour ${firstName},

Conformément au RGPD, tu as demandé une copie de toutes tes données personnelles ANKU.

Ton archive contient :
- Ton profil et tes paramètres
- Tes publications, commentaires et likes
- Tes amis et abonnements
- Tes commandes et avis
- Tes notifications et messages

Télécharger : ${downloadUrl}

Ce lien expire le ${expiresFormatted}.

Si tu n'es pas à l'origine de cette demande, contacte-nous à contact@ankucamp.com.

L'équipe ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}