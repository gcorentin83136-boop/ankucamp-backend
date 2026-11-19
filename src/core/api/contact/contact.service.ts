import { sendEmail } from "../../emails/email.service";
import { contactMessageTemplate } from "../../emails/templates/contactMessage";
import type { ContactInput } from "./contact.validation";

const CONTACT_EMAIL = "contact@ankucamp.com";

export async function sendContactMessage(input: ContactInput) {
  const { subject, htmlContent, textContent } = contactMessageTemplate({
    name: input.name,
    email: input.email,
    subject: input.subject,
    message: input.message,
  });

  await sendEmail({
    to: CONTACT_EMAIL,
    toName: "ANKU Contact",
    subject,
    htmlContent,
    textContent,
  });

  return { success: true, message: "Message envoyé" };
}
