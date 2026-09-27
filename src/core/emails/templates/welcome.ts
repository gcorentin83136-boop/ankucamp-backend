/**
 * Template HTML pour l'email de bienvenue + activation de compte.
 */
export function welcomeEmailTemplate(
  firstName: string,
  activationUrl: string
): { subject: string; htmlContent: string; textContent: string } {
  const subject = `Bienvenue sur ANKU, ${firstName} !`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">ANKU</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; margin-top: 0;">Bonjour ${firstName} 👋</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                Merci de rejoindre ANKU ! Pour activer ton compte et commencer à utiliser la plateforme, clique sur le bouton ci-dessous :
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${activationUrl}" style="display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold;">
                  Activer mon compte
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                Ou copie-colle ce lien dans ton navigateur :
              </p>
              <p style="color: #6366f1; font-size: 12px; word-break: break-all;">
                ${activationUrl}
              </p>
              <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
                ⚠️ Ce lien expire dans <strong>24 heures</strong>.
              </p>
              <p style="color: #6b7280; font-size: 14px;">
                Si tu n'es pas à l'origine de cette inscription, tu peux ignorer cet email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} ANKU. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textContent = `
Bonjour ${firstName},

Merci de rejoindre ANKU !

Pour activer ton compte, clique sur ce lien :
${activationUrl}

Ce lien expire dans 24 heures.

Si tu n'es pas à l'origine de cette inscription, ignore cet email.

© ${new Date().getFullYear()} ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}