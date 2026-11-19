import { BRAND, COLORS, FONT, SIZE } from "./theme";

// ============================================================
// BOUTON CTA (vert émeraude arrondi)
// ============================================================

export function renderButton(url: string, text: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin: 32px auto;">
      <tr>
        <td align="center" style="background: ${COLORS.brandGreen}; border-radius: ${SIZE.buttonRadius}px;">
          <a href="${url}" target="_blank" style="display: inline-block; padding: ${SIZE.buttonPaddingY}px ${SIZE.buttonPaddingX}px; color: #ffffff; font-family: ${FONT.family}; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: ${SIZE.buttonRadius}px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `.trim();
}

// ============================================================
// ENCADRÉ INFO (fond neutre + bordure colorée gauche)
// ============================================================

export function renderInfoBox(
  label: string,
  value: string,
  accentColor: string = COLORS.brandGreen
): string {
  return `
    <div style="background: ${COLORS.bgNeutral}; border-left: 4px solid ${accentColor}; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0; color: ${COLORS.textMuted}; font-family: ${FONT.family}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
        ${label}
      </p>
      <p style="margin: 8px 0 0 0; color: ${COLORS.textDark}; font-family: ${FONT.family}; font-size: 22px; font-weight: 700;">
        ${value}
      </p>
    </div>
  `.trim();
}

// ============================================================
// TABLEAU DES PRODUITS
// ============================================================

interface Item {
  productName: string;
  quantity: number;
  unitPrice: string;
}

export function renderItemsTable(items: Item[]): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid ${COLORS.border}; color: ${COLORS.textBody}; font-family: ${FONT.family}; font-size: 14px;">
            ${item.productName}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid ${COLORS.border}; color: ${COLORS.textBody}; font-family: ${FONT.family}; font-size: 14px; text-align: center;">
            ${item.quantity}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid ${COLORS.border}; color: ${COLORS.textBody}; font-family: ${FONT.family}; font-size: 14px; text-align: right;">
            ${item.unitPrice} €
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid ${COLORS.border}; border-radius: 8px; margin-top: 12px; overflow: hidden;">
      <thead>
        <tr style="background: ${COLORS.bgNeutral};">
          <th style="padding: 12px; text-align: left; color: ${COLORS.textMuted}; font-family: ${FONT.family}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
            Produit
          </th>
          <th style="padding: 12px; text-align: center; color: ${COLORS.textMuted}; font-family: ${FONT.family}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
            Qté
          </th>
          <th style="padding: 12px; text-align: right; color: ${COLORS.textMuted}; font-family: ${FONT.family}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
            Prix U.
          </th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `.trim();
}

// ============================================================
// LIGNE "TOTAL" (sous les items)
// ============================================================

export function renderTotalRow(label: string, value: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 8px;">
      <tr>
        <td style="padding: 16px; text-align: right; font-family: ${FONT.family}; font-size: 16px; font-weight: 700; color: ${COLORS.textDark};">
          ${label}
        </td>
        <td style="padding: 16px; text-align: right; font-family: ${FONT.family}; font-size: 22px; font-weight: 700; color: ${COLORS.brandGreen};">
          ${value}
        </td>
      </tr>
    </table>
  `.trim();
}

// ============================================================
// DIVIDER
// ============================================================

export function renderDivider(): string {
  return `<hr style="border: none; border-top: 1px solid ${COLORS.border}; margin: 32px 0;" />`;
}

// ============================================================
// TITRE DE SECTION (avec emoji)
// ============================================================

export function renderSectionTitle(emoji: string, title: string): string {
  return `
    <h3 style="color: ${COLORS.textDark}; font-family: ${FONT.family}; font-size: 16px; font-weight: 700; margin: 32px 0 12px 0;">
      ${emoji} ${title}
    </h3>
  `.trim();
}

// ============================================================
// FOOTER
// ============================================================

export function renderFooter(): string {
  return `
    <tr>
      <td style="background: ${COLORS.bgNeutral}; padding: 24px; text-align: center; border-top: 1px solid ${COLORS.border};">
        <p style="color: ${COLORS.textMuted}; font-family: ${FONT.family}; font-size: 13px; margin: 0 0 8px 0;">
          © ${new Date().getFullYear()} ${BRAND.name} — Tous droits réservés
        </p>
        <p style="color: ${COLORS.textMuted}; font-family: ${FONT.family}; font-size: 12px; margin: 0;">
          <a href="${BRAND.website}" style="color: ${COLORS.textMuted}; text-decoration: underline;">${BRAND.website.replace("https://", "")}</a>
          &nbsp;•&nbsp;
          <a href="${BRAND.cguUrl}" style="color: ${COLORS.textMuted}; text-decoration: underline;">CGU</a>
          &nbsp;•&nbsp;
          <a href="${BRAND.privacyUrl}" style="color: ${COLORS.textMuted}; text-decoration: underline;">Confidentialité</a>
          &nbsp;•&nbsp;
          <a href="mailto:${BRAND.contactEmail}" style="color: ${COLORS.textMuted}; text-decoration: underline;">Contact</a>
        </p>
      </td>
    </tr>
  `.trim();
}