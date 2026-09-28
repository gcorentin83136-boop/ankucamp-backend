interface InvoiceResentData {
  recipientFirstName: string;
  orderId: number;
  invoiceNumber: string;
}

/**
 * Template HTML : renvoi de facture à la demande (depuis "Mes commandes").
 */
export function invoiceResentTemplate(data: InvoiceResentData): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const { recipientFirstName, orderId, invoiceNumber } = data;

  const subject = `📄 Ta facture ${invoiceNumber} — Commande #${orderId}`;

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
            <td style="background: #6366f1; padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">📄 Ta facture ANKU</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; margin-top: 0;">Bonjour ${recipientFirstName},</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                Tu trouveras ci-joint la facture de ta commande <strong>#${orderId}</strong>.
              </p>

              <div style="background: #f9fafb; border-left: 4px solid #6366f1; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Numéro de facture</p>
                <p style="margin: 8px 0 0 0; color: #1f2937; font-size: 20px; font-weight: bold;">
                  ${invoiceNumber}
                </p>
              </div>

              <p style="color: #4b5563; line-height: 1.6;">
                Cette facture est <strong>strictement identique</strong> à celle émise au moment de ton paiement.
                Conserve-la précieusement pour ta comptabilité.
              </p>

              <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
                Si tu as la moindre question sur cette commande, n'hésite pas à contacter le vendeur depuis ton espace "Mes commandes".
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
Bonjour ${recipientFirstName},

Tu trouveras ci-joint la facture de ta commande #${orderId}.

Numéro de facture : ${invoiceNumber}

Cette facture est strictement identique à celle émise au moment de ton paiement.

© ${new Date().getFullYear()} ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}