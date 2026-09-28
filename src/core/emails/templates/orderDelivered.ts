import { renderBaseLayout } from "../layouts/baseLayout";
import {
  renderButton,
  renderInfoBox,
} from "../layouts/components";

interface OrderDeliveredData {
  buyerFirstName: string;
  orderId: number;
  sellerName: string;
}

export function orderDeliveredTemplate(data: OrderDeliveredData): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const { buyerFirstName, orderId, sellerName } = data;

  const subject = `🎉 Ta commande #${orderId} est livrée !`;

  const content = `
    <p style="margin: 0 0 16px 0;">Bonjour <strong>${buyerFirstName}</strong>,</p>

    <p style="margin: 0 0 16px 0;">
      Excellente nouvelle ! Ta commande <strong>#${orderId}</strong> auprès de
      <strong>${sellerName}</strong> vient d'être marquée comme <strong>livrée</strong>. 🎉
    </p>

    ${renderInfoBox("Commande livrée", `#${orderId}`, "#10b981")}

    <p style="margin: 24px 0 0 0;">
      Merci d'avoir soutenu un producteur local en achetant sur <strong>ANKU</strong> 🌿
    </p>

    ${renderButton(`https://ankucamp.com/orders/${orderId}`, "Voir ma commande")}

    <p style="margin: 24px 0 0 0; padding: 16px; background: #eef2ff; border-left: 4px solid #6366f1; border-radius: 4px; font-size: 14px; color: #3730a3;">
      💬 <strong>Ton avis compte !</strong> Tu pourras bientôt laisser un avis sur
      cette commande et aider la communauté ANKU.
    </p>
  `;

  const htmlContent = renderBaseLayout({
    title: "Ta commande est livrée 🎉",
    content,
    preheader: `Commande #${orderId} livrée avec succès`,
  });

  const textContent = `
Bonjour ${buyerFirstName},

Ta commande #${orderId} auprès de ${sellerName} vient d'être livrée !

Merci d'avoir soutenu un producteur local en achetant sur ANKU 🌿

Voir ma commande : https://ankucamp.com/orders/${orderId}

L'équipe ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}