import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { getUserById, getAllUsers, updateUser } from "./users.service";

/**
 * GET /users/me
 * Renvoie le profil de l'utilisateur connecté (via JWT).
 */
export async function getMe(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Non authentifié" });
  }

  const user = await getUserById(req.user.id);

  if (!user) {
    return res.status(404).json({ success: false, message: "Utilisateur introuvable" });
  }

  return res.json({ success: true, user });
}

/**
 * PUT /users/me
 * Met à jour le profil de l'utilisateur connecté.
 */
export async function updateMe(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Non authentifié" });
  }

  const { full_name, email } = req.body as {
    full_name?: string;
    email?: string;
  };

  try {
    const updated = await updateUser(req.user.id, { full_name, email });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Utilisateur introuvable" });
    }

    return res.json({
      success: true,
      message: "Profil mis à jour",
      user: updated,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur serveur";
    return res.status(400).json({ success: false, message });
  }
}

/**
 * GET /users/:id
 * Renvoie le profil public d'un utilisateur.
 */
export async function getOne(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: "ID invalide" });
  }

  const user = await getUserById(id);

  if (!user) {
    return res.status(404).json({ success: false, message: "Utilisateur introuvable" });
  }

  return res.json({ success: true, user });
}

/**
 * GET /users
 * Renvoie la liste de tous les utilisateurs.
 */
export async function getAll(_req: Request, res: Response) {
  const list = await getAllUsers();
  return res.json({ success: true, users: list });
}