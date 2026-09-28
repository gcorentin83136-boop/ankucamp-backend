import { renderBaseLayout } from "../layouts/baseLayout";
import {
  renderButton,
  renderSectionTitle,
  renderInfoBox,
} from "../layouts/components";

interface OrderShippedData {
  buyerFirstName: string;
  orderId: number;
  sellerName: string;
  deliveryMethod: string;
  trackingNumber?: string | null;
}

export function orderShippedTemplate(data: OrderShippedData): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const { buyerFirstName, orderId, sellerName, deliveryMethod, trackingNumber } = data;

  const subject = `📦 Ta commande #${orderId} est en route !`;

  const trackingBlock = trackingNumber
    ? `
      ${renderSectionTitle("🔍", "Numéro de suivi")}
      <p style="margin: 0; font-family: monospace; font-size: 16px; color: #1f2937; background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; word-break: break-all;">
        ${trackingNumber}
      </p>
    `
    : "";

  const content = `
    <p style="margin: 0 0 16px 0;">Bonjour <strong>${buyerFirstName}</strong>,</p>

    <p style="margin: 0 0 16px 0;">
      Bonne nouvelle ! Ta commande <strong>#${orderId}</strong> vient d'être expédiée
      par <strong>${sellerName}</strong>. 📦
    </p>

    ${renderInfoBox("Commande", `#${orderId} — En route vers toi !`)}

    ${renderSectionTitle("🚚", "Livraison")}
    <p style="margin: 0; color: #4b5563; font-size: 14px;">
      <strong>Mode :</strong> ${deliveryMethod}
    </p>

    ${trackingBlock}

    ${renderButton(`https://ankucamp.com/orders/${orderId}`, "Suivre ma commande")}

    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      Tu recevras un nouvel email dès que ton colis sera livré.
    </p>
  `;

  const htmlContent = renderBaseLayout({
    title: "Ta commande est en route 📦",
    content,
    preheader: `Commande #${orderId} expédiée`,
  });

  const textContent = `
Bonjour ${buyerFirstName},

Ta commande #${orderId} vient d'être expédiée par ${sellerName} !

Mode de livraison : ${deliveryMethod}
${trackingNumber ? `Numéro de suivi : ${trackingNumber}` : ""}

Suivre ma commande : https://ankucamp.com/orders/${orderId}

L'équipe ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}