import { Response } from "express";
import { AuthRequest } from "../../../middlewares/auth.middleware";
import { AppError } from "../../../errors/AppError";
import {
  requestDeletionSchema,
  acceptLegalDocSchema,
} from "./gdpr.validation";
import {
  requestDataExport,
  getExportStatus,
  requestAccountDeletion,
  cancelAccountDeletion,
  getDeletionStatus,
  acceptLegalDocument,
  listAcceptances,
} from "./gdpr.service";

export async function exportData(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const request = await requestDataExport(req.user.id);

  return res.status(202).json({
    success: true,
    message:
      "Export en cours de préparation. Tu recevras un email avec le lien de téléchargement.",
    request: {
      id: request.id,
      status: request.status,
      requested_at: request.requested_at,
    },
  });
}

export async function exportStatus(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const request = await getExportStatus(req.user.id);

  if (!request) {
    return res.json({
      success: true,
      message: "Aucune demande d'export",
      request: null,
    });
  }

  return res.json({
    success: true,
    request: {
      id: request.id,
      status: request.status,
      file_url: request.file_url,
      requested_at: request.requested_at,
      completed_at: request.completed_at,
      expires_at: request.expires_at,
    },
  });
}

export async function requestDeletion(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = requestDeletionSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const request = await requestAccountDeletion(
    req.user.id,
    parsed.data.reason
  );

  return res.status(201).json({
    success: true,
    message: `Ton compte sera supprimé le ${request.scheduled_deletion_at.toLocaleDateString("fr-FR")}. Tu peux annuler à tout moment.`,
    request: {
      id: request.id,
      status: request.status,
      scheduled_deletion_at: request.scheduled_deletion_at,
    },
  });
}

export async function cancelDeletion(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  await cancelAccountDeletion(req.user.id);

  return res.json({
    success: true,
    message: "Suppression annulée. Ton compte est sauvegardé.",
  });
}

export async function deletionStatus(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const request = await getDeletionStatus(req.user.id);

  return res.json({
    success: true,
    request: request
      ? {
          id: request.id,
          status: request.status,
          reason: request.reason,
          scheduled_deletion_at: request.scheduled_deletion_at,
          created_at: request.created_at,
        }
      : null,
  });
}

export async function acceptances(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const list = await listAcceptances(req.user.id);

  return res.json({
    success: true,
    count: list.length,
    acceptances: list,
  });
}

export async function acceptDoc(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = acceptLegalDocSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const ip = req.ip ?? req.socket.remoteAddress;

  const acceptance = await acceptLegalDocument(
    req.user.id,
    parsed.data,
    ip
  );

  return res.status(201).json({
    success: true,
    message: "Acceptation enregistrée",
    acceptance,
  });
}