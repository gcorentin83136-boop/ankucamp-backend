import { renderBaseLayout } from "../layouts/baseLayout";
import { renderButton } from "../layouts/components";

interface WelcomeData {
  firstName: string;
  activationUrl: string;
}

export function welcomeTemplate(data: WelcomeData): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const { firstName, activationUrl } = data;

  const subject = `Bienvenue sur ANKU, ${firstName} !`;

  const content = `
    <p style="margin: 0 0 16px 0;">Bonjour <strong>${firstName}</strong>,</p>

    <p style="margin: 0 0 16px 0;">
      Bienvenue sur <strong>ANKU</strong>, Bienvenue sur ANKU, la plateforme qui met en relation les
agriculteurs, producteurs et artisans avec les particuliers
et les professionnels. 🌿🌿
    </p>

    <p style="margin: 0 0 16px 0;">
      Pour commencer, active ton compte en cliquant sur le bouton ci-dessous :
    </p>

    ${renderButton(activationUrl, "Activer mon compte")}

    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      Ce lien est valable 24 heures. Si tu n'es pas à l'origine de cette inscription,
      ignore simplement cet email.
    </p>

    <p style="margin: 24px 0 0 0;">
      À très vite,<br>
      <strong>L'équipe ANKU</strong>
    </p>
  `;

  const htmlContent = renderBaseLayout({
    title: "Bienvenue 🌿",
    content,
    preheader: `Active ton compte ANKU en 1 clic`,
  });

  const textContent = `
Bonjour ${firstName},

Bienvenue sur ANKU !

Active ton compte : ${activationUrl}

Ce lien est valable 24 heures.

À très vite,
L'équipe ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}