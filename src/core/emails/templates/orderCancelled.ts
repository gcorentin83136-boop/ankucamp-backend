import { renderBaseLayout } from "../layouts/baseLayout";
import {
  renderButton,
  renderInfoBox,
} from "../layouts/components";
import { BRAND } from "../layouts/theme";

interface OrderCancelledData {
  buyerFirstName: string;
  orderId: number;
  sellerName: string;
  totalPrice: string;
  wasPaid: boolean;
}

export function orderCancelledTemplate(data: OrderCancelledData): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const { buyerFirstName, orderId, sellerName, totalPrice, wasPaid } = data;

  const subject = `❌ Ta commande #${orderId} a été annulée`;

  const refundBlock = wasPaid
    ? `
      <div style="margin: 24px 0 0 0; padding: 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; font-size: 14px; color: #991b1b;">
        💸 <strong>Remboursement</strong> : ton paiement de <strong>${totalPrice} €</strong>
        sera remboursé sous 5 à 10 jours ouvrés sur ton moyen de paiement.
      </div>
    `
    : "";

  const content = `
    <p style="margin: 0 0 16px 0;">Bonjour <strong>${buyerFirstName}</strong>,</p>

    <p style="margin: 0 0 16px 0;">
      Nous t'informons que ta commande <strong>#${orderId}</strong> auprès de
      <strong>${sellerName}</strong> a été <strong>annulée</strong>.
    </p>

    ${renderInfoBox("Commande annulée", `#${orderId}`, "#ef4444")}

    ${refundBlock}

    <p style="margin: 24px 0 0 0;">
      Si tu as la moindre question concernant cette annulation, n'hésite pas à
      contacter directement le vendeur depuis ton espace "Mes commandes".
    </p>

    ${renderButton(`https://ankucamp.com/orders/${orderId}`, "Voir ma commande")}

    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280; text-align: center;">
      Besoin d'aide ? Contacte-nous à
      <a href="mailto:${BRAND.contactEmail}" style="color: #10b981;">${BRAND.contactEmail}</a>
    </p>
  `;

  const htmlContent = renderBaseLayout({
    title: "Commande annulée",
    content,
    preheader: `Commande #${orderId} annulée`,
  });

  const textContent = `
Bonjour ${buyerFirstName},

Ta commande #${orderId} auprès de ${sellerName} a été annulée.

${wasPaid ? `Remboursement : ton paiement de ${totalPrice} € sera remboursé sous 5 à 10 jours ouvrés.` : ""}

Voir ma commande : https://ankucamp.com/orders/${orderId}

Besoin d'aide ? ${BRAND.contactEmail}

L'équipe ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}