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

/**
 * Template HTML : notification de nouvelle commande pour le vendeur.
 */
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

  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">
          ${item.productName}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: right;">
          ${item.unitPrice} €
        </td>
      </tr>
    `
    )
    .join("");

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
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🛒 Nouvelle commande !</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; margin-top: 0;">Bravo ${sellerFirstName} !</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                Tu viens de recevoir une nouvelle commande sur <strong>ANKU</strong>.
              </p>

              <div style="background: #f9fafb; border-left: 4px solid #6366f1; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #1f2937; font-size: 14px;">
                  <strong>Commande #${orderId}</strong>
                </p>
                <p style="margin: 8px 0 0 0; color: #6366f1; font-size: 24px; font-weight: bold;">
                  ${totalPrice} €
                </p>
              </div>

              <h3 style="color: #1f2937; margin-top: 32px;">👤 Client</h3>
              <p style="color: #4b5563; line-height: 1.6;">
                <strong>${buyerName}</strong><br>
                ${buyerEmail}
              </p>

              <h3 style="color: #1f2937; margin-top: 32px;">📦 Produits commandés</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 6px; margin-top: 12px;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; text-transform: uppercase;">Produit</th>
                    <th style="padding: 12px; text-align: center; color: #6b7280; font-size: 12px; text-transform: uppercase;">Qté</th>
                    <th style="padding: 12px; text-align: right; color: #6b7280; font-size: 12px; text-transform: uppercase;">Prix U.</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <h3 style="color: #1f2937; margin-top: 32px;">🚚 Livraison</h3>
              <p style="color: #4b5563; line-height: 1.6;">
                <strong>Mode :</strong> ${deliveryMethod}<br>
                ${deliveryAddress ? `<strong>Adresse :</strong> ${deliveryAddress}` : ""}
              </p>

              <h3 style="color: #1f2937; margin-top: 32px;">💰 Ta rémunération</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Montant total payé par le client</td>
                  <td style="padding: 8px 0; text-align: right; color: #1f2937; font-weight: bold;">${totalPrice} €</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #ef4444; font-size: 14px;">Commission ANKU (${platformFeePercent}%)</td>
                  <td style="padding: 8px 0; text-align: right; color: #ef4444; font-weight: bold;">− ${applicationFeeAmount} €</td>
                </tr>
                <tr style="border-top: 2px solid #e5e7eb;">
                  <td style="padding: 12px 0; color: #1f2937; font-size: 16px; font-weight: bold;">Montant versé sur ton compte</td>
                  <td style="padding: 12px 0; text-align: right; color: #10b981; font-size: 18px; font-weight: bold;">${sellerAmount} €</td>
                </tr>
              </table>

              <div style="text-align: center; margin: 32px 0;">
                <a href="https://anku.com/dashboard/orders/${orderId}" style="display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold;">
                  Voir la commande
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px;">
                Pense à confirmer l'expédition une fois le colis envoyé.
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
Bravo ${sellerFirstName} !

Tu viens de recevoir une nouvelle commande sur ANKU.

Commande #${orderId} — ${totalPrice} €

Client :
${buyerName}
${buyerEmail}

Produits :
${items.map((i) => `- ${i.productName} x${i.quantity} : ${i.unitPrice} €`).join("\n")}

Livraison : ${deliveryMethod}
${deliveryAddress ? `Adresse : ${deliveryAddress}` : ""}

Ta rémunération :
- Montant total : ${totalPrice} €
- Commission ANKU (${platformFeePercent}%) : − ${applicationFeeAmount} €
- Net versé : ${sellerAmount} €

Voir la commande : https://anku.com/dashboard/orders/${orderId}

© ${new Date().getFullYear()} ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}