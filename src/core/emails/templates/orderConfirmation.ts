import { renderBaseLayout } from "../layouts/baseLayout";
import {
  renderItemsTable,
  renderTotalRow,
  renderSectionTitle,
  renderButton,
} from "../layouts/components";

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: string;
}

interface OrderConfirmationData {
  buyerFirstName: string;
  orderId: number;
  totalPrice: string;
  deliveryMethod: string;
  deliveryAddress: string | null;
  items: OrderItem[];
  sellerName: string;
}

export function orderConfirmationTemplate(data: OrderConfirmationData): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const {
    buyerFirstName,
    orderId,
    totalPrice,
    deliveryMethod,
    deliveryAddress,
    items,
    sellerName,
  } = data;

  const subject = `✅ Commande #${orderId} confirmée`;

  const content = `
    <p style="margin: 0 0 16px 0;">Bonjour <strong>${buyerFirstName}</strong>,</p>

    <p style="margin: 0 0 16px 0;">
      Ta commande <strong>#${orderId}</strong> auprès de <strong>${sellerName}</strong>
      a bien été confirmée et payée. Merci pour ta confiance ! 🌿
    </p>

    ${renderSectionTitle("📦", "Détail de la commande")}
    ${renderItemsTable(items)}
    ${renderTotalRow("Total payé", `${totalPrice} €`)}

    ${renderSectionTitle("🚚", "Livraison")}
    <p style="margin: 0; color: #4b5563; font-size: 14px;">
      <strong>Mode :</strong> ${deliveryMethod}<br>
      ${deliveryAddress ? `<strong>Adresse :</strong> ${deliveryAddress}` : ""}
    </p>

    ${renderButton(`https://ankucamp.com/orders/${orderId}`, "Voir ma commande")}

    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280; text-align: center;">
      📄 Une facture PDF est disponible dans ton espace "Mes commandes".
    </p>
  `;

  const htmlContent = renderBaseLayout({
    title: "Commande confirmée ✅",
    content,
    preheader: `Commande #${orderId} confirmée — ${totalPrice} €`,
  });

  const textContent = `
Bonjour ${buyerFirstName},

Ta commande #${orderId} auprès de ${sellerName} a bien été confirmée et payée.

Détail :
${items.map((i) => `- ${i.productName} x${i.quantity} : ${i.unitPrice} €`).join("\n")}

Total : ${totalPrice} €

Livraison : ${deliveryMethod}
${deliveryAddress ? `Adresse : ${deliveryAddress}` : ""}

Voir ma commande : https://ankucamp.com/orders/${orderId}

L'équipe ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}