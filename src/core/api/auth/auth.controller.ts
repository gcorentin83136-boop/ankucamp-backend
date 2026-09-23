import { Request, Response } from "express";
import { registerSchema, loginSchema } from "./auth.validation";
import { registerUser, loginUser } from "./auth.service";
import { AppError } from "../../errors/AppError";

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const user = await registerUser(parsed.data);

  return res.status(201).json({
    success: true,
    message: "Compte créé avec succès",
    user,
  });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const { user, token } = await loginUser(parsed.data);

  return res.status(200).json({
    success: true,
    message: "Connexion réussie",
    user,
    token,
  });
}