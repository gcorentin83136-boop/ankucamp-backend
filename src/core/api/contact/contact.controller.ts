import { Request, Response } from "express";
import { AppError } from "../../errors/AppError";
import { contactSchema } from "./contact.validation";
import { sendContactMessage } from "./contact.service";

export async function postContact(req: Request, res: Response) {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await sendContactMessage(parsed.data);

  return res.status(200).json(result);
}
