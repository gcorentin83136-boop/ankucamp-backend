import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { createReportSchema } from "./reports.validation";
import { createReport } from "./reports.service";

export async function postReport(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const created = await createReport(req.user.id, parsed.data);
  return res.status(201).json({ success: true, report: created });
}