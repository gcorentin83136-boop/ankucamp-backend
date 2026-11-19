import { renderBaseLayout } from "../layouts/baseLayout";
import { renderButton } from "../layouts/components";
import { COLORS, FONT } from "../layouts/theme";

interface OrderReviewRequestData {
  buyerFirstName: string;
  orderId: number;
  sellerName: string;
  daysSinceDelivery: number;
}

export function orderReviewRequestTemplate(
  data: OrderReviewRequestData
): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const { buyerFirstName, orderId, sellerName, daysSinceDelivery } = data;

  const subject = `⭐ Ton avis sur ta commande #${orderId}`;

  const content = `
    <p style="margin: 0 0 16px 0;">Bonjour <strong>${buyerFirstName}</strong>,</p>

    <p style="margin: 0 0 16px 0;">
      Tu as reçu ta commande <strong>#${orderId}</strong> auprès de
      <strong>${sellerName}</strong> il y a ${daysSinceDelivery} jours.
    </p>

    <p style="margin: 0 0 16px 0;">
      Peux-tu prendre <strong>30 secondes</strong> pour donner ton avis ? 🌿
    </p>

    <div style="background: ${COLORS.bgNeutral}; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 16px 0; font-size: 32px; letter-spacing: 8px;">
        ⭐⭐⭐⭐⭐
      </p>
      <p style="margin: 0; color: ${COLORS.textBody}; font-family: ${FONT.family}; font-size: 14px; line-height: 1.6;">
        Ton retour aide la communauté ANKU à faire les bons choix,
        et permet aux producteurs de s'améliorer.
      </p>
    </div>

    ${renderButton(
      `https://ankucamp.com/orders/${orderId}/review`,
      "Laisser un avis ⭐"
    )}

    <p style="margin: 24px 0 0 0; font-size: 14px; color: ${COLORS.textMuted}; text-align: center;">
      Merci pour ta contribution ! 🌿
    </p>
  `;

  const htmlContent = renderBaseLayout({
    title: "Ton avis compte ⭐",
    content,
    preheader: `Commande #${orderId} — laisse ton avis en 30 secondes`,
  });

  const textContent = `
Bonjour ${buyerFirstName},

Tu as reçu ta commande #${orderId} auprès de ${sellerName} il y a ${daysSinceDelivery} jours.

Peux-tu prendre 30 secondes pour donner ton avis ?

⭐⭐⭐⭐⭐

Laisser un avis : https://ankucamp.com/orders/${orderId}/review

Merci pour ta contribution !
L'équipe ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}