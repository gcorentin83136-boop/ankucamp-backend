interface ContactMessageProps {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export function contactMessageTemplate({
  name,
  email,
  subject,
  message,
}: ContactMessageProps) {
  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Nouveau message ANKU</title>
</head>
<body style="margin:0;padding:0;background:#f5f9f0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f9f0;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
                🌱 ANKU
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:13px;">
                Nouveau message de contact
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 20px;color:#08060d;font-size:20px;font-weight:700;">
                📬 Nouveau message reçu
              </h2>

              <!-- Infos expéditeur -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:20px;">
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;width:80px;">
                    <strong>Nom :</strong>
                  </td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;">
                    ${name}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">
                    <strong>Email :</strong>
                  </td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;">
                    <a href="mailto:${email}" style="color:#10b981;text-decoration:none;font-weight:600;">
                      ${email}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">
                    <strong>Sujet :</strong>
                  </td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">
                    ${subject}
                  </td>
                </tr>
              </table>

              <!-- Message -->
              <h3 style="margin:0 0 12px;color:#08060d;font-size:14px;font-weight:700;">
                Message :
              </h3>
              <div style="background:#f9fafb;border-left:4px solid #10b981;border-radius:8px;padding:16px;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">
${message}
              </div>

              <!-- CTA -->
              <div style="margin-top:24px;text-align:center;">
                <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}"
                   style="display:inline-block;background:#10b981;color:#ffffff;padding:12px 28px;border-radius:24px;text-decoration:none;font-weight:700;font-size:14px;">
                  Répondre à ${name}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                Ce message a été envoyé via le formulaire de contact ANKU<br>
                <a href="https://ankucamp.com" style="color:#10b981;text-decoration:none;">
                  ankucamp.com
                </a>
              </p>
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
Nouveau message de contact ANKU

De : ${name} <${email}>
Sujet : ${subject}

Message :
${message}

---
Répondre : ${email}
  `.trim();

  return {
    subject: `[ANKU Contact] ${subject}`,
    htmlContent,
    textContent,
  };
}
