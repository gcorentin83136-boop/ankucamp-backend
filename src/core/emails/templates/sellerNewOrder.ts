import { renderBaseLayout } from "../layouts/baseLayout";
import {
  renderItemsTable,
  renderSectionTitle,
  renderInfoBox,
  renderButton,
} from "../layouts/components";
import { COLORS } from "../layouts/theme";

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: string;
}

interface SellerNewOrderData {
  sellerFirstName: string;
  orderId: number;
  totalPrice: string;
  sellerAmount: string;
  applicationFeeAmount: string;
  platformFeePercent: number;
  buyerName: string;
  buyerEmail: string;
  deliveryMethod: string;
  deliveryAddress: string | null;
  items: OrderItem[];
}

export function sellerNewOrderTemplate(data: SellerNewOrderData): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const {
    sellerFirstName,
    orderId,
    totalPrice,
    sellerAmount,
    applicationFeeAmount,
    platformFeePercent,
    buyerName,
    buyerEmail,
    deliveryMethod,
    deliveryAddress,
    items,
  } = data;

  const subject = `🛒 Nouvelle commande #${orderId} — ${totalPrice} €`;

  const content = `
    <p style="margin: 0 0 16px 0;">Bonjour <strong>${sellerFirstName}</strong>,</p>

    <p style="margin: 0 0 16px 0;">
      Bonne nouvelle ! Tu viens de recevoir une nouvelle commande sur ANKU. 🎉
    </p>

    ${renderInfoBox("Commande", `#${orderId} — ${totalPrice} €`)}

    ${renderSectionTitle("👤", "Client")}
    <p style="margin: 0; color: #4b5563; font-size: 14px;">
      <strong>${buyerName}</strong><br>
      ${buyerEmail}
    </p>

    ${renderSectionTitle("📦", "Produits commandés")}
    ${renderItemsTable(items)}

    ${renderSectionTitle("🚚", "Livraison")}
    <p style="margin: 0; color: #4b5563; font-size: 14px;">
      <strong>Mode :</strong> ${deliveryMethod}<br>
      ${deliveryAddress ? `<strong>Adresse :</strong> ${deliveryAddress}` : ""}
    </p>

    ${renderSectionTitle("💰", "Ta rémunération")}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 8px;">
      <tr>
        <td style="padding: 8px 0; color: ${COLORS.textMuted}; font-size: 14px;">Montant total payé par le client</td>
        <td style="padding: 8px 0; text-align: right; color: ${COLORS.textDark}; font-weight: 600; font-size: 14px;">${totalPrice} €</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: ${COLORS.danger}; font-size: 14px;">Commission ANKU (${platformFeePercent}%)</td>
        <td style="padding: 8px 0; text-align: right; color: ${COLORS.danger}; font-weight: 600; font-size: 14px;">− ${applicationFeeAmount} €</td>
      </tr>
      <tr style="border-top: 2px solid ${COLORS.border};">
        <td style="padding: 12px 0; color: ${COLORS.textDark}; font-size: 15px; font-weight: 700;">Montant versé sur ton compte</td>
        <td style="padding: 12px 0; text-align: right; color: ${COLORS.brandGreen}; font-size: 20px; font-weight: 700;">${sellerAmount} €</td>
      </tr>
    </table>

    ${renderButton(`https://ankucamp.com/dashboard/orders/${orderId}`, "Voir la commande")}

    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280; text-align: center;">
      Pense à confirmer l'expédition une fois le colis envoyé.
    </p>
  `;

  const htmlContent = renderBaseLayout({
    title: "Nouvelle commande 🛒",
    content,
    preheader: `Nouvelle commande #${orderId} — ${totalPrice} €`,
  });

  const textContent = `
Bonjour ${sellerFirstName},

Tu viens de recevoir une nouvelle commande sur ANKU !

Commande #${orderId} — ${totalPrice} €

Client :
${buyerName}
${buyerEmail}

Produits :
${items.map((i) => `- ${i.productName} x${i.quantity} : ${i.unitPrice} €`).join("\n")}

Livraison : ${deliveryMethod}
${deliveryAddress ? `Adresse : ${deliveryAddress}` : ""}

Ta rémunération :
- Total payé : ${totalPrice} €
- Commission ANKU (${platformFeePercent}%) : − ${applicationFeeAmount} €
- Net versé : ${sellerAmount} €

Voir la commande : https://ankucamp.com/dashboard/orders/${orderId}

L'équipe ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}