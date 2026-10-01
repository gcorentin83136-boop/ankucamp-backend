import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  listReportsQuerySchema,
  resolveReportSchema,
  dismissReportSchema,
} from "./reports.validation";
import {
  listReports,
  getReportById,
  resolveReport,
  dismissReport,
  getReportsStats,
} from "./reports.service";

export async function adminListReports(req: AuthRequest, res: Response) {
  const parsed = listReportsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Query invalide",
      400,
      parsed.error.flatten().fieldErrors
    );
  }
  const reports = await listReports(parsed.data);
  return res.json({ success: true, count: reports.length, reports });
}

export async function adminGetReport(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);
  const report = await getReportById(id);
  return res.json({ success: true, report });
}

export async function adminResolveReport(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const parsed = resolveReportSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await resolveReport(
    id,
    req.user.id,
    parsed.data.admin_note ?? null,
    parsed.data.delete_content
  );
  return res.json(result);
}

export async function adminDismissReport(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const parsed = dismissReportSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await dismissReport(id, req.user.id, parsed.data.admin_note);
  return res.json(result);
}

export async function adminReportsStats(_req: AuthRequest, res: Response) {
  const result = await getReportsStats();
  return res.json({ success: true, ...result });
}