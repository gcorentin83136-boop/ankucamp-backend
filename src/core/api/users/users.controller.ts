import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { createSession } from "../settings/sessions/sessions.service";
import {
  getUserById,
  getUserByUsername,
  getAllUsers,
  searchUsers,
  updateUser,
  updatePrivacy,
  getUserStats,
  skipProfileCompletion,
} from "./users.service";
import {
  updateProfileSchema,
  updatePrivacySchema,
  listUsersQuerySchema,
} from "./users.validation";
import { listFriends } from "../friends/friends.service";
import { suspendUser, unsuspendUser, anonymizeUser } from "./users.service";

// ============================================================
// MES INFOS
// ============================================================

export async function getMe(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError("Non authentifié", 401);
  }

  const user = await getUserById(req.user.id);
  if (!user) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  return res.json({ success: true, user });
}

export async function updateMe(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const updated = await updateUser(req.user.id, parsed.data);

  if (!updated) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  return res.json({
    success: true,
    message: "Profil mis à jour",
    user: updated,
  });
}

// ============================================================
// PRIVACY
// ============================================================

export async function putPrivacy(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = updatePrivacySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const updated = await updatePrivacy(req.user.id, parsed.data.is_private);

  return res.json({
    success: true,
    message: `Profil ${updated.is_private ? "privé" : "public"}`,
    user: updated,
  });
}

// ============================================================
// LECTURE PUBLIQUE
// ============================================================

export async function getAll(req: AuthRequest, res: Response) {
  const parsed = listUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const { limit, offset, search } = parsed.data;
  const viewerId = req.user?.id; // 🆕 Récupérer l'ID du viewer pour filtrer

  const list =
    search && search.trim() !== ""
      ? await searchUsers(parsed.data, viewerId) // 🆕 Passer le viewerId
      : await getAllUsers(limit, offset);

  return res.json({ success: true, count: list.length, users: list });
}

export async function getOne(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    throw new AppError("ID invalide", 400);
  }

  const viewerId = req.user?.id;
  const user = await getUserById(id, viewerId);
  if (!user) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  return res.json({ success: true, user });
}

export async function getByUsername(req: AuthRequest, res: Response) {
  const username = req.params.username;
  if (!username) {
    throw new AppError("Username requis", 400);
  }

  const viewerId = req.user?.id;
  const user = await getUserByUsername(username, viewerId);
  if (!user) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  return res.json({ success: true, user });
}

export async function getStats(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    throw new AppError("ID invalide", 400);
  }

  const user = await getUserById(id);
  if (!user) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  const stats = await getUserStats(id);

  return res.json({ success: true, stats });
}

export async function getFriends(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    throw new AppError("ID invalide", 400);
  }

  const user = await getUserById(id);
  if (!user) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  if (user.is_private === 1) {
    if (!req.user || req.user.id !== id) {
      throw new AppError("Ce profil est privé", 403);
    }
  }

  const friends = await listFriends(id, { limit: 100, offset: 0 });

  return res.json({ success: true, count: friends.length, friends });
}

// ============================================================
// POST /users/me/become-pro
// ============================================================

export async function becomePro(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const { createKycSchema } = await import("../kyc/kyc.validation.js");
  const { becomeProAndCreateKyc } = await import("../kyc/kyc.service.js");
  const { signToken } = await import("../../security/jwt.js");

  const parsed = createKycSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await becomeProAndCreateKyc(req.user.id, parsed.data);

  const newToken = signToken({
    id: req.user.id,
    email: req.user.email,
    role: "professionnel",
  });

  try {
    await createSession(req.user.id, newToken, req);
  } catch (err) {
    console.error("Erreur création session becomePro:", err);
  }

  return res.status(201).json({
    success: true,
    message: "Demande envoyée. Ton compte est maintenant professionnel.",
    kyc: result.kyc,
    token: newToken,
    newRole: "professionnel",
  });
}

// ============================================================
// ADMIN — SUSPENSION / SUPPRESSION
// ============================================================

export async function adminSuspend(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const { days, reason } = req.body as { days?: number; reason?: string };

  const result = await suspendUser(
    id,
    Number(days ?? 15),
    String(reason ?? "")
  );

  return res.json({
    ...result,
    message: `Utilisateur suspendu pour ${days ?? 15} jours`,
  });
}

export async function adminUnsuspend(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const result = await unsuspendUser(id);

  return res.json({
    ...result,
    message: "Suspension levée",
  });
}

export async function adminDeleteUser(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const result = await anonymizeUser(id);

  return res.json({
    ...result,
    message: "Compte supprimé définitivement",
  });
}

// ============================================================
// ONBOARDING — Complétion de profil
// ============================================================

export async function skipProfileOnboarding(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const updated = await skipProfileCompletion(req.user.id);
  return res.json({
    success: true,
    message: "Profil marqué comme complété",
    user: updated,
  });
}