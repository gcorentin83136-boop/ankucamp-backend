import { BRAND, COLORS, FONT, SIZE } from "./theme";
import { renderFooter } from "./components";

interface LayoutOptions {
  /** Titre principal affiché dans le body (ex: "Commande confirmée") */
  title?: string;
  /** Contenu HTML du corps (généré par chaque template) */
  content: string;
  /** Pré-header (aperçu dans la boîte mail) */
  preheader?: string;
}

/**
 * Layout ANKU — fond gris clair, carte blanche, logo ANKU en header,
 * body libre, footer avec liens.
 */
export function renderBaseLayout(options: LayoutOptions): string {
  const { title, content, preheader } = options;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRAND.name}</title>
</head>
<body style="font-family: ${FONT.family}; background: ${COLORS.bgLight}; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">

  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ""}

  <table width="100%" cellpadding="0" cellspacing="0" style="background: ${COLORS.bgLight}; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="${SIZE.cardWidth}" cellpadding="0" cellspacing="0" style="background: ${COLORS.bgWhite}; border-radius: ${SIZE.cardRadius}px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

          <!-- ============ HEADER (logo seul sur fond blanc) ============ -->
          <tr>
            <td style="padding: 40px 40px 24px 40px; text-align: center; background: ${COLORS.bgWhite};">
              <img src="${BRAND.logoUrl}" alt="${BRAND.name}" width="${SIZE.logoWidth}" style="display: block; margin: 0 auto; width: ${SIZE.logoWidth}px; height: auto; border: 0;" />
            </td>
          </tr>

          <!-- ============ BODY ============ -->
          <tr>
            <td style="padding: 0 ${SIZE.bodyPadding}px ${SIZE.bodyPadding}px ${SIZE.bodyPadding}px;">

              ${title ? `<h1 style="color: ${COLORS.textDark}; font-family: ${FONT.family}; font-size: 24px; font-weight: 700; margin: 0 0 24px 0; line-height: 1.3;">${title}</h1>` : ""}

              <div style="color: ${COLORS.textBody}; font-family: ${FONT.family}; font-size: 15px; line-height: 1.6;">
                ${content}
              </div>

            </td>
          </tr>

          <!-- ============ FOOTER ============ -->
          ${renderFooter()}

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}