import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { validatePromoSchema } from "./promo.validation";
import { validatePromoCode } from "./promo.service";

export async function validate(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = validatePromoSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await validatePromoCode(req.user.id, parsed.data);
  return res.json({ success: true, ...result });
}