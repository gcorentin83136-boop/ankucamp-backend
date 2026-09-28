import { renderBaseLayout } from "../layouts/baseLayout";
import {
  renderButton,
  renderInfoBox,
} from "../layouts/components";
import { COLORS } from "../layouts/theme";

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

    ${renderInfoBox("Commande livrée", `#${orderId}`, COLORS.brandGreen)}

    <p style="margin: 24px 0 0 0;">
      Merci d'avoir soutenu un producteur local en achetant sur <strong>ANKU</strong> 🌿
    </p>

    ${renderButton(`https://ankucamp.com/orders/${orderId}`, "Voir ma commande")}

    <div style="margin: 32px 0 0 0; padding: 20px; background: #f0fdf4; border-left: 4px solid ${COLORS.brandGreen}; border-radius: 6px;">
      <p style="margin: 0 0 8px 0; color: ${COLORS.textDark}; font-size: 15px; font-weight: 600;">
        ⭐ Ton avis compte !
      </p>
      <p style="margin: 0 0 16px 0; color: ${COLORS.textBody}; font-size: 14px; line-height: 1.6;">
        Aide la communauté ANKU en partageant ton expérience.
        Note les produits que tu as reçus et laisse un commentaire
        pour aider les prochains acheteurs.
      </p>
      ${renderButton(
        `https://ankucamp.com/orders/${orderId}/review`,
        "Laisser un avis ⭐"
      )}
    </div>
  `;

  const htmlContent = renderBaseLayout({
    title: "Ta commande est livrée 🎉",
    content,
    preheader: `Commande #${orderId} livrée — laisse ton avis !`,
  });

  const textContent = `
Bonjour ${buyerFirstName},

Ta commande #${orderId} auprès de ${sellerName} vient d'être livrée !

Merci d'avoir soutenu un producteur local en achetant sur ANKU 🌿

Voir ma commande : https://ankucamp.com/orders/${orderId}

⭐ Ton avis compte !
Aide la communauté ANKU en partageant ton expérience.
Laisser un avis : https://ankucamp.com/orders/${orderId}/review

L'équipe ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}