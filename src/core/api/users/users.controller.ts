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
} from "./users.service";
import {
  updateProfileSchema,
  updatePrivacySchema,
  listUsersQuerySchema,
} from "./users.validation";
import { listFriends } from "../friends/friends.service";

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

export async function getAll(req: Request, res: Response) {
  const parsed = listUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const { limit, offset, search } = parsed.data;

  const list =
    search && search.trim() !== ""
      ? await searchUsers(parsed.data)
      : await getAllUsers(limit, offset);

  return res.json({ success: true, count: list.length, users: list });
}

export async function getOne(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    throw new AppError("ID invalide", 400);
  }

  const user = await getUserById(id);
  if (!user) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  return res.json({ success: true, user });
}

/**
 * Récupère un user par username (profil public).
 */
export async function getByUsername(req: Request, res: Response) {
  const username = req.params.username;
  if (!username) {
    throw new AppError("Username requis", 400);
  }

  const user = await getUserByUsername(username);
  if (!user) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  return res.json({ success: true, user });
}

/**
 * Stats publiques d'un profil.
 */
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

/**
 * Liste des amis d'un user (public si profil public).
 */
export async function getFriends(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    throw new AppError("ID invalide", 400);
  }

  const user = await getUserById(id);
  if (!user) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  // Si profil privé → seul l'user lui-même peut voir ses amis
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
// Convertit un particulier en professionnel + crée une demande KYC
// Retourne un NOUVEAU JWT avec le rôle "professionnel"
// ============================================================

export async function becomePro(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  // Imports dynamiques pour éviter les cycles
  const { createKycSchema } = await import("../kyc/kyc.validation");
  const { becomeProAndCreateKyc } = await import("../kyc/kyc.service");
  const { signToken } = await import("../../security/jwt");

  const parsed = createKycSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await becomeProAndCreateKyc(req.user.id, parsed.data);

  // 🔑 Générer un nouveau JWT avec le rôle "professionnel"
  const newToken = signToken({
    id: req.user.id,
    email: req.user.email,
    role: "professionnel",
  });

  // ✅ Créer la session BDD pour le nouveau token
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

import { suspendUser, unsuspendUser, anonymizeUser } from "./users.service";

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