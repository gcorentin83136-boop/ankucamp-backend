import { renderBaseLayout } from "../layouts/baseLayout";
import { renderInfoBox } from "../layouts/components";

interface InvoiceResentData {
  recipientFirstName: string;
  orderId: number;
  invoiceNumber: string;
}

export function invoiceResentTemplate(data: InvoiceResentData): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const { recipientFirstName, orderId, invoiceNumber } = data;

  const subject = `📄 Ta facture ${invoiceNumber} — Commande #${orderId}`;

  const content = `
    <p style="margin: 0 0 16px 0;">Bonjour <strong>${recipientFirstName}</strong>,</p>

    <p style="margin: 0 0 16px 0;">
      Tu trouveras ci-joint la facture de ta commande <strong>#${orderId}</strong>.
    </p>

    ${renderInfoBox("Numéro de facture", invoiceNumber)}

    <p style="margin: 0 0 16px 0;">
      Cette facture est <strong>strictement identique</strong> à celle émise au moment
      de ton paiement. Conserve-la précieusement pour ta comptabilité.
    </p>

    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      Si tu as la moindre question sur cette commande, n'hésite pas à contacter
      le vendeur depuis ton espace "Mes commandes".
    </p>
  `;

  const htmlContent = renderBaseLayout({
    title: "Ta facture 📄",
    content,
    preheader: `Facture ${invoiceNumber} — Commande #${orderId}`,
  });

  const textContent = `
Bonjour ${recipientFirstName},

Tu trouveras ci-joint la facture de ta commande #${orderId}.

Numéro de facture : ${invoiceNumber}

Cette facture est strictement identique à celle émise au moment de ton paiement.

L'équipe ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}