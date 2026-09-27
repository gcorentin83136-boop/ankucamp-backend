/**
 * Template HTML pour la réinitialisation de mot de passe.
 */
export function forgotPasswordTemplate(
  firstName: string,
  resetUrl: string
): { subject: string; htmlContent: string; textContent: string } {
  const subject = "Réinitialisation de votre mot de passe ANKU";

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: #ef4444; padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🔐 Mot de passe oublié</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; margin-top: 0;">Bonjour ${firstName},</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                Tu as demandé à réinitialiser ton mot de passe ANKU. Clique sur le bouton ci-dessous :
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: #ef4444; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold;">
                  Réinitialiser mon mot de passe
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">Ou copie-colle ce lien :</p>
              <p style="color: #ef4444; font-size: 12px; word-break: break-all;">${resetUrl}</p>
              <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
                ⚠️ Ce lien expire dans <strong>1 heure</strong>.
              </p>
              <p style="color: #6b7280; font-size: 14px;">
                Si tu n'as pas demandé cette réinitialisation, ignore cet email. Ton mot de passe actuel reste inchangé.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} ANKU</p>
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

Tu as demandé à réinitialiser ton mot de passe ANKU.

Lien de réinitialisation :
${resetUrl}

Ce lien expire dans 1 heure.

Si tu n'es pas à l'origine de cette demande, ignore cet email.

© ${new Date().getFullYear()} ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}