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

/**
 * Template HTML pour la confirmation de commande.
 */
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
            <td style="background: #10b981; padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">✅ Commande confirmée</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; margin-top: 0;">Merci ${buyerFirstName} !</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                Ta commande <strong>#${orderId}</strong> auprès de <strong>${sellerName}</strong> a bien été confirmée et payée.
              </p>
              <h3 style="color: #1f2937; margin-top: 32px;">📦 Détail de la commande</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 6px; margin-top: 12px;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; text-transform: uppercase;">Produit</th>
                    <th style="padding: 12px; text-align: center; color: #6b7280; font-size: 12px; text-transform: uppercase;">Qté</th>
                    <th style="padding: 12px; text-align: right; color: #6b7280; font-size: 12px; text-transform: uppercase;">Prix</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr style="background: #f9fafb;">
                    <td colspan="2" style="padding: 16px; text-align: right; font-weight: bold; color: #1f2937;">Total</td>
                    <td style="padding: 16px; text-align: right; font-weight: bold; color: #10b981; font-size: 18px;">${totalPrice} €</td>
                  </tr>
                </tfoot>
              </table>
              <h3 style="color: #1f2937; margin-top: 32px;">🚚 Livraison</h3>
              <p style="color: #4b5563;">
                <strong>Mode :</strong> ${deliveryMethod}<br>
                ${deliveryAddress ? `<strong>Adresse :</strong> ${deliveryAddress}` : ""}
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="https://anku.com/orders/${orderId}" style="display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold;">
                  Voir ma commande
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">
                Une facture PDF est disponible dans ton espace "Mes commandes".
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
Merci ${buyerFirstName} !

Ta commande #${orderId} auprès de ${sellerName} a bien été confirmée et payée.

Détail :
${items.map((i) => `- ${i.productName} x${i.quantity} : ${i.unitPrice} €`).join("\n")}

Total : ${totalPrice} €

Livraison : ${deliveryMethod}
${deliveryAddress ? `Adresse : ${deliveryAddress}` : ""}

Voir ma commande : https://anku.com/orders/${orderId}

© ${new Date().getFullYear()} ANKU
  `.trim();

  return { subject, htmlContent, textContent };
}