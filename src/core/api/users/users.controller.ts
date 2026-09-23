import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { getUserById, getAllUsers, updateUser } from "./users.service";

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
  if (!req.user) {
    throw new AppError("Non authentifié", 401);
  }

  const {
    first_name,
    last_name,
    email,
    address,
    city,
    postal_code,
    country,
    avatar_url,
  } = req.body as {
    first_name?: string;
    last_name?: string;
    email?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    country?: string;
    avatar_url?: string;
  };

  const updated = await updateUser(req.user.id, {
    first_name,
    last_name,
    email,
    address,
    city,
    postal_code,
    country,
    avatar_url,
  });

  if (!updated) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  return res.json({
    success: true,
    message: "Profil mis à jour",
    user: updated,
  });
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

export async function getAll(_req: Request, res: Response) {
  const list = await getAllUsers();
  return res.json({ success: true, users: list });
}